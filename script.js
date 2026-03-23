async function getRecommendations() {
  const mood = document.getElementById("mood").value;
  const interest = document.getElementById("interest").value;

  try {
    const res = await fetch(
      `http://127.0.0.1:5000/recommend?mood=${mood}&interest=${interest}`
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
        </div>
      `;
    });

  } catch (err) {
    console.error(err);
  }
}