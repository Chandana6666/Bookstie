const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 5000;
const GOOGLE_BOOKS_API_KEY = process.env.GOOGLE_BOOKS_API_KEY || "";

const TOTAL_RESULTS = 10;
const RECENT_RESULTS = 4;
const RECENT_YEARS = 6;

// Google Books quota is often exhausted (429). Remember failures briefly so we
// don't pay that failed round-trip on every single request.
const GOOGLE_RETRY_AFTER_MS = 10 * 60 * 1000;
let googleUnavailableUntil = 0;

// Mood → free-text keywords, used for the Google Books query and as last resort.
const MOOD_KEYWORDS = {
  happy: "feel good inspiring",
  sad: "emotional deep story",
  thrilling: "suspense thriller mystery",
  romantic: "love romance",
  dark: "psychological dark",
  funny: "funny humorous",
  cozy: "cozy heartwarming small town",
  spooky: "ghost haunted supernatural",
  epic: "epic grand adventure saga",
  reflective: "thought provoking philosophical",
  hopeful: "uplifting hopeful inspiring"
};

// Genre → Open Library subject.
const SUBJECT_MAP = {
  fantasy: "fantasy",
  mystery: "mystery",
  fiction: "fiction",
  adventure: "adventure",
  romance: "romance",
  scifi: "science fiction",
  horror: "horror",
  thriller: "thriller",
  historical: "historical fiction",
  youngadult: "young adult fiction"
};

// Mood → Open Library subject, so mood actually changes the recommendations.
const MOOD_SUBJECT_MAP = {
  happy: "humor",
  sad: "grief",
  thrilling: "suspense",
  romantic: "romance",
  dark: "psychological fiction",
  funny: "wit and humor",
  cozy: "domestic fiction",
  spooky: "ghost stories",
  epic: "epic literature",
  reflective: "philosophy",
  hopeful: "self-actualization"
};

const MOODS = Object.keys(MOOD_SUBJECT_MAP);
const INTERESTS = Object.keys(SUBJECT_MAP);

function buildQuery(mood, interest) {
  const moodQuery = MOOD_KEYWORDS[mood] || "";
  const interestQuery = SUBJECT_MAP[interest] || interest || "";

  return `${moodQuery} ${interestQuery}`.trim();
}

// Builds progressively broader queries: mood + genre, then genre, then free text.
function openLibraryQueries(mood, interest) {
  const genreSubject = SUBJECT_MAP[interest];
  const moodSubject = MOOD_SUBJECT_MAP[mood];
  const queries = [];

  if (genreSubject && moodSubject) {
    queries.push(`subject:${genreSubject} subject:${moodSubject}`);
  }

  if (genreSubject) {
    queries.push(`subject:${genreSubject}`);
  }

  const fallback = buildQuery(mood, interest);
  if (fallback) {
    queries.push(fallback);
  }

  return queries;
}

function recentYearFilter() {
  const year = new Date().getFullYear();
  return `first_publish_year:[${year - RECENT_YEARS} TO ${year + 1}]`;
}

// Google Books returns thumbnails over http; browsers block them on https pages.
function normalizeThumbnail(url) {
  if (!url) return "";
  return url.replace(/^http:\/\//, "https://");
}

function parseYear(value) {
  if (!value) return null;
  const match = String(value).match(/\d{4}/);
  return match ? Number(match[0]) : null;
}

async function fetchFromGoogleBooks(query) {
  const params = new URLSearchParams({
    q: query,
    maxResults: String(TOTAL_RESULTS)
  });

  if (GOOGLE_BOOKS_API_KEY) {
    params.set("key", GOOGLE_BOOKS_API_KEY);
  }

  const response = await fetch(
    `https://www.googleapis.com/books/v1/volumes?${params.toString()}`
  );

  if (!response.ok) {
    throw new Error(`Google Books API error: ${response.status}`);
  }

  const data = await response.json();

  if (!Array.isArray(data.items)) {
    return [];
  }

  return data.items.map(item => {
    const info = item.volumeInfo || {};

    return {
      title: info.title || "Unknown Title",
      authors: info.authors || [],
      thumbnail: normalizeThumbnail(info.imageLinks?.thumbnail),
      description: info.description || "",
      year: parseYear(info.publishedDate)
    };
  });
}

// Open Library lists works under their original title, so foreign editions leak
// in even with language=eng. Keep readable, English-looking titles only.
function isUsableTitle(title) {
  if (!title) return false;
  if (title.startsWith("Works (")) return false; // bundled omnibus editions
  return /^[A-Za-z0-9 '&:,.!?()\-]+$/.test(title);
}

async function fetchOpenLibraryDocs(query, { sort = "readinglog", limit = 40 } = {}) {
  const params = new URLSearchParams({
    q: query,
    limit: String(limit),
    sort,
    language: "eng",
    fields: "title,author_name,cover_i,first_sentence,language,first_publish_year"
  });

  const response = await fetch(`https://openlibrary.org/search.json?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`Open Library API error: ${response.status}`);
  }

  const data = await response.json();

  if (!Array.isArray(data.docs)) {
    return [];
  }

  const seen = new Set();

  return data.docs
    .filter(doc => {
      // The API's language filter is loose, so double-check here.
      if (Array.isArray(doc.language) && doc.language.length > 0) {
        return doc.language.includes("eng");
      }

      return true;
    })
    .filter(doc => {
      if (!isUsableTitle(doc.title) || seen.has(doc.title)) return false;
      seen.add(doc.title);
      return true;
    })
    .map(doc => ({
      title: doc.title,
      authors: doc.author_name || [],
      thumbnail: doc.cover_i
        ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
        : "",
      description: Array.isArray(doc.first_sentence)
        ? doc.first_sentence[0]
        : doc.first_sentence || "",
      year: doc.first_publish_year || null
    }));
}

// Recent releases that match the mood/genre. Falls back to genre-only so a new
// book still shows up when the mood + genre combo is too narrow.
async function fetchRecentBooks(mood, interest) {
  const genreSubject = SUBJECT_MAP[interest];
  const moodSubject = MOOD_SUBJECT_MAP[mood];
  const yearFilter = recentYearFilter();
  const candidates = [];

  if (genreSubject && moodSubject) {
    candidates.push(`subject:${genreSubject} subject:${moodSubject} ${yearFilter}`);
  }

  if (genreSubject) {
    candidates.push(`subject:${genreSubject} ${yearFilter}`);
  }

  for (const query of candidates) {
    const books = await fetchOpenLibraryDocs(query, { limit: 12 });

    if (books.length >= 3) {
      return books;
    }
  }

  return [];
}

async function recommendFromOpenLibrary(mood, interest) {
  const recent = await fetchRecentBooks(mood, interest);

  let popular = [];

  for (const query of openLibraryQueries(mood, interest)) {
    popular = await fetchOpenLibraryDocs(query, { limit: 40 });

    if (popular.length > 0) {
      break;
    }
  }

  const books = [];
  const seen = new Set();
  const authorCounts = new Map();
  const MAX_PER_AUTHOR = 2;

  const add = book => {
    if (seen.has(book.title) || books.length >= TOTAL_RESULTS) return;
    seen.add(book.title);
    books.push(book);

    const authorKey = (book.authors[0] || "").toLowerCase();
    if (authorKey) {
      authorCounts.set(authorKey, (authorCounts.get(authorKey) || 0) + 1);
    }
  };

  // First pass keeps variety by limiting repeats per author, the second pass
  // fills any remaining slots so a short list isn't left half empty.
  const pool = [...recent.slice(0, RECENT_RESULTS), ...popular];
  const deferred = [];

  pool.forEach(book => {
    const authorKey = (book.authors[0] || "").toLowerCase();

    if (authorKey && (authorCounts.get(authorKey) || 0) >= MAX_PER_AUTHOR) {
      deferred.push(book);
      return;
    }

    add(book);
  });

  deferred.forEach(add);

  return books.slice(0, TOTAL_RESULTS);
}

app.get("/recommend", async (req, res) => {
  const { mood, interest } = req.query;

  if (!MOODS.includes(mood) || !INTERESTS.includes(interest)) {
    return res.status(400).json({
      error: "Invalid mood or interest",
      allowed: { moods: MOODS, interests: INTERESTS }
    });
  }

  const query = buildQuery(mood, interest);

  if (Date.now() >= googleUnavailableUntil) {
    try {
      const books = await fetchFromGoogleBooks(query);

      if (books.length > 0) {
        return res.json(books);
      }
    } catch (err) {
      googleUnavailableUntil = Date.now() + GOOGLE_RETRY_AFTER_MS;
      console.warn(`Google Books failed (${err.message}), falling back to Open Library`);
    }
  }

  try {
    const books = await recommendFromOpenLibrary(mood, interest);
    return res.json(books);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
