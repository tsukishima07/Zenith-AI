import axios from "axios";

const api = axios.create({
  baseURL: "http://127.0.0.1:8000",
  headers: {
    "Content-Type": "application/json",
  },
});

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

export const sendMessage = async (
  conversationId,
  message,
  history = []
) => {
  const response = await api.post("/chat", {
    conversation_id: conversationId,
    message: message,
    history: history,
  });

  return response.data;
};

export default api;