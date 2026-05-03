"use client";

import { useCallback, useState } from "react";
import type { IngestResponse } from "@/types";

interface Props {
  onUpload: (file: File) => Promise<IngestResponse>;
  uploading: boolean;
}

export function UploadZone({ onUpload, uploading }: Props) {
  const [dragOver,   setDragOver]   = useState(false);
  const [lastResult, setLastResult] = useState<IngestResponse | null>(null);
  const [error,      setError]      = useState<string | null>(null);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setLastResult(null);
    try {
      setLastResult(await onUpload(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    }
  }, [onUpload]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  return (
    <div className="flex flex-col gap-3">
      <label
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`flex flex-col items-center justify-center gap-2.5 p-8 rounded-xl cursor-pointer transition-all duration-200 ${uploading ? "cursor-not-allowed opacity-60" : ""}`}
        style={{
          background: dragOver ? "rgba(0,212,255,0.04)" : "var(--bg-elevated)",
          border: dragOver
            ? "1px solid var(--accent-cyan)"
            : "1px dashed var(--border-default)",
          transform: dragOver ? "scale(1.01)" : "scale(1)",
        }}
      >
        <input
          type="file"
          accept=".pdf,.txt,.docx"
          className="hidden"
          disabled={uploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />

        {uploading ? (
          <>
            <span className="inline-flex gap-1.5 items-center">
              <span className="w-1.5 h-1.5 rounded-full animate-dot-1" style={{ background: "var(--accent-cyan)" }} />
              <span className="w-1.5 h-1.5 rounded-full animate-dot-2" style={{ background: "var(--accent-cyan)" }} />
              <span className="w-1.5 h-1.5 rounded-full animate-dot-3" style={{ background: "var(--accent-cyan)" }} />
            </span>
            <span className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>ingesting…</span>
          </>
        ) : (
          <>
            <div
              className="text-2xl transition-all duration-200"
              style={{ color: dragOver ? "var(--accent-cyan)" : "var(--border-strong)" }}
            >
              ↑
            </div>
            <div className="text-center">
              <div className="text-base font-medium" style={{ color: "var(--text-secondary)" }}>
                Drop a document or click to browse
              </div>
              <div className="font-mono text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                PDF · TXT · DOCX
              </div>
            </div>
          </>
        )}
      </label>

      {lastResult && (
        <div
          className="animate-fade-in rounded-lg px-4 py-2.5 font-mono text-xs leading-relaxed"
          style={{
            background: "rgba(0,255,157,0.06)",
            border: "1px solid rgba(0,255,157,0.20)",
            color: "var(--accent-green)",
          }}
        >
          <div>✓ {lastResult.source_file}</div>
          <div className="mt-0.5" style={{ color: "var(--text-muted)" }}>
            {lastResult.upserted} new chunks · {lastResult.skipped} skipped · {lastResult.total_chunks} total
          </div>
        </div>
      )}

      {error && (
        <div
          className="animate-fade-in rounded-lg px-4 py-2.5 font-mono text-xs"
          style={{
            background: "rgba(255,77,109,0.06)",
            border: "1px solid rgba(255,77,109,0.20)",
            color: "var(--accent-red)",
          }}
        >
          ✗ {error}
        </div>
      )}
    </div>
  );
}