# Zenith AI 🤖

**Zenith AI** is a full-stack AI-powered conversational assistant designed to provide intelligent responses through an interactive chat interface. It combines a React frontend with a FastAPI backend to deliver AI conversations, document analysis, web search, and real-time streaming responses.

## ✨ Features

- 💬 **AI Chat:** Interact with an AI assistant and receive intelligent responses.
- 🔐 **Google Authentication:** Secure sign-in using Google OAuth.
- 🗂️ **Conversation Management:** Create and manage chat conversations with persistent history.
- 📄 **Document Upload & Analysis:** Upload PDF, DOCX, and TXT files for text extraction and AI-assisted analysis.
- ⚡ **Streaming Responses:** Receive AI responses progressively in real time.
- 🌐 **Web Search:** Retrieve external information to enhance responses.
- 💾 **Database Integration:** Store application data using SQLite and SQLAlchemy.
- 🎨 **Interactive UI:** Modern frontend built with React and Vite.

## 🛠️ Tech Stack

| Category | Technologies |
|---|---|
| Frontend | React, Vite, JavaScript, HTML, CSS |
| Backend | Python, FastAPI |
| Database | SQLite, SQLAlchemy |
| AI Integration | Ollama, Large Language Models (LLMs) |
| Authentication | Google OAuth, Authlib |
| API Communication | REST APIs, Axios |
| Development Tools | Git, GitHub, VS Code |

## 🏗️ Architecture

```text
Zenith AI
│
├── frontend/
│   └── React + Vite
│       ├── Chat Interface
│       ├── Conversation History
│       └── API Integration
│
├── backend/
│   ├── FastAPI Application
│   ├── Authentication
│   ├── AI Chat & Streaming
│   ├── Document Processing
│   └── SQLite Database
│
└── README.md
```

## 🚀 Getting Started

### Prerequisites

- Python 3.11 or later
- Node.js and npm
- Git
- Ollama, if using a locally hosted language model
- Google OAuth credentials for Google sign-in

### 1. Clone the Repository

```bash
git clone https://github.com/tsukishima07/Zenith-AI.git
cd Zenith-AI
```

### 2. Set Up the Backend

```bash
cd backend
python -m venv .venv
```

Activate the virtual environment.

**Windows:**

```bash
.venv\Scripts\activate
```

Install the backend dependencies:

```bash
pip install -r requirements.txt
```

Configure the required environment variables in a `.env` file, including the Google OAuth client ID and client secret, along with any other settings required by the application.

Start the FastAPI server:

```bash
uvicorn app.main:app --reload
```

Backend API documentation is available at:

`http://localhost:8000/docs`

### 3. Set Up the Frontend

Open a new terminal from the project root:

```bash
cd frontend
npm install
npm run dev
```

Open the local URL displayed by Vite, typically:

`http://localhost:5173`

### 4. Configure AI Integration

If using Ollama, install and start Ollama, then configure the language model expected by the backend. Ensure the model name and server settings match your application configuration.

## 🔑 Environment Configuration

Create a `.env` file in the appropriate backend location and configure the required values.

```env
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
SECRET_KEY=your_application_secret
```

Add any additional environment variables required by your implementation.

**Security:** Never commit `.env` files, API keys, OAuth secrets, or sensitive user data to GitHub.

## 📂 Project Structure

```text
Zenith-AI/
├── backend/
│   ├── app/
│   │   └── main.py
│   ├── requirements.txt
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   └── api.js
│   ├── package.json
│   └── index.html
├── .gitignore
└── README.md
```

*Adjust the structure above if your actual repository differs.*

## 🔮 Future Improvements

- Enhanced document retrieval and contextual search
- Improved chat organization and conversation search
- Additional authentication providers
- More advanced AI model integrations
- Deployment with production-ready security and monitoring

## 👨‍💻 Author

**Tsukishima07**

GitHub: [@tsukishima07](https://github.com/tsukishima07)

## 📄 License

Choose and add an appropriate open-source license if you intend to distribute this project publicly.

---

⭐ If you find Zenith AI interesting, consider starring the repository!
