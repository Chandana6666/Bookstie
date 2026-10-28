# 📚 Bookstie — Your Book Bestie

A full-stack book recommender that suggests novels based on how you feel and what you like to read.

Pick a **mood** and a **genre**, and Bookstie returns ten books that match both — a mix of well-known favourites and the newest releases. Press **Recommend** again and you get a different set, because every request is freshly paged and shuffled.

---

## ✨ Features

- 🎭 **11 moods** — Happy, Sad, Thrilling, Romantic, Dark, Funny, Cozy, Spooky, Epic, Reflective, Hopeful
- 📖 **10 genres** — Fantasy, Mystery, Fiction, Adventure, Romance, Science Fiction, Horror, Thriller, Historical Fiction, Young Adult
- 🆕 **New releases surface automatically** — every request queries the current year, so a novel appears as soon as Open Library indexes it, and anything from the last 3 calendar years gets a `New` badge
- 🔀 **Different books every click** — randomised result paging and shuffling mean pressing *Recommend* again brings a fresh set instead of the same list
- 📚 **10 results per search** with covers, authors and publication years
- 🖼️ **Cover-first results** — new arrivals without a cover are skipped so cards never look broken
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
6. A **new-arrivals** pass runs on every request: it queries works published in the current year (falling back to the last 2 years, then 6), keeps only titles with a cover, and puts the best-rated fresh releases in the first four slots. Because this runs live, a newly published novel shows up without any database update or redeploy.
7. A **popular picks** pass fills the remaining slots from the mood + genre query, sorted by Open Library reading logs.
8. Both passes start at a **random page** (`offset`) and shuffle their results, and the API sends `Cache-Control: no-store`, so clicking *Recommend* again returns different books.
9. Books are returned as JSON and rendered as cards (capped at 10, max 2 per author).

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

**Requirements:** Node.js 18 or newer (the backend uses the built-in `fetch`).

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

The API runs at `http://localhost:5000`. You should see:

```
Server running on http://localhost:5000
```

> If Google Books has no quota, the first request also logs
> `Google Books failed (…), falling back to Open Library` — that is expected.

### 3️⃣ Serve the frontend

From the project root (the folder containing `index.html`):

```bash
npx http-server . -p 8080
```

Then open `http://localhost:8080`.

> Opening `index.html` directly from the file system also works, but serving it avoids browser restrictions.

### 4️⃣ Use it

1. Pick a **Mood** from the first dropdown.
2. Pick a **Genre** from the second dropdown.
3. Press **Recommend**.
4. Press it again for a new set of books — the list changes on every click.
5. Books published recently carry a green **NEW** badge next to their year.

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
    "title": "King of Gluttony",
    "authors": ["..."],
    "thumbnail": "https://covers.openlibrary.org/b/id/15123456-M.jpg",
    "description": "...",
    "year": 2026,
    "ratingsCount": 5,
    "ratingsAverage": 4
  }
]
```

Responses are never cached (`Cache-Control: no-store`), so each call can return a different set.

| Status | Meaning |
| --- | --- |
| `200` | List of books (possibly empty) |
| `400` | Unknown mood/genre — response includes `allowed.moods` and `allowed.interests` |
| `500` | Both book APIs failed |

### Response fields

| Field | Type | Description |
| --- | --- | --- |
| `title` | string | Book title |
| `authors` | string[] | Author names (may be empty) |
| `thumbnail` | string | Cover URL, or `""` when no cover exists |
| `description` | string | First sentence used as a short blurb, or `""` |
| `year` | number \| null | First publication year |
| `ratingsCount` | number | Open Library rating count; `0` when unrated |
| `ratingsAverage` | number | Open Library average rating; `0` when unrated |

---

## 📌 Good to Know

- **Results are meant to vary.** Random paging and shuffling run on every click, so two identical searches usually return different books. Nothing is cached.
- **New books need no update.** The current-year query runs live against Open Library on every request, so freshly published novels appear automatically without touching the code or a database.
- **New arrivals always have covers.** Coverless releases are skipped for the fresh slots so cards never render broken.
- **The first request can be slower.** The backend may query Open Library several times (new arrivals + popular picks), and a failed Google Books call is remembered for 10 minutes.
- **Google Books is optional.** Its shared, keyless quota is frequently exhausted (`429`), so Open Library is the practical data source. Add your own key to use Google Books first.
- **Duplicates and noise are filtered.** Titles are deduped, non-English editions are dropped, bundled `Works (…)` entries are removed, and at most 2 books per author are shown.

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
