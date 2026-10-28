const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 5000;
const GOOGLE_BOOKS_API_KEY = process.env.GOOGLE_BOOKS_API_KEY || "";

const TOTAL_RESULTS = 10;
const NEW_ARRIVALS_COUNT = 4; // fresh releases placed at the top
const NEW_ARRIVALS_YEARS = 2; // "new" window
const WIDE_RECENT_YEARS = 6; // broader recent fallback
const MAX_PER_AUTHOR = 2;

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

function currentYear() {
  return new Date().getFullYear();
}

function yearFilter(yearsBack) {
  const year = currentYear();
  return `first_publish_year:[${year - yearsBack} TO ${year + 1}]`;
}

// Open Library supports offset paging. Random pages mean a new click brings a
// different slice of the catalogue instead of the same top-rated books.
function randomOffset(pageSize, pages) {
  return Math.floor(Math.random() * pages) * pageSize;
}

function shuffle(items) {
  const copy = [...items];

  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
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

async function fetchOpenLibraryDocs(query, { sort = "readinglog", limit = 40, offset = 0 } = {}) {
  const params = new URLSearchParams({
    q: query,
    limit: String(limit),
    sort,
    language: "eng",
    offset: String(offset),
    fields: "title,author_name,cover_i,first_sentence,language,first_publish_year,ratings_average,ratings_count"
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
      year: doc.first_publish_year || null,
      ratingsCount: doc.ratings_count || 0,
      ratingsAverage: doc.ratings_average || 0
    }));
}

// Books published in the current year first, then the last couple of years,
// then a wider recent window. Because these queries run on every request, a
// novel shows up here automatically as soon as the API indexes it.
async function fetchNewArrivals(mood, interest) {
  const genreSubject = SUBJECT_MAP[interest];
  const moodSubject = MOOD_SUBJECT_MAP[mood];
  const thisYear = `first_publish_year:[${currentYear()} TO ${currentYear() + 1}]`;
  const candidates = [];

  // Genre-only current-year queries are much better populated (thousands of
  // works with covers) than mood + genre ones, which often only match a handful
  // of self-published titles. Try the broad query first and use the mood
  // pairing to add variety afterwards.
  if (genreSubject) {
    candidates.push(`subject:${genreSubject} ${thisYear}`);
  }

  if (genreSubject && moodSubject) {
    candidates.push(`subject:${genreSubject} subject:${moodSubject} ${thisYear}`);
  }

  if (genreSubject) {
    candidates.push(`subject:${genreSubject} ${yearFilter(NEW_ARRIVALS_YEARS)}`);
  }

  if (genreSubject && moodSubject) {
    candidates.push(`subject:${genreSubject} subject:${moodSubject} ${yearFilter(NEW_ARRIVALS_YEARS)}`);
  }

  if (genreSubject) {
    candidates.push(`subject:${genreSubject} ${yearFilter(WIDE_RECENT_YEARS)}`);
  }

  const collected = [];
  const seen = new Set();
  let attempts = 0;

  for (const query of candidates) {
    if (collected.length >= NEW_ARRIVALS_COUNT * 2 || attempts >= 3) break;
    attempts += 1;

    const books = await fetchOpenLibraryDocs(query, {
      limit: 40,
      offset: randomOffset(20, 2)
    });

    books.forEach(book => {
      // Coverless new arrivals are almost always unindexed indie titles and
      // look broken in the UI, so they never make the cut.
      if (!book.thumbnail || seen.has(book.title)) return;
      seen.add(book.title);
      collected.push(book);
    });
  }

  // Keep this year's books ahead of the wider recent window, so a flood of
  // well-rated older titles can never push genuinely new releases down. Within
  // each bucket, prefer books readers actually rated.
  const rank = (a, b) => (b.ratingsCount || 0) - (a.ratingsCount || 0);
  const fresh = collected.filter(book => (book.year || 0) >= currentYear());
  const recent = collected.filter(book => (book.year || 0) < currentYear());

  const freshTop = shuffle(fresh.sort(rank).slice(0, NEW_ARRIVALS_COUNT * 2));
  const recentTop = shuffle(recent.sort(rank).slice(0, NEW_ARRIVALS_COUNT * 2));

  return [...freshTop, ...recentTop];
}

async function fetchPopular(mood, interest) {
  for (const query of openLibraryQueries(mood, interest)) {
    const books = await fetchOpenLibraryDocs(query, {
      limit: 40,
      offset: randomOffset(40, 2)
    });

    if (books.length > 0) {
      return shuffle(books);
    }
  }

  return [];
}

async function recommendFromOpenLibrary(mood, interest) {
  const [newArrivals, popular] = await Promise.all([
    fetchNewArrivals(mood, interest),
    fetchPopular(mood, interest)
  ]);

  const books = [];
  const seen = new Set();
  const authorCounts = new Map();
  const deferred = [];

  const add = book => {
    if (seen.has(book.title) || books.length >= TOTAL_RESULTS) return;
    seen.add(book.title);
    books.push(book);

    const authorKey = (book.authors[0] || "").toLowerCase();
    if (authorKey) {
      authorCounts.set(authorKey, (authorCounts.get(authorKey) || 0) + 1);
    }
  };

  const addWithCap = book => {
    const authorKey = (book.authors[0] || "").toLowerCase();

    if (authorKey && (authorCounts.get(authorKey) || 0) >= MAX_PER_AUTHOR) {
      deferred.push(book);
      return;
    }

    add(book);
  };

  // Fresh releases first, then popular picks, then anything left over so the
  // list still reaches ten books.
  newArrivals.slice(0, NEW_ARRIVALS_COUNT).forEach(addWithCap);
  popular.forEach(addWithCap);
  newArrivals.forEach(addWithCap);
  deferred.forEach(add);

  return books.slice(0, TOTAL_RESULTS);
}

app.get("/recommend", async (req, res) => {
  // Recommendations are randomised per click, so never let a browser cache them.
  res.set("Cache-Control", "no-store");

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
        return res.json(shuffle(books));
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
