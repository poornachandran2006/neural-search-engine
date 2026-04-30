"use client";

import { useRef, useState, KeyboardEvent } from "react";

interface Props {
  onSend: (query: string) => void;
  disabled: boolean;
}

export function ChatInput({ onSend, disabled }: Props) {
  const [value, setValue]   = useState("");
  const textareaRef         = useRef<HTMLTextAreaElement>(null);
  const canSubmit           = !disabled && value.trim().length > 0;

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
    <div className="flex items-end gap-2.5 bg-bg-elevated border border-border-default rounded-2xl px-3 py-2.5 focus-within:border-accent-cyan-dim transition-colors duration-150">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        onInput={onInput}
        placeholder="Ask anything about your documents…"
        disabled={disabled}
        rows={1}
        className="flex-1 bg-transparent border-none outline-none resize-none font-sans text-lg leading-relaxed text-text-primary placeholder:text-text-muted min-h-6 max-h-40 overflow-y-auto disabled:opacity-50"
      />
      <button
        onClick={submit}
        disabled={!canSubmit}
        className={`shrink-0 w-8 h-8 rounded-lg border flex items-center justify-center text-sm transition-all duration-150
          ${canSubmit
            ? "border-accent-cyan text-accent-cyan bg-accent-cyan/10 hover:bg-accent-cyan/20 cursor-pointer"
            : "border-border-subtle text-text-muted cursor-not-allowed"
          }`}
      >
        ↑
      </button>
    </div>
  );
}