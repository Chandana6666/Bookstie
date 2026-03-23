async function getRecommendations() {
  const mood = document.getElementById("mood").value;
  const interest = document.getElementById("interest").value;

  const res = await fetch(
    `http://localhost:5000/recommend?mood=${mood}&interest=${interest}`
  );

  const books = await res.json();

  const container = document.getElementById("results");
  container.innerHTML = "";

  books.forEach(book => {
    container.innerHTML += `
      <div class="book">
        <img src="${book.thumbnail || ''}" />
        <h3>${book.title}</h3>
        <p>${book.authors?.join(", ") || "Unknown"}</p>
        <p>${book.year}</p>
      </div>
    `;
  });
}