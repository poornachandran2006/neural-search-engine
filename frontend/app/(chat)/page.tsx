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
        m.isStreaming ? { ...m, content: assistantMsg.content, sources: assistantMsg.sources, isStreaming: false } : m;
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
    <div className="flex h-screen bg-bg-base">
      <Sidebar activePage="chat">
        {/* New chat button */}
        <div className="px-2 py-2">
          <button
            onClick={() => { setLocalMessages([]); newChat(); }}
            className="w-full px-2.5 py-1.5 font-mono text-sm text-text-secondary bg-transparent border border-dashed border-border-default rounded-md cursor-pointer hover:border-border-strong hover:text-text-primary transition-all duration-150 text-left"
          >
            + new chat
          </button>
        </div>

        {/* Chat history */}
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {loadingChats ? (
            <div className="px-2.5 py-3 font-mono text-xs text-text-muted">loading…</div>
          ) : chats.length === 0 ? (
            <div className="px-2.5 py-3 font-mono text-xs text-text-muted">no chats yet</div>
          ) : (
            chats.map((chat) => (
              <div key={chat.id} className="relative mb-0.5 group">
                <button
                  onClick={() => { setLocalMessages([]); selectChat(chat.id); }}
                  className={`w-full px-2.5 py-1.5 pr-7 rounded-md cursor-pointer text-left text-sm truncate block border transition-all duration-150
                    ${activeChatId === chat.id
                      ? "text-text-primary bg-accent-cyan/[0.06] border-accent-cyan/20"
                      : "text-text-secondary bg-transparent border-transparent hover:bg-bg-hover hover:text-text-primary"
                    }`}
                >
                  {chat.title}
                </button>
                <button
                  onClick={() => deleteChat(chat.id)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded text-text-muted text-xs bg-transparent border-none cursor-pointer opacity-0 group-hover:opacity-100 hover:text-accent-red transition-all duration-150"
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>
      </Sidebar>

      <main className="flex-1 overflow-hidden">
        <ChatWindow
          messages={displayMessages}
          activeChatId={activeChatId}
          onMessageSent={handleMessageSent}
          onChatCreated={handleChatCreated}
          onStreamDone={refreshChats}
        />
      </main>
    </div>
  );
}