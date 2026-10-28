async function getRecommendations() {
  const mood = document.getElementById("mood").value;
  const interest = document.getElementById("interest").value;

  const container = document.getElementById("results");
  container.innerHTML = "<p>Loading...</p>";

  try {
    const res = await fetch(
      `http://127.0.0.1:5000/recommend?mood=${encodeURIComponent(mood)}&interest=${encodeURIComponent(interest)}`
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

    books.forEach(book => {
      const title = book.title || "Unknown Title";
      const authors = Array.isArray(book.authors) && book.authors.length > 0
        ? book.authors.join(", ")
        : "Unknown";
      const thumbnail = book.thumbnail || "";

      container.innerHTML += `
        <div class="book">
          ${thumbnail ? `<img src="${thumbnail}" alt="${title}" />` : ""}
          <h3>${title}</h3>
          <p>${authors}</p>
        </div>
      `;
    });
  } catch (err) {
    console.error(err);
    container.innerHTML = "<p>Something went wrong. Please try again.</p>";
  }
}