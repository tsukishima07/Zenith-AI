import axios from "axios";

const API_BASE_URL = "http://localhost:8000";

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

// =========================================
// CONVERSATIONS
// =========================================

export const createConversation = async () => {
  const response = await api.post("/conversations");
  return response.data;
};

export const getConversations = async () => {
  const response = await api.get("/conversations");
  return response.data;
};

export const getConversationMessages = async (
  conversationId
) => {
  const response = await api.get(
    `/conversations/${conversationId}/messages`
  );

  return response.data;
};

// =========================================
// CHAT
// =========================================

export const sendMessage = async (
  conversationId,
  message,
  history = [],
  documentText = ""
) => {
  const response = await api.post("/chat", {
    conversation_id: conversationId,
    message,
    history,
    document_text: documentText,
  });

  return response.data;
};

// =========================================
// STREAMING CHAT
// =========================================

export const streamMessage = async (
  conversationId,
  message,
  history = [],
  documentText = "",
  onChunk
) => {
  const response = await fetch(
    `${API_BASE_URL}/chat/stream`,
    {
      method: "POST",

      credentials: "include",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        conversation_id: conversationId,
        message,
        history,
        document_text: documentText,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(
      `Streaming request failed: ${response.status}`
    );
  }

  if (!response.body) {
    throw new Error(
      "Streaming is not supported by this browser."
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { value, done } =
      await reader.read();

    if (done) {
      break;
    }

    const chunk = decoder.decode(value, {
      stream: true,
    });

    if (chunk) {
      onChunk(chunk);
    }
  }
};

// =========================================
// DOCUMENT UPLOAD
// =========================================

export const uploadFile = async (
  file,
  conversationId
) => {
  const formData = new FormData();

  formData.append("file", file);

  formData.append(
    "conversation_id",
    String(conversationId)
  );

  const response = await api.post(
    "/upload",
    formData
  );

  return response.data;
};
// =========================================
// DOCUMENT LIBRARY
// =========================================

export const getConversationDocuments = async (
  conversationId
) => {
  const response = await api.get(
    `/conversations/${conversationId}/documents`
  );

  return response.data;
};
// =========================================
// DELETE DOCUMENT
// =========================================

export const deleteDocument = async (
  documentId
) => {
  const response = await api.delete(
    `/documents/${documentId}`
  );

  return response.data;
};
// =========================================
// GOOGLE LOGIN
// =========================================

export const googleLogin = () => {
  window.location.href =
    `${API_BASE_URL}/auth/google`;
};

// =========================================
// CURRENT USER
// =========================================

export const getCurrentUser = async () => {
  const response = await api.get("/auth/me");

  return response.data;
};

// =========================================
// LOGOUT
// =========================================

export const logout = async () => {
  const response = await api.post(
    "/auth/logout"
  );

  return response.data;
};
// =========================================
// RENAME CONVERSATION
// =========================================

export const renameConversation = async (
  conversationId,
  title
) => {
  const formData = new FormData();

  formData.append("title", title);

  const response = await api.put(
    `/conversations/${conversationId}`,
    formData
  );

  return response.data;
};


// =========================================
// DELETE CONVERSATION
// =========================================

export const deleteConversation = async (
  conversationId
) => {
  const response = await api.delete(
    `/conversations/${conversationId}`
  );

  return response.data;
};
export default api;