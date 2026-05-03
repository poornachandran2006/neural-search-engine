"use client";

import { useState } from "react";
import type { Message } from "@/types";
import { SourceCard } from "./SourceCard";

interface Props { message: Message }

export function MessageBubble({ message }: Props) {
  const [showSources, setShowSources] = useState(false);
  const isUser     = message.role === "user";
  const hasSources = message.sources && message.sources.length > 0;

  if (isUser) {
    return (
      <div className="animate-fade-in flex justify-end">
        <div
          className="max-w-[72%] rounded-2xl rounded-br-sm px-4 py-2.5 text-lg leading-relaxed transition-all duration-200"
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-default)",
            color: "var(--text-primary)",
          }}
        >
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in flex flex-col gap-2">
      {/* Bubble */}
      <div
        className="max-w-[88%] rounded-2xl rounded-tl-sm px-4 py-3 transition-all duration-200"
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
        }}
      >
        <div className="w-6 h-0.5 rounded-full mb-2.5" style={{ background: "var(--accent-cyan)" }} />
        <div
          className={`prose-dark text-lg leading-7 ${message.isStreaming ? "streaming-cursor" : ""}`}
          style={{ color: "var(--text-primary)" }}
        >
          {message.content || (
            <span className="inline-flex gap-1 items-center h-5">
              <span className="w-1 h-1 rounded-full animate-dot-1" style={{ background: "var(--accent-cyan)" }} />
              <span className="w-1 h-1 rounded-full animate-dot-2" style={{ background: "var(--accent-cyan)" }} />
              <span className="w-1 h-1 rounded-full animate-dot-3" style={{ background: "var(--accent-cyan)" }} />
            </span>
          )}
        </div>
      </div>

      {/* Sources toggle */}
      {hasSources && (
        <div className="pl-1">
          <button
            onClick={() => setShowSources((v) => !v)}
            className="flex items-center gap-1.5 font-mono text-xs py-1 bg-transparent border-none cursor-pointer transition-colors duration-150"
            style={{ color: showSources ? "var(--accent-cyan)" : "var(--text-muted)" }}
          >
            <span className="transition-transform duration-150" style={{ display: "inline-block", transform: showSources ? "rotate(0deg)" : "rotate(-90deg)" }}>▾</span>
            {message.sources!.length} source{message.sources!.length !== 1 ? "s" : ""} retrieved
          </button>

          {showSources && (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-2 mt-2 animate-fade-in">
              {message.sources!.map((chunk, i) => (
                <SourceCard key={i} chunk={chunk} index={i} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}