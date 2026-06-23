# 📚BOOKSTIE : YOUR BOOK BESTIE!
A full-stack web application that recommends novels based on the user's **mood** and **interests** using the Google Books API.

## ✨ Features

* 🎭 Mood-based recommendations (Happy, Sad, Thriller, Romantic, Dark)
* 📖 Interest-based filtering (Fantasy, Mystery, Fiction, Adventure)
* 🔍 Real-time book data using Google Books API
* ⚡ Fast and responsive UI
* 🌐 Full-stack project (Frontend + Backend)

---

## 🧠 How It Works

1. User selects a **mood** and **interest**
2. Frontend sends request to backend API
3. Backend builds a search query
4. Google Books API returns relevant books
5. Books are displayed on the UI

---

## 🧱 Tech Stack

### Frontend

* HTML
* CSS
* JavaScript

### Backend

* Node.js
* Express.js

### API

* Google Books API

### Deployment

* https://bookstie.vercel.app/

---

## 📁 Project Structure

```
novel-recommender/
│
├── backend/
│   └── server.js
│
├── frontend/
│   ├── index.html
│   ├── style.css
│   └── script.js
```

---

## ⚙️ Installation & Setup

### 1️⃣ Clone the repository

```
git clone https://github.com/your-username/novel-recommender.git
cd novel-recommender
```

---

### 2️⃣ Setup Backend

```
cd backend
npm install
node server.js
```

Server runs at:

```
http://localhost:5000
```

---

### 3️⃣ Run Frontend

Open:

```
frontend/index.html
```

Or use Live Server in VS Code.

---

## 🌍 API Endpoint

```
GET /recommend?mood=happy&interest=fantasy
```

---

## 💡 Future Improvements

* ⭐ Add favorites system
* 🔐 User authentication
* 🤖 AI-based recommendations
* 📱 Fully responsive UI
* 📊 Trending books section

---

