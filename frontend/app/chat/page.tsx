"use client";

import { useState, useCallback } from "react";
import { useChat } from "@/hooks/useChat";
import { Sidebar } from "@/components/layout/Sidebar";
import { ChatWindow } from "@/components/chat/ChatWindow";
import type { Message } from "@/types";

export default function ChatPage() {
  const {
    chats, activeChatId, messages: persistedMessages,
    loadingChats, selectChat, newChat, deleteChat,
    refreshChats, setMessages, setActiveChatId,
  } = useChat();

  const [localMessages, setLocalMessages] = useState<Message[]>([]);

  const displayMessages = activeChatId
    ? (persistedMessages.length > 0 ? persistedMessages : localMessages)
    : localMessages;

  const handleMessageSent = useCallback((userMsg: Message, assistantMsg: Message) => {
    if (userMsg.id === "") {
      const update = (m: Message) =>
        m.isStreaming
          ? { ...m, content: assistantMsg.content, sources: assistantMsg.sources, isStreaming: false }
          : m;
      setLocalMessages((prev) => prev.map(update));
      if (activeChatId) setMessages((prev) => prev.map(update));
    } else {
      setLocalMessages((prev) => [...prev, userMsg, assistantMsg]);
    }
  }, [activeChatId, setMessages]);

  const handleChatCreated = useCallback((chatId: string) => {
    setActiveChatId(chatId);
    refreshChats();
  }, [setActiveChatId, refreshChats]);

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ background: "var(--bg-base)" }}
    >
      <Sidebar activePage="chat">
        {/* New chat button */}
        <div className="px-2 py-2">
          <button
            onClick={() => { setLocalMessages([]); newChat(); }}
            className="w-full px-2.5 py-1.5 font-mono text-sm text-left rounded-md cursor-pointer transition-all duration-150"
            style={{
              color: "var(--text-secondary)",
              background: "transparent",
              border: "1px dashed var(--border-default)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-strong)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-default)";
            }}
          >
            + new chat
          </button>
        </div>

        {/* Chat history */}
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {loadingChats ? (
            <div className="px-2.5 py-3 font-mono text-xs" style={{ color: "var(--text-muted)" }}>
              loading…
            </div>
          ) : chats.length === 0 ? (
            <div className="px-2.5 py-3 font-mono text-xs" style={{ color: "var(--text-muted)" }}>
              no chats yet
            </div>
          ) : (
            chats.map((chat) => (
              <div key={chat.id} className="relative mb-0.5 group">
                <button
                  onClick={() => { setLocalMessages([]); selectChat(chat.id); }}
                  className="w-full px-2.5 py-1.5 pr-7 rounded-md cursor-pointer text-left text-sm truncate block transition-all duration-150"
                  style={{
                    color: activeChatId === chat.id ? "var(--text-primary)" : "var(--text-secondary)",
                    background: activeChatId === chat.id ? "rgba(0,212,255,0.06)" : "transparent",
                    border: activeChatId === chat.id
                      ? "1px solid rgba(0,212,255,0.20)"
                      : "1px solid transparent",
                  }}
                >
                  {chat.title}
                </button>
                <button
                  onClick={() => deleteChat(chat.id)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded text-xs cursor-pointer opacity-0 group-hover:opacity-100 transition-all duration-150"
                  style={{
                    color: "var(--text-muted)",
                    background: "transparent",
                    border: "none",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.color = "var(--accent-red)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
                  }}
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>
      </Sidebar>

      {/* Main content — offset on mobile to account for hamburger button */}
      <main className="flex-1 overflow-hidden flex flex-col pt-0 md:pt-0">
        {/* Mobile top bar — gives breathing room below hamburger */}
        <div
          className="md:hidden h-12 shrink-0 flex items-center px-14 border-b"
          style={{
            background: "var(--bg-surface)",
            borderColor: "var(--border-subtle)",
          }}
        >
          <span className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>
            Neural Search Engine
          </span>
        </div>

        <div className="flex-1 overflow-hidden">
          <ChatWindow
            messages={displayMessages}
            activeChatId={activeChatId}
            onMessageSent={handleMessageSent}
            onChatCreated={handleChatCreated}
            onStreamDone={refreshChats}
          />
        </div>
      </main>
    </div>
  );
}