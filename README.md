# 📚 Bookstie — Your Book Bestie

A full-stack book recommender that suggests novels based on how you feel and what you like to read.

Pick a **mood** and a **genre**, and Bookstie returns ten books that match both — mixing well-known favourites with recent releases.

---

## ✨ Features

- 🎭 **11 moods** — Happy, Sad, Thrilling, Romantic, Dark, Funny, Cozy, Spooky, Epic, Reflective, Hopeful
- 📖 **10 genres** — Fantasy, Mystery, Fiction, Adventure, Romance, Science Fiction, Horror, Thriller, Historical Fiction, Young Adult
- 🆕 **Recent releases included** — recommendations blend current books with classics, and new ones get a `New` badge
- 📚 **10 results per search** with covers, authors and publication years
- 🚫 **Variety guard** — no more than 2 books from the same author
- 🔁 **Dual data source** — Google Books first, automatic Open Library fallback
- ⚡ **Fast** — failed Google calls are cached for 10 minutes, so only the first request is slow
- 🧹 **Clean results** — duplicate titles removed, non-English and bundled "Works (…)" entries filtered out
- 🛡️ **Validated input** — unknown moods or genres return `400` with the allowed values
- 💬 **Clear UI states** — loading, empty results and errors are all handled

---

## 🧠 How It Works

1. You choose a **mood** and a **genre**.
2. The frontend calls `GET /recommend?mood=…&interest=…` on the backend.
3. The backend maps the mood to a subject and builds a query:

   | Mood | Open Library subject | Keywords (Google/free text) |
   | --- | --- | --- |
   | `happy` | humor | feel good inspiring |
   | `sad` | grief | emotional deep story |
   | `thrilling` | suspense | suspense thriller mystery |
   | `romantic` | romance | love romance |
   | `dark` | psychological fiction | psychological dark |
   | `funny` | wit and humor | funny humorous |
   | `cozy` | domestic fiction | cozy heartwarming small town |
   | `spooky` | ghost stories | ghost haunted supernatural |
   | `epic` | epic literature | epic grand adventure saga |
   | `reflective` | philosophy | thought provoking philosophical |
   | `hopeful` | self-actualization | uplifting hopeful inspiring |

4. It tries the **Google Books API** first. If that fails (missing key, quota exceeded, network error), it falls back to **Open Library**.
5. Open Library queries combine both choices, for example `subject:fantasy subject:romance`, and broaden only if nothing is found:
   `mood + genre` → `genre` → free-text keywords.
6. A second query adds **recent books** (published in the last 6 years), and the two lists are merged:
   up to 4 recent titles first, then popular all-time picks, capped at 10 with no more than 2 per author.
7. Books are returned as JSON and rendered as cards.

---

## 🧱 Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | HTML, CSS, vanilla JavaScript |
| Backend | Node.js, Express, CORS |
| Data | Google Books API, Open Library API |
| Deploy | Static frontend + any Node host for the backend |

---

## 📁 Project Structure

```
Bookstie/
├── index.html          # frontend markup (mood + genre selectors)
├── style.css           # frontend styles
├── script.js           # frontend logic (fetch + render cards)
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
| `mood` | `happy`, `sad`, `thrilling`, `romantic`, `dark`, `funny`, `cozy`, `spooky`, `epic`, `reflective`, `hopeful` |
| `interest` | `fantasy`, `mystery`, `fiction`, `adventure`, `romance`, `scifi`, `horror`, `thriller`, `historical`, `youngadult` |

**Example**

```
GET http://localhost:5000/recommend?mood=cozy&interest=mystery
```

**Response**

```json
[
  {
    "title": "The Housemaid",
    "authors": ["Freida McFadden"],
    "thumbnail": "https://covers.openlibrary.org/b/id/12598569-M.jpg",
    "description": "...",
    "year": 2022
  }
]
```

| Status | Meaning |
| --- | --- |
| `200` | List of books (possibly empty) |
| `400` | Unknown mood/genre — response includes `allowed.moods` and `allowed.interests` |
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
- Update `API_BASE` in `script.js` to point at your live backend instead of `http://127.0.0.1:5000`.

---

## 💡 Future Improvements

- ⭐ Favorites / reading list
- 🔐 User accounts
- 🤖 Smarter ranking from user ratings
- 📱 Fully responsive layout
- 📊 Trending books section
