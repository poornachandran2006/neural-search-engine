"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Chat, Message } from "@/types";

export function useChat() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Load chat list on mount
  useEffect(() => {
    api.chats
      .list()
      .then(setChats)
      .catch(console.error)
      .finally(() => setLoadingChats(false));
  }, []);

  // Load messages when active chat changes
  useEffect(() => {
    if (!activeChatId) {
      setMessages([]);
      return;
    }
    setLoadingMessages(true);
    api.chats
      .messages(activeChatId)
      .then(setMessages)
      .catch(console.error)
      .finally(() => setLoadingMessages(false));
  }, [activeChatId]);

  const selectChat = useCallback((id: string) => {
    setActiveChatId(id);
  }, []);

  const newChat = useCallback(() => {
    setActiveChatId(null);
    setMessages([]);
  }, []);

  const deleteChat = useCallback(
    async (id: string) => {
      await api.chats.delete(id);
      setChats((prev) => prev.filter((c) => c.id !== id));
      if (activeChatId === id) {
        setActiveChatId(null);
        setMessages([]);
      }
    },
    [activeChatId]
  );

  // Called by ChatWindow after a stream completes to refresh the list
  const refreshChats = useCallback(() => {
    api.chats.list().then(setChats).catch(console.error);
  }, []);

  const submitFeedback = useCallback(
    async (messageId: string, rating: 1 | -1) => {
      if (!activeChatId) return;
      await api.chats.submitFeedback(activeChatId, messageId, rating);
    },
    [activeChatId]
  );

  return {
    chats,
    activeChatId,
    messages,
    loadingChats,
    loadingMessages,
    selectChat,
    newChat,
    deleteChat,
    refreshChats,
    setMessages,
    setActiveChatId,
    submitFeedback,
  };
}