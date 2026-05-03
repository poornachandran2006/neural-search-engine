"use client";

import { useRef, useState, KeyboardEvent } from "react";

interface Props {
  onSend: (query: string) => void;
  disabled: boolean;
}

export function ChatInput({ onSend, disabled }: Props) {
  const [value, setValue] = useState("");
  const textareaRef       = useRef<HTMLTextAreaElement>(null);
  const canSubmit         = !disabled && value.trim().length > 0;

  const submit = () => {
    if (!canSubmit) return;
    onSend(value.trim());
    setValue("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
  };

  const onInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  return (
    <div
      className="flex items-end gap-2.5 rounded-2xl px-3 py-2.5 transition-all duration-200"
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-default)",
      }}
      onFocus={() => {}}
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        onInput={onInput}
        placeholder="Ask anything about your documents…"
        disabled={disabled}
        rows={1}
        className="flex-1 bg-transparent border-none outline-none resize-none font-sans text-lg leading-relaxed min-h-6 max-h-40 overflow-y-auto disabled:opacity-50 transition-colors duration-200"
        style={{
          color: "var(--text-primary)",
        }}
      />
      <button
        onClick={submit}
        disabled={!canSubmit}
        className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all duration-200 cursor-pointer disabled:cursor-not-allowed"
        style={{
          border: canSubmit ? "1px solid var(--accent-cyan)" : "1px solid var(--border-subtle)",
          color: canSubmit ? "var(--accent-cyan)" : "var(--text-muted)",
          background: canSubmit ? "rgba(0,212,255,0.10)" : "transparent",
          transform: canSubmit ? "scale(1)" : "scale(0.95)",
        }}
      >
        ↑
      </button>
    </div>
  );
}