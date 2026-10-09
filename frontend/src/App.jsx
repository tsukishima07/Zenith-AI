import {
  useEffect,
  useState,
  useRef,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

import "./App.css";

import {
  createConversation,
  getConversations,
  getConversationMessages,
  getConversationDocuments,
  sendMessage,
  streamMessage,
  uploadFile,
  googleLogin,
  getCurrentUser,
  logout,
  renameConversation,
  deleteConversation,
  deleteDocument,
} from "./api";

function MarkdownMessage({ content }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (code) => {
    try {
      await navigator.clipboard.writeText(code);

      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 2000);

    } catch (error) {
      console.error(
        "Failed to copy code:",
        error
      );
    }
  };


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

          const code = String(children).replace(
            /\n$/,
            ""
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
                      handleCopy(code)
                    }
                  >

                    {copied
                      ? "✓ Copied"
                      : "Copy"}

                  </button>

                </div>


                <SyntaxHighlighter
                  style={oneDark}
                  language={match[1]}
                  PreTag="div"
                  {...props}
                >
                  {code}
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

  const fileInputRef = useRef(null);

  const [conversations, setConversations] = useState([]);

  const [conversationId, setConversationId] = useState(null);

  const [loading, setLoading] = useState(false);

  const [initializing, setInitializing] = useState(true);

  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploading, setUploading] = useState(false);


  const [documents, setDocuments] = useState([]);
  const [documentsLoading, setDocumentsLoading] = useState(false); 
  const [selectedDocument, setSelectedDocument] = useState(null);

  const [isListening, setIsListening] = useState(false);
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem("zenith_user");

    try {
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });

  const [showProfile, setShowProfile] = useState(false);
useEffect(() => {
  const params = new URLSearchParams(
    window.location.search
  );

  const token = params.get("token");
  const userId = params.get("user_id");
  const username = params.get("username");
  const email = params.get("email");

  if (token && userId && username && email) {
    const loggedInUser = {
      id: Number(userId),
      username,
      email,
    };

    localStorage.setItem(
      "zenith_token",
      token
    );

    localStorage.setItem(
      "zenith_user",
      JSON.stringify(loggedInUser)
    );

    setUser(loggedInUser);

    // Remove token/user data from URL
    window.history.replaceState(
      {},
      document.title,
      window.location.pathname
    );
  }
}, []);

  const [theme, setTheme] = useState(
    localStorage.getItem("zenith-theme") || "dark"
  );

  // =========================================
  // INITIALIZE ZENITH
  // =========================================

  useEffect(() => {
    initializeZenith();
  }, []);

  const handleLogout = async () => {
  try {
    await logout();

    setUser(null);

    // Optional: clear local frontend state
    setMessages([]);
    setConversationId(null);
    setConversations([]);
    setDocuments([]);
    setSelectedDocument(null);
    setUploadedFile(null);

  } catch (error) {
    console.error(
      "Logout failed:",
      error
    );
  }
};
  const initializeZenith = async () => {
    try {
      setInitializing(true);

      const savedConversations =
        await getConversations();

      if (!Array.isArray(savedConversations)) {
        setConversations([]);
        setConversationId(null);
        setMessages([]);
        setDocuments([]);
        setSelectedDocument(null);
        return;
      }

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

        await loadConversationDocuments(
          latestConversation.id
        );

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
  useEffect(() => {
  document.documentElement.setAttribute(
    "data-theme",
    theme
  );

  localStorage.setItem(
    "zenith-theme",
    theme
  );
}, [theme]);
  useEffect(() => {
  const loadUser = async () => {
    try {
      const data = await getCurrentUser();

      if (data.authenticated) {
        setUser(data.user);
      }
    } catch (error) {
      console.error(
        "Failed to load user:",
        error
      );
    }
  };

  loadUser();
}, []);
  useEffect(() => {
  const loadUser = async () => {
    try {
      const data = await getCurrentUser();

      if (data.authenticated) {
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error(
        "Failed to load current user:",
        error
      );

      setUser(null);
    }
  };

  loadUser();
}, []);

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
      setDocuments([]);
      setSelectedDocument(null);
      setUploadedFile(null);

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
const handleFileUpload = async (event) => {
  const files = Array.from(
    event.target.files || []
  );

  if (!files.length || !conversationId) {
    return;
  }

  setUploading(true);

  try {
    for (const file of files) {
      console.log(
        `Uploading ${file.name}...`
      );

      const data = await uploadFile(
        file,
        conversationId
      );

      if (data.error) {
        throw new Error(data.error);
      }

      console.log(
        `${file.name} uploaded successfully`
      );
    }

    await loadConversationDocuments(
      conversationId
    );

    alert(
      `${files.length} document${
        files.length === 1 ? "" : "s"
      } uploaded successfully.`
    );

  } catch (error) {
    console.error(
      "Document upload failed:",
      error
    );

    console.error(
      "Response:",
      error.response?.data
    );

    console.error(
      "Status:",
      error.response?.status
    );

    alert(
      error.response?.data?.error ||
      error.response?.data?.detail ||
      error.message ||
      "One or more documents failed to upload."
    );

  } finally {
    setUploading(false);

    event.target.value = "";
  }
};
const handleVoiceInput = () => {
  const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    alert(
      "Voice input is not supported by this browser. Please use Google Chrome."
    );
    return;
  }

  if (isListening) {
    return;
  }

  const recognition = new SpeechRecognition();

  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.continuous = false;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    console.log("Zenith voice input started");
    setIsListening(true);
  };

  recognition.onresult = (event) => {
    const transcript =
      event.results[0][0].transcript;

    setMessage((current) => {
      if (!current.trim()) {
        return transcript;
      }

      return `${current} ${transcript}`;
    });
  };

  recognition.onerror = (event) => {
    console.error(
      "Zenith voice recognition error:",
      event.error
    );

    setIsListening(false);

    if (event.error === "not-allowed") {
      alert(
        "Microphone permission was denied. Please allow microphone access for Zenith in Chrome."
      );
    } else if (event.error === "no-speech") {
      alert("I didn't hear anything. Please try again.");
    } else if (event.error === "audio-capture") {
      alert(
        "No microphone was detected. Please check your microphone."
      );
    } else {
      alert(
        `Voice input failed: ${event.error}`
      );
    }
  };

  recognition.onend = () => {
    console.log("Zenith voice input ended");
    setIsListening(false);
  };

  try {
    recognition.start();
  } catch (error) {
    console.error(
      "Failed to start voice recognition:",
      error
    );

    setIsListening(false);
  }
};

const handleSend = async () => {
  if (
    !message.trim() ||
    loading ||
    !conversationId
  ) {
    return;
  }

  const userMessage = message.trim();

  const userMessageObject = {
    role: "user",
    content: userMessage,
    attachment: uploadedFile
      ? {
          name: uploadedFile.name,
          type: uploadedFile.type,
          characters: uploadedFile.characters,
        }
      : null,
  };

  const updatedMessages = [
    ...messages,
    userMessageObject,
  ];

  // Immediately display user message
  setMessages(updatedMessages);

  // Clear input
  setMessage("");

  // Create an empty assistant message immediately
  const assistantMessage = {
    role: "assistant",
    content: "",
    webSearch: false,
    sources: [],
  };

  setMessages([
    ...updatedMessages,
    assistantMessage,
  ]);

  try {
    setLoading(true);

    let streamedResponse = "";

    await streamMessage(
  conversationId,
  userMessage,
  messages,
  "",
      (chunk) => {
        streamedResponse += chunk;

        setMessages([
          ...updatedMessages,
          {
            ...assistantMessage,
            content: streamedResponse,
          },
        ]);
      }
    );

    // Remove uploaded file after sending
    setUploadedFile(null);

    // Refresh conversations
    const updatedConversations =
      await getConversations();

    setConversations(
      updatedConversations
    );

  } catch (error) {
    console.error(
      "Failed to stream message:",
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

        await loadConversationDocuments(id);

        setSelectedDocument(null);
        setUploadedFile(null);

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
  const loadConversationDocuments = async (id) => {
  if (!id) {
    setDocuments([]);
    return;
  }

  try {
    setDocumentsLoading(true);

    const data =
      await getConversationDocuments(id);

    setDocuments(
      Array.isArray(data) ? data : []
    );
  } catch (error) {
    console.error(
      "Failed to load documents:",
      error
    );

    setDocuments([]);
  } finally {
    setDocumentsLoading(false);
  }
};
  const handleRenameConversation = async (
  event,
  conversation
) => {
  event.stopPropagation();

  const newTitle = window.prompt(
    "Rename conversation:",
    conversation.title
  );

  if (
    newTitle === null ||
    !newTitle.trim() ||
    newTitle.trim() === conversation.title
  ) {
    return;
  }

  try {
    const updated = await renameConversation(
      conversation.id,
      newTitle.trim()
    );

    setConversations((previous) =>
      previous.map((item) =>
        item.id === conversation.id
          ? {
              ...item,
              title: updated.title,
            }
          : item
      )
    );
  } catch (error) {
    console.error(
      "Failed to rename conversation:",
      error
    );

    alert("Failed to rename conversation.");
  }
};
const handleDeleteDocument = async (
  event,
  documentId
) => {
  event.stopPropagation();

  const confirmed = window.confirm(
    "Are you sure you want to delete this document?"
  );

  if (!confirmed) {
    return;
  }

  try {
    await deleteDocument(documentId);

    setDocuments((previous) =>
      previous.filter(
        (document) =>
          document.id !== documentId
      )
    );

    if (
      selectedDocument &&
      selectedDocument.id === documentId
    ) {
      setSelectedDocument(null);
    }

  } catch (error) {
    console.error(
      "Failed to delete document:",
      error
    );

    alert("Failed to delete document.");
  }
};
const handleDeleteConversation = async (
  event,
  id
) => {
  event.stopPropagation();

  const confirmed = window.confirm(
    "Are you sure you want to delete this conversation?"
  );

  if (!confirmed) {
    return;
  }

  try {
    await deleteConversation(id);

    setConversations((previous) =>
      previous.filter(
        (conversation) =>
          conversation.id !== id
      )
    );

    if (conversationId === id) {
      const remaining =
        conversations.filter(
          (conversation) =>
            conversation.id !== id
        );

      if (remaining.length > 0) {
        const nextConversation =
          remaining[0];

        setConversationId(
          nextConversation.id
        );

        const savedMessages =
          await getConversationMessages(
            nextConversation.id
          );

        setMessages(savedMessages);

        await loadConversationDocuments(
          nextConversation.id
        );

        setSelectedDocument(null);
        setUploadedFile(null);

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
    }
  } catch (error) {
    console.error(
      "Failed to delete conversation:",
      error
    );

    alert("Failed to delete conversation.");
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
  className="theme-button"
  onClick={() =>
    setTheme((current) =>
      current === "dark"
        ? "light"
        : "dark"
    )
  }
  title="Toggle theme"
>
  {theme === "dark" ? "☀️" : "🌙"}
</button>
{!user && (
  <button
    className="google-login-button"
    onClick={googleLogin}
  >
    <span>G</span>
    Continue with Google
  </button>
)}

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
{user && (
  <>
    <div
      className="user-profile"
      onClick={() =>
        setShowProfile((current) => !current)
      }
    >
      <div className="user-avatar">
        {user?.username
          ? user.username.charAt(0).toUpperCase()
          : "V"}
      </div>

      <div className="user-info">
        <strong>
          {user?.username || "User"}
        </strong>

        <span>
          {user?.email || ""}
        </span>
      </div>
    </div>

    {showProfile && (
      <div className="profile-menu">
        <div className="profile-menu-header">
          <div className="profile-avatar-large">
            {user?.username
              ? user.username.charAt(0).toUpperCase()
              : "V"}
          </div>

          <div>
            <strong>
              {user?.username || "User"}
            </strong>

            <span>
              {user?.email || ""}
            </span>
          </div>
        </div>

        <button
          className="logout-button"
          onClick={handleLogout}
        >
          <span>↪</span>
          Log out
        </button>
      </div>
    )}
  </>
)}
<div className="sidebar-section document-library">

  <p className="sidebar-title">
    DOCUMENTS
  </p>

  {documentsLoading ? (
    <div className="documents-empty">
      Loading documents...
    </div>
  ) : documents.length === 0 ? (
    <div className="documents-empty">
      No documents yet
    </div>
  ) : (
    <div className="document-list">

      {documents.map((document) => (
  <div
    key={document.id}
    className="document-item"
  >

    <button
      type="button"
      className="document-open-button"
      onClick={() =>
        setSelectedDocument(document)
      }
    >

      <div className="document-icon">
        📄
      </div>

      <div className="document-info">

        <strong title={document.filename}>
          {document.filename}
        </strong>

        <span>
          {document.characters?.toLocaleString() || 0}
          {" "}characters
        </span>

      </div>

    </button>

    <button
      type="button"
      className="document-delete-button"
      onClick={(event) =>
        handleDeleteDocument(
          event,
          document.id
        )
      }
      title="Delete document"
    >
      ×
    </button>

  </div>
))}

    </div>
  )}

</div>
          <div className="sidebar-section">

            <p className="sidebar-title">
              RECENT
            </p>


            <div className="conversation-list">

  {conversations.map(
    (conversation) => (

      <div
        key={conversation.id}
        className={
          `conversation-item-wrapper ${
            conversation.id === conversationId
              ? "active"
              : ""
          }`
        }
      >

        <button
          className="conversation-item"
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

        <div className="conversation-actions">

          <button
            type="button"
            className="conversation-action rename-action"
            onClick={(event) =>
              handleRenameConversation(
                event,
                conversation
              )
            }
            title="Rename conversation"
          >
            ✎
          </button>

          <button
            type="button"
            className="conversation-action delete-action"
            onClick={(event) =>
              handleDeleteConversation(
                event,
                conversation.id
              )
            }
            title="Delete conversation"
          >
            ×
          </button>

        </div>

      </div>

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

  {msg.attachment && (
    <div className="message-attachment">

      <div className="message-attachment-icon">
        📄
      </div>

      <div className="message-attachment-info">

        <strong>
          {msg.attachment.name}
        </strong>

        <span>
          {msg.attachment.characters?.toLocaleString()} characters
        </span>

      </div>

    </div>
  )}

  <MarkdownMessage
    content={msg.content}
  />
  {msg.webSearch && msg.sources?.length > 0 && (
  <div className="web-sources">

    <div className="web-sources-title">
      🌐 Sources
    </div>

    <div className="web-sources-list">

      {msg.sources.map((source, index) => (
        <a
          key={index}
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="web-source"
        >
          <span className="web-source-number">
            {index + 1}
          </span>

          <span className="web-source-title">
            {source.title}
          </span>

          <span className="web-source-arrow">
            ↗
          </span>
        </a>
      ))}

    </div>

  </div>
)}

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
          {uploading && (
  <div className="upload-status">
    <span className="upload-spinner"></span>
    Reading document...
  </div>
)}

{documents.length > 0 && !uploading && (
  <div className="document-context-status">

    <span>
      📚
    </span>

    <span>
      {documents.length} document
      {documents.length === 1 ? "" : "s"}
      available to Zenith
    </span>

  </div>
)}

            <div className="prompt-box">
            <button
  type="button"
  className={`voice-button ${
    isListening ? "listening" : ""
  }`}
  onClick={handleVoiceInput}
  disabled={loading || uploading}
  title={
    isListening
      ? "Listening..."
      : "Voice input"
  }
>
  {isListening ? "●" : "🎙️"}
</button>
            <label
  className="upload-button"
  title="Upload document"
>
  📎

  <input
  ref={fileInputRef}
  type="file"
  accept=".pdf,.docx,.txt"
  multiple
  onChange={handleFileUpload}
  hidden
/>
</label>

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
{selectedDocument && (
  <div
    className="document-preview-overlay"
    onClick={() =>
      setSelectedDocument(null)
    }
  >
    <div
      className="document-preview"
      onClick={(event) =>
        event.stopPropagation()
      }
    >

      <div className="document-preview-header">

        <div className="document-preview-title">

          <div className="document-preview-icon">
            📄
          </div>

          <div>
            <strong>
              {selectedDocument.filename}
            </strong>

            <span>
              {selectedDocument.file_type?.toUpperCase()}
              {" · "}
              {selectedDocument.characters?.toLocaleString() || 0}
              {" characters"}
            </span>
          </div>

        </div>

        <button
          type="button"
          className="document-preview-close"
          onClick={() =>
            setSelectedDocument(null)
          }
          aria-label="Close document"
        >
          ×
        </button>

      </div>

      <div className="document-preview-content">
        <pre>
          {selectedDocument.text ||
            "No extracted text available."}
        </pre>
      </div>

    </div>
  </div>
)}
    </main>
  );
}
export default App;