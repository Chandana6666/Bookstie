# 📚 Bookstie — Your Book Bestie

A full-stack book recommender that suggests novels based on how you feel and what you like to read.

Pick a **mood** and an **interest**, and Bookstie returns ten books that match both.

> Live demo: https://bookstie.vercel.app/

---

## ✨ Features

- 🎭 **Mood-based recommendations** — Happy, Sad, Thrilling, Romantic, Dark
- 📖 **Interest-based filtering** — Fantasy, Mystery, Fiction, Adventure
- 📚 **10 curated results** per search, with covers and authors
- 🔁 **Dual data source** — Google Books first, automatic Open Library fallback
- ⚡ **Fast** — failed Google calls are cached for 10 minutes, so only the first request is slow
- 🧹 **Clean results** — duplicate titles removed, non-English and bundled "Works (…)" entries filtered out
- 🛡️ **Graceful errors** — loading, empty and failure states are all shown in the UI

---

## 🧠 How It Works

1. You choose a **mood** and an **interest**.
2. The frontend calls `GET /recommend?mood=…&interest=…` on the backend.
3. The backend maps the mood to a subject and builds a query:
   - `happy` → `humor`
   - `sad` → `grief`
   - `thrilling` → `suspense`
   - `romantic` → `romance`
   - `dark` → `psychological fiction`
4. It tries the **Google Books API** first. If that fails (missing key, quota exceeded, network error), it falls back to **Open Library**.
5. Open Library queries combine both choices, e.g. `subject:fantasy subject:romance`, and get broader only if no books are found:
   `mood + genre` → `genre` → free-text keywords.
6. Books are returned as JSON and rendered as cards.

---

## 🧱 Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | HTML, CSS, vanilla JavaScript |
| Backend | Node.js, Express, CORS |
| Data | Google Books API, Open Library API |
| Deploy | Frontend on Vercel, backend on any Node host |

---

## 📁 Project Structure

```
Bookstie/
├── index.html          # frontend markup
├── style.css           # frontend styles
├── script.js           # frontend logic (fetch + render)
├── backend/
│   ├── server.js       # Express API with Google Books → Open Library fallback
│   ├── package.json
│   └── package-lock.json
└── .gitignore
```

---

## ⚙️ Run Locally

### 1️⃣ Clone

```bash
git clone https://github.com/Chandana6666/Bookstie.git
cd Bookstie
```

### 2️⃣ Start the backend

```bash
cd backend
npm install
npm start
```

The API runs at `http://localhost:5000`.

### 3️⃣ Serve the frontend

From the project root (the folder containing `index.html`):

```bash
npx http-server . -p 8080
```

Then open `http://localhost:8080`.

> Opening `index.html` directly from the file system also works, but serving it avoids browser restrictions.

---

## 🌍 API

### `GET /recommend`

| Query param | Allowed values |
| --- | --- |
| `mood` | `happy`, `sad`, `thrilling`, `romantic`, `dark` |
| `interest` | `fantasy`, `mystery`, `fiction`, `adventure` |

**Example**

```
GET http://localhost:5000/recommend?mood=thrilling&interest=mystery
```

**Response**

```json
[
  {
    "title": "A Good Girl's Guide to Murder",
    "authors": ["Holly Jackson"],
    "thumbnail": "https://covers.openlibrary.org/b/id/10536661-M.jpg",
    "description": "..."
  }
]
```

| Status | Meaning |
| --- | --- |
| `200` | List of books (possibly empty) |
| `400` | Mood/interest missing or invalid |
| `500` | Both book APIs failed |

---

## 🔑 Environment Variables

| Variable | Required | Description |
| --- | --- | --- |
| `PORT` | No | Port for the backend (default `5000`) |
| `GOOGLE_BOOKS_API_KEY` | No | Google Books API key. Without it, Google's shared quota often returns `429` and Bookstie uses Open Library instead. |

```bash
# PowerShell
$env:GOOGLE_BOOKS_API_KEY="your-key"; npm start

# bash
GOOGLE_BOOKS_API_KEY=your-key npm start
```

---

## 🚀 Deployment

- **Frontend** — deploy the root folder to Vercel/Netlify.
- **Backend** — deploy `backend/` to Render/Railway and set `PORT` if required.
- Point the frontend `fetch()` URL in `script.js` at your live backend instead of `http://127.0.0.1:5000`.

---

## 💡 Future Improvements

- ⭐ Favorites / reading list
- 🔐 User accounts
- 🤖 Smarter ranking from user ratings
- 📱 Fully responsive layout
- 📊 Trending books section
