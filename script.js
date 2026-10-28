const API_BASE = "http://127.0.0.1:5000";

// Books published within this many years get a "New" badge.
const NEW_BADGE_YEARS = 2;

async function getRecommendations() {
  const mood = document.getElementById("mood").value;
  const interest = document.getElementById("interest").value;

  const container = document.getElementById("results");
  container.innerHTML = "<p>Loading...</p>";

  try {
    const res = await fetch(
      `${API_BASE}/recommend?mood=${encodeURIComponent(mood)}&interest=${encodeURIComponent(interest)}`
    );

    if (!res.ok) {
      throw new Error(`Request failed with status ${res.status}`);
    }

    const books = await res.json();

    container.innerHTML = "";

    if (!Array.isArray(books) || books.length === 0) {
      container.innerHTML = "<p>No recommendations found.</p>";
      return;
    }

    const currentYear = new Date().getFullYear();

    books.forEach(book => {
      const title = book.title || "Unknown Title";
      const authors = Array.isArray(book.authors) && book.authors.length > 0
        ? book.authors.join(", ")
        : "Unknown";
      const thumbnail = book.thumbnail || "";
      const year = Number(book.year) || null;
      const isNew = year && year >= currentYear - NEW_BADGE_YEARS;

      const card = document.createElement("div");
      card.className = "book";

      if (thumbnail) {
        const img = document.createElement("img");
        img.src = thumbnail;
        img.alt = title;
        img.loading = "lazy";
        img.addEventListener("error", () => img.remove());
        card.appendChild(img);
      }

      const heading = document.createElement("h3");
      heading.textContent = title;

      const authorLine = document.createElement("p");
      authorLine.textContent = authors;

      card.appendChild(heading);
      card.appendChild(authorLine);

      if (year) {
        const meta = document.createElement("p");
        meta.className = "meta";

        if (isNew) {
          const badge = document.createElement("span");
          badge.className = "badge";
          badge.textContent = "New";
          meta.appendChild(badge);
        }

        const yearLabel = document.createElement("span");
        yearLabel.className = "year";
        yearLabel.textContent = year;
        meta.appendChild(yearLabel);

        card.appendChild(meta);
      }

      container.appendChild(card);
    });
  } catch (err) {
    console.error(err);
    container.innerHTML = "<p>Something went wrong. Please try again.</p>";
  }
}
