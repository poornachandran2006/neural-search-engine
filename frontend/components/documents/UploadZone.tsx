"use client";

import { useCallback, useState } from "react";
import type { IngestResponse } from "@/types";

const STAGES = ["loading", "chunking", "embedding", "storing", "suggestions"] as const;
type Stage = typeof STAGES[number] | "done";

const STAGE_LABELS: Record<string, string> = {
  loading:     "Reading document",
  chunking:    "Splitting into chunks",
  embedding:   "Generating embeddings",
  storing:     "Storing in Qdrant",
  suggestions: "Generating suggestions",
  done:        "Complete",
};

interface Props {
  onUpload: (file: File) => Promise<IngestResponse>;
  onPollStatus: (jobId: string) => Promise<void>;
  uploading: boolean;
}

export function UploadZone({ onUpload, onPollStatus, uploading }: Props) {
  const [dragOver,    setDragOver]    = useState(false);
  const [lastResult,  setLastResult]  = useState<IngestResponse | null>(null);
  const [error,       setError]       = useState<string | null>(null);
  const [stage,       setStage]       = useState<Stage | null>(null);
  const [stageDetail, setStageDetail] = useState("");

  const isIngesting = stage !== null && stage !== "done";

  const stageIndex = stage ? STAGES.indexOf(stage as typeof STAGES[number]) : -1;
  const progressPct = stage === "done"
    ? 100
    : stageIndex >= 0
    ? Math.max(12, Math.round(((stageIndex + 1) / STAGES.length) * 100))
    : 12;

  const pollProgress = useCallback(async (jobId: string) => {
    return new Promise<void>((resolve) => {
      const interval = setInterval(async () => {
        try {
          const res = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/ingest/status/${jobId}`
          );
          const data = await res.json();
          if (data.stage && data.stage !== "queued") {
            setStage(data.stage as Stage);
            setStageDetail(data.detail ?? "");
          }
          if (data.status === "done" || data.status === "error") {
            clearInterval(interval);
            resolve();
          }
        } catch {
          clearInterval(interval);
          resolve();
        }
      }, 400);
    });
  }, []);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setLastResult(null);
    setStage("loading");
    setStageDetail(`Reading ${file.name}`);
    await new Promise((resolve) => setTimeout(resolve, 50));

    try {
      const response = await onUpload(file);
      const jobId = response.job_id ?? response.document_id;
      await Promise.all([pollProgress(jobId), onPollStatus(jobId)]);
      setLastResult(response);
      setStage("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
      setStage(null);
    }
  }, [onUpload, onPollStatus, pollProgress]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  return (
    <div className="flex flex-col gap-3">

      {/* Drop zone */}
      <label
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className="flex flex-col items-center justify-center gap-3 p-8 rounded-xl cursor-pointer transition-all duration-200"
        style={{
          background: dragOver ? "rgba(0,212,255,0.04)" : "var(--bg-elevated)",
          border: isIngesting
            ? "1px solid rgba(0,212,255,0.30)"
            : dragOver
            ? "1px solid var(--accent-cyan)"
            : "1px dashed var(--border-default)",
          transform: dragOver ? "scale(1.01)" : "scale(1)",
          pointerEvents: isIngesting ? "none" : "auto",
        }}
      >
        <input
          type="file"
          accept=".pdf,.txt,.docx"
          className="hidden"
          disabled={isIngesting || uploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />

        {isIngesting ? (
          <div className="flex flex-col items-center gap-2 w-full">
            {/* Animated dots */}
            <span className="inline-flex gap-1.5 items-center mb-1">
              <span className="w-1.5 h-1.5 rounded-full animate-dot-1" style={{ background: "var(--accent-cyan)" }} />
              <span className="w-1.5 h-1.5 rounded-full animate-dot-2" style={{ background: "var(--accent-cyan)" }} />
              <span className="w-1.5 h-1.5 rounded-full animate-dot-3" style={{ background: "var(--accent-cyan)" }} />
            </span>

            {/* Stage label */}
            <div className="font-mono text-xs font-semibold" style={{ color: "var(--accent-cyan)" }}>
              {stage ? STAGE_LABELS[stage] : "Starting…"}
            </div>
            {stageDetail && (
              <div className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>
                {stageDetail}
              </div>
            )}

            {/* Step dots */}
            <div className="flex items-center gap-2 mt-1">
              {STAGES.map((s, i) => (
                <div key={s} className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full transition-all duration-300"
                    style={{
                      background: i < stageIndex
                        ? "var(--accent-cyan)"
                        : i === stageIndex
                        ? "var(--accent-amber)"
                        : "var(--border-default)",
                      boxShadow: i === stageIndex ? "0 0 6px var(--accent-amber)" : "none",
                    }}
                  />
                  {i < STAGES.length - 1 && (
                    <div className="w-4 h-px" style={{ background: i < stageIndex ? "var(--accent-cyan)" : "var(--border-default)" }} />
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="text-2xl" style={{ color: dragOver ? "var(--accent-cyan)" : "var(--border-strong)" }}>↑</div>
            <div className="text-center">
              <div className="text-base font-medium" style={{ color: "var(--text-secondary)" }}>
                Drop a document or click to browse
              </div>
              <div className="font-mono text-xs mt-1" style={{ color: "var(--text-muted)" }}>PDF · TXT · DOCX</div>
            </div>
          </>
        )}
      </label>

      {/* Progress bar — OUTSIDE label so no opacity inheritance */}
      {isIngesting && (
        <div
          className="rounded-full overflow-hidden"
          style={{ height: "8px", background: "rgba(0,212,255,0.12)", border: "1px solid rgba(0,212,255,0.25)" }}
        >
          <div
            style={{
              height: "100%",
              width: `${progressPct}%`,
              background: "linear-gradient(90deg, #00d4ff 0%, #00ff9d 100%)",
              boxShadow: "0 0 10px rgba(0,212,255,0.9), 0 0 20px rgba(0,212,255,0.4)",
              borderRadius: "9999px",
              transition: "width 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
              minWidth: "12px",
            }}
          />
        </div>
      )}

      {/* Percentage label */}
      {isIngesting && (
        <div className="font-mono text-xs text-right" style={{ color: "var(--text-muted)", marginTop: "-6px" }}>
          {progressPct}%
        </div>
      )}

      {lastResult && stage === "done" && (
        <div
          className="animate-fade-in rounded-lg px-4 py-2.5 font-mono text-xs leading-relaxed"
          style={{ background: "rgba(0,255,157,0.06)", border: "1px solid rgba(0,255,157,0.20)", color: "var(--accent-green)" }}
        >
          <div>✓ {lastResult.source_file}</div>
          <div className="mt-0.5" style={{ color: "var(--text-muted)" }}>ingestion complete</div>
        </div>
      )}

      {error && (
        <div
          className="animate-fade-in rounded-lg px-4 py-2.5 font-mono text-xs"
          style={{ background: "rgba(255,77,109,0.06)", border: "1px solid rgba(255,77,109,0.20)", color: "var(--accent-red)" }}
        >
          ✗ {error}
        </div>
      )}
    </div>
  );
}