const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 5000;
const GOOGLE_BOOKS_API_KEY = process.env.GOOGLE_BOOKS_API_KEY || "";

// Google Books quota is often exhausted (429). Remember failures briefly so we
// don't pay that failed round-trip on every single request.
const GOOGLE_RETRY_AFTER_MS = 10 * 60 * 1000;
let googleUnavailableUntil = 0;

// Mood + Interest → Query mapping
function buildQuery(mood, interest) {
  const moodMap = {
    happy: "feel good inspiring",
    sad: "emotional deep story",
    thrilling: "suspense thriller mystery",
    romantic: "love romance",
    dark: "psychological dark"
  };

  const moodQuery = moodMap[mood] || "";
  const interestQuery = interest || "";

  return `${moodQuery} ${interestQuery}`.trim();
}

// Open Library relevance is much better with subject searches than free text.
const SUBJECT_MAP = {
  fantasy: "fantasy",
  mystery: "mystery",
  fiction: "fiction",
  adventure: "adventure"
};

// Each mood maps to a real Open Library subject so mood actually changes results.
const MOOD_SUBJECT_MAP = {
  happy: "humor",
  sad: "grief",
  thrilling: "suspense",
  romantic: "romance",
  dark: "psychological fiction"
};

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

// Google Books returns thumbnails over http; browsers block them on https pages.
function normalizeThumbnail(url) {
  if (!url) return "";
  return url.replace(/^http:\/\//, "https://");
}

async function fetchFromGoogleBooks(query) {
  const params = new URLSearchParams({
    q: query,
    maxResults: "10"
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
      description: info.description || ""
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

async function fetchFromOpenLibrary(query) {
  const params = new URLSearchParams({
    q: query,
    limit: "40",
    sort: "readinglog",
    language: "eng",
    fields: "title,author_name,cover_i,first_sentence,language"
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
    .slice(0, 10)
    .map(doc => ({
      title: doc.title || "Unknown Title",
      authors: doc.author_name || [],
      thumbnail: doc.cover_i
        ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
        : "",
      description: Array.isArray(doc.first_sentence)
        ? doc.first_sentence[0]
        : doc.first_sentence || ""
    }));
}

app.get("/recommend", async (req, res) => {
  const { mood, interest } = req.query;

  const query = buildQuery(mood, interest);

  if (!query) {
    return res.status(400).json({ error: "Invalid mood or interest" });
  }

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
    for (const openLibraryQuery of openLibraryQueries(mood, interest)) {
      const books = await fetchFromOpenLibrary(openLibraryQuery);

      if (books.length > 0) {
        return res.json(books);
      }
    }

    return res.json([]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
