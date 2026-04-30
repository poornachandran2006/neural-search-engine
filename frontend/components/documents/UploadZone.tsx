"use client";

import { useCallback, useState } from "react";
import type { IngestResponse } from "@/types";

interface Props {
  onUpload: (file: File) => Promise<IngestResponse>;
  uploading: boolean;
}

export function UploadZone({ onUpload, uploading }: Props) {
  const [dragOver,    setDragOver]    = useState(false);
  const [lastResult,  setLastResult]  = useState<IngestResponse | null>(null);
  const [error,       setError]       = useState<string | null>(null);

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
        className={`
          flex flex-col items-center justify-center gap-2.5 p-8 rounded-xl border cursor-pointer
          transition-all duration-150
          ${dragOver
            ? "border-accent-cyan bg-accent-cyan/[0.04]"
            : "border-dashed border-border-default bg-bg-elevated hover:border-border-strong hover:bg-bg-hover"
          }
          ${uploading ? "cursor-not-allowed opacity-60" : ""}
        `}
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
              <span className="w-1.5 h-1.5 rounded-full bg-accent-cyan animate-dot-1" />
              <span className="w-1.5 h-1.5 rounded-full bg-accent-cyan animate-dot-2" />
              <span className="w-1.5 h-1.5 rounded-full bg-accent-cyan animate-dot-3" />
            </span>
            <span className="font-mono text-xs text-text-muted">ingesting…</span>
          </>
        ) : (
          <>
            <div className={`text-2xl transition-colors duration-150 ${dragOver ? "text-accent-cyan" : "text-border-strong"}`}>
              ↑
            </div>
            <div className="text-center">
              <div className="text-base font-medium text-text-secondary">Drop a document or click to browse</div>
              <div className="font-mono text-xs text-text-muted mt-1">PDF · TXT · DOCX</div>
            </div>
          </>
        )}
      </label>

      {lastResult && (
        <div className="animate-fade-in bg-accent-green/[0.06] border border-accent-green/20 rounded-lg px-4 py-2.5 font-mono text-xs text-accent-green leading-relaxed">
          <div>✓ {lastResult.source_file}</div>
          <div className="text-text-muted mt-0.5">
            {lastResult.upserted} new chunks · {lastResult.skipped} skipped · {lastResult.total_chunks} total
          </div>
        </div>
      )}

      {error && (
        <div className="animate-fade-in bg-accent-red/[0.06] border border-accent-red/20 rounded-lg px-4 py-2.5 font-mono text-xs text-accent-red">
          ✗ {error}
        </div>
      )}
    </div>
  );
}