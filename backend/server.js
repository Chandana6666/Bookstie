const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());

const PORT = 5000;

// Mood + Interest → Query mapping
function buildQuery(mood, interest) {
  let moodMap = {
    happy: "feel good inspiring",
    sad: "emotional deep story",
    thrilling: "suspense thriller mystery",
    romantic: "love romance",
    dark: "psychological dark"
  };

  return `${moodMap[mood]} ${interest}`;
}

app.get("/recommend", async (req, res) => {
  const { mood, interest } = req.query;

  try {
    const query = buildQuery(mood, interest);

    const response = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${query}&maxResults=10`
    );

    const data = await response.json();

    const books = data.items.map(item => ({
      title: item.volumeInfo.title,
      authors: item.volumeInfo.authors,
      thumbnail: item.volumeInfo.imageLinks?.thumbnail,
      description: item.volumeInfo.description
    }));

    res.json(books);

  } catch (err) {
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
