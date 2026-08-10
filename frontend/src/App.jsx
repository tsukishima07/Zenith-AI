import { useState } from "react";
import "./App.css";
import { sendMessage } from "./services/api";

function App() {
  const [message, setMessage] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!message.trim() || loading) {
      return;
    }

    try {
      setLoading(true);
      setResponse("");

      const data = await sendMessage(message);

      setResponse(data.response);
    } catch (error) {
      console.error("Failed to send message:", error);
      setResponse("Sorry, I couldn't connect to Zenith.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  return (
    <main className="zenith">
      {/* Top Navigation */}
      <header className="topbar">
        <div className="brand">
          <span className="brand-symbol">✦</span>
          <span>ZENITH</span>
        </div>

        <div className="status">
          <span className="status-dot"></span>
          LOCAL AI ONLINE
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero">
        {/* Zenith Core */}
        <div className="zenith-core">
          <div className="core-ring ring-one"></div>
          <div className="core-ring ring-two"></div>
          <div className="core-center">✦</div>
        </div>

        <p className="eyebrow">YOUR INTELLIGENT WORKSPACE</p>

        <h1>What will you discover today?</h1>

        <p className="hero-description">
          Ask questions, explore ideas, analyze documents, or build something
          new with Zenith.
        </p>

        {/* AI Response */}
        {response && (
          <div className="response-card">
            <div className="response-label">ZENITH</div>

            <p>{response}</p>
          </div>
        )}
      </section>

      {/* Quick Actions */}
      {!response && (
        <section className="quick-actions">
          <button
            className="action-card"
            onClick={() =>
              setMessage("Teach me something interesting")
            }
          >
            <span>✦</span>
            <strong>Explore</strong>
            <small>Learn something new</small>
          </button>

          <button
            className="action-card"
            onClick={() =>
              setMessage("Help me create something")
            }
          >
            <span>◇</span>
            <strong>Create</strong>
            <small>Turn ideas into reality</small>
          </button>

          <button
            className="action-card"
            onClick={() =>
              setMessage("Analyze this concept for me")
            }
          >
            <span>◎</span>
            <strong>Analyze</strong>
            <small>Understand complex topics</small>
          </button>

          <button
            className="action-card"
            onClick={() =>
              setMessage("How can you help me with documents?")
            }
          >
            <span>▱</span>
            <strong>Documents</strong>
            <small>Chat with your knowledge</small>
          </button>
        </section>
      )}

      {/* Prompt Area */}
      <section className="prompt-area">
        <div className="prompt-box">
          <input
            type="text"
            placeholder={
              loading
                ? "Zenith is thinking..."
                : "Ask Zenith anything..."
            }
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
          />

          <button
            className="send-button"
            aria-label="Send message"
            onClick={handleSend}
            disabled={loading || !message.trim()}
          >
            {loading ? "..." : "↑"}
          </button>
        </div>

        <p className="prompt-hint">
          Powered locally by Qwen 2.5 · Your data stays on your machine
        </p>
      </section>
    </main>
  );
}

export default App;