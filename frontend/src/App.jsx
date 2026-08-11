import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

import "./App.css";

import {
  createConversation,
  getConversations,
  getConversationMessages,
  sendMessage,
} from "./services/api";

function MarkdownMessage({ content }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({
          inline,
          className,
          children,
          ...props
        }) {
          const match =
            /language-(\w+)/.exec(
              className || ""
            );

          if (!inline && match) {
            return (
              <div className="code-block">

                <div className="code-header">

                  <span>
                    {match[1]}
                  </span>

                  <button
                    onClick={() =>
                      navigator.clipboard.writeText(
                        String(children).replace(
                          /\n$/,
                          ""
                        )
                      )
                    }
                  >
                    Copy
                  </button>

                </div>

                <SyntaxHighlighter
                  style={oneDark}
                  language={match[1]}
                  PreTag="div"
                  {...props}
                >
                  {String(children).replace(
                    /\n$/,
                    ""
                  )}
                </SyntaxHighlighter>

              </div>
            );
          }

          return (
            <code
              className="inline-code"
              {...props}
            >
              {children}
            </code>
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

function App() {
  const [message, setMessage] = useState("");

  const [messages, setMessages] = useState([]);

  const [conversations, setConversations] = useState([]);

  const [conversationId, setConversationId] = useState(null);

  const [loading, setLoading] = useState(false);

  const [initializing, setInitializing] = useState(true);


  // =========================================
  // INITIALIZE ZENITH
  // =========================================

  useEffect(() => {
    initializeZenith();
  }, []);


  const initializeZenith = async () => {
    try {
      setInitializing(true);

      const savedConversations =
        await getConversations();

      setConversations(savedConversations);

      if (savedConversations.length > 0) {
        const latestConversation =
          savedConversations[0];

        setConversationId(
          latestConversation.id
        );

        const savedMessages =
          await getConversationMessages(
            latestConversation.id
          );

        setMessages(savedMessages);

      } else {
        const newConversation =
          await createConversation();

        setConversationId(
          newConversation.id
        );

        setConversations([
          newConversation,
        ]);

        setMessages([]);
      }

    } catch (error) {
      console.error(
        "Failed to initialize Zenith:",
        error
      );

    } finally {
      setInitializing(false);
    }
  };


  // =========================================
  // CREATE NEW CONVERSATION
  // =========================================

  const handleNewConversation = async () => {
    if (loading) {
      return;
    }

    try {
      const newConversation =
        await createConversation();

      setConversationId(
        newConversation.id
      );

      setMessages([]);

      setConversations((previous) => [
        newConversation,
        ...previous,
      ]);

    } catch (error) {
      console.error(
        "Failed to create conversation:",
        error
      );
    }
  };


  // =========================================
  // SEND MESSAGE
  // =========================================

  const handleSend = async () => {
    if (
      !message.trim() ||
      loading ||
      !conversationId
    ) {
      return;
    }

    const userMessage = message.trim();

    const updatedMessages = [
      ...messages,
      {
        role: "user",
        content: userMessage,
      },
    ];

    // Immediately display user message
    setMessages(updatedMessages);

    // Clear input
    setMessage("");

    try {
      setLoading(true);

      // Send message to backend
      const data = await sendMessage(
        conversationId,
        userMessage,
        messages
      );

      const assistantMessage = {
        role: "assistant",
        content: data.response,
      };

      // Display assistant response
      setMessages([
        ...updatedMessages,
        assistantMessage,
      ]);


      // =====================================
      // REFRESH CONVERSATIONS
      // =====================================

      const updatedConversations =
        await getConversations();

      setConversations(
        updatedConversations
      );

    } catch (error) {
      console.error(
        "Failed to send message:",
        error
      );

      setMessages([
        ...updatedMessages,
        {
          role: "assistant",
          content:
            "Sorry, I couldn't connect to Zenith.",
        },
      ]);

    } finally {
      setLoading(false);
    }
  };


  // =========================================
  // KEYBOARD INPUT
  // =========================================

  const handleKeyDown = (event) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();

      handleSend();
    }
  };


  // =========================================
  // QUICK ACTION
  // =========================================

  const handleQuickAction = (prompt) => {
    setMessage(prompt);
  };


  // =========================================
  // SELECT CONVERSATION
  // =========================================

  const handleSelectConversation =
    async (id) => {

      if (loading) {
        return;
      }

      try {
        setLoading(true);

        setConversationId(id);

        const savedMessages =
          await getConversationMessages(id);

        setMessages(savedMessages);

      } catch (error) {
        console.error(
          "Failed to load conversation:",
          error
        );

        setMessages([]);

      } finally {
        setLoading(false);
      }
    };


  // =========================================
  // INITIALIZING SCREEN
  // =========================================

  if (initializing) {
    return (
      <main className="zenith">

        <div className="initializing">

          <div className="zenith-core">

            <div className="core-ring ring-one"></div>

            <div className="core-ring ring-two"></div>

            <div className="core-center">
              ✦
            </div>

          </div>

          <p>
            INITIALIZING ZENITH
          </p>

        </div>

      </main>
    );
  }


  // =========================================
  // MAIN UI
  // =========================================

  return (
    <main className="zenith">


      {/* =====================================
          TOP BAR
          ===================================== */}

      <header className="topbar">

        <div className="brand">

          <span className="brand-symbol">
            ✦
          </span>

          <span>
            ZENITH
          </span>

        </div>


        <div className="status">

          <span className="status-dot"></span>

          LOCAL AI ONLINE

        </div>

      </header>


      {/* =====================================
          MAIN LAYOUT
          ===================================== */}

      <div className="zenith-layout">


        {/* ===================================
            SIDEBAR
            =================================== */}

        <aside className="sidebar">


          <button
            className="new-chat-button"
            onClick={
              handleNewConversation
            }
          >

            <span>
              ＋
            </span>

            New Session

          </button>


          <div className="sidebar-section">

            <p className="sidebar-title">
              RECENT
            </p>


            <div className="conversation-list">

              {conversations.map(
                (conversation) => (

                  <button
                    key={conversation.id}
                    className={
                      `conversation-item ${
                        conversation.id ===
                        conversationId
                          ? "active"
                          : ""
                      }`
                    }
                    onClick={() =>
                      handleSelectConversation(
                        conversation.id
                      )
                    }
                  >

                    <span className="conversation-icon">
                      ◇
                    </span>

                    <span className="conversation-title">

                      {conversation.title}

                    </span>

                  </button>

                )
              )}

            </div>

          </div>

        </aside>


        {/* ===================================
            CHAT AREA
            =================================== */}

        <section className="chat-area">


          {/* =================================
              HERO
              ================================= */}

          {messages.length === 0 ? (

            <section className="hero">

              <div className="zenith-core">

                <div className="core-ring ring-one"></div>

                <div className="core-ring ring-two"></div>

                <div className="core-center">
                  ✦
                </div>

              </div>


              <p className="eyebrow">
                YOUR INTELLIGENT WORKSPACE
              </p>


              <h1>
                What will you discover today?
              </h1>


              <p className="hero-description">

                Ask questions, explore ideas,
                analyze documents, or build
                something new with Zenith.

              </p>

            </section>

          ) : (

            <section className="conversation">

              {messages.map(
                (msg, index) => (

                  <div
                    key={
                      msg.id || index
                    }
                    className={
                      `message ${
                        msg.role === "user"
                          ? "user-message"
                          : "assistant-message"
                      }`
                    }
                  >

                    <div className="message-label">

                      {msg.role === "user"
                        ? "YOU"
                        : "ZENITH"}

                    </div>


                    <div className="message-content">

  <MarkdownMessage
    content={msg.content}
  />

</div>

                  </div>

                )
              )}


              {loading && (

                <div className="message assistant-message">

                  <div className="message-label">
                    ZENITH
                  </div>


                  <div className="thinking">

                    <span></span>
                    <span></span>
                    <span></span>

                  </div>

                </div>

              )}

            </section>

          )}


          {/* =================================
              QUICK ACTIONS
              ================================= */}

          {messages.length === 0 && (

            <section className="quick-actions">


              <button
                className="action-card"
                onClick={() =>
                  handleQuickAction(
                    "Teach me something interesting"
                  )
                }
              >

                <span>
                  ✦
                </span>

                <strong>
                  Explore
                </strong>

                <small>
                  Learn something new
                </small>

              </button>


              <button
                className="action-card"
                onClick={() =>
                  handleQuickAction(
                    "Help me create something"
                  )
                }
              >

                <span>
                  ◇
                </span>

                <strong>
                  Create
                </strong>

                <small>
                  Turn ideas into reality
                </small>

              </button>


              <button
                className="action-card"
                onClick={() =>
                  handleQuickAction(
                    "Analyze this concept for me"
                  )
                }
              >

                <span>
                  ◎
                </span>

                <strong>
                  Analyze
                </strong>

                <small>
                  Understand complex topics
                </small>

              </button>


              <button
                className="action-card"
                onClick={() =>
                  handleQuickAction(
                    "How can you help me with documents?"
                  )
                }
              >

                <span>
                  ▱
                </span>

                <strong>
                  Documents
                </strong>

                <small>
                  Chat with your knowledge
                </small>

              </button>

            </section>

          )}


          {/* =================================
              PROMPT
              ================================= */}

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
                onChange={(event) =>
                  setMessage(
                    event.target.value
                  )
                }
                onKeyDown={handleKeyDown}
                disabled={loading}
              />


              <button
                className="send-button"
                aria-label="Send message"
                onClick={handleSend}
                disabled={
                  loading ||
                  !message.trim() ||
                  !conversationId
                }
              >

                {loading
                  ? "..."
                  : "↑"}

              </button>

            </div>


            <p className="prompt-hint">

              Powered locally by Qwen 2.5 ·
              Your data stays on your machine

            </p>

          </section>

        </section>

      </div>

    </main>
  );
}


export default App;