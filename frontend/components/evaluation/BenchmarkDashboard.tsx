"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { BenchmarkResults, QuestionResult } from "@/types";

function MetricCard({ label, value, description, colorClass, glowStyle }: {
  label: string; value: number; description: string; colorClass: string; glowStyle: string;
}) {
  const pct = Math.round(value * 100);
  return (
    <div className={`animate-fade-in bg-bg-elevated border border-border-default rounded-xl p-5 ${glowStyle}`}>
      <div className="font-mono text-xs text-text-muted uppercase tracking-widest mb-2">{label}</div>
      <div className={`font-mono text-4xl font-semibold leading-none mb-3 ${colorClass}`}>
        {pct}<span className="text-xl opacity-60">%</span>
      </div>
      <div className="h-px bg-border-subtle overflow-hidden rounded-full">
        <div className={`h-full rounded-full animate-score-fill ${colorClass.replace("text-", "bg-")}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="text-xs text-text-muted mt-2 leading-relaxed">{description}</div>
    </div>
  );
}

function QuestionRow({ q, index }: { q: QuestionResult; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const avg = Math.round(((q.recall_at_5 + q.faithfulness + q.answer_relevancy) / 3) * 100);
  const avgColor = avg >= 80 ? "text-accent-green" : avg >= 60 ? "text-accent-cyan" : "text-accent-amber";

  return (
    <div
      className="animate-fade-in border border-border-subtle rounded-lg overflow-hidden"
      style={{ animationDelay: `${index * 0.03}s` }}
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-2.5 bg-bg-elevated border-none cursor-pointer text-left hover:bg-bg-hover transition-colors duration-150"
      >
        <span className="font-mono text-xs text-text-muted w-9 shrink-0">{q.id}</span>
        <span className="flex-1 text-xs text-text-secondary leading-relaxed">{q.question}</span>
        <span className={`font-mono text-sm font-semibold w-10 text-right shrink-0 ${avgColor}`}>{avg}%</span>
        <span className="text-xs text-text-muted">{expanded ? "▾" : "▸"}</span>
      </button>

      {expanded && (
        <div className="px-4 py-3 border-t border-border-subtle bg-bg-surface flex flex-col gap-3">
          <div className="flex gap-4">
            {[
              { label: "Recall@5",  value: q.recall_at_5,        color: "text-accent-cyan"  },
              { label: "Faithful",  value: q.faithfulness,       color: "text-accent-green" },
              { label: "Relevancy", value: q.answer_relevancy,   color: "text-accent-amber" },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex-1">
                <div className="font-mono text-2xs text-text-muted mb-1">{label}</div>
                <div className={`font-mono text-lg font-semibold ${color}`}>{Math.round(value * 100)}%</div>
              </div>
            ))}
            <div>
              <div className="font-mono text-2xs text-text-muted mb-1">Intent</div>
              <span className={`badge-${q.intent} font-mono text-xs rounded-sm px-1.5 py-px`}>{q.intent}</span>
            </div>
          </div>
          <div>
            <div className="font-mono text-2xs text-text-muted mb-1">ANSWER</div>
            <div className="text-xs text-text-secondary leading-relaxed">{q.answer}</div>
          </div>
        </div>
      )}
    </div>
  );
}

export function BenchmarkDashboard() {
  const [results, setResults] = useState<BenchmarkResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const fetchResults = async () => {
    try {
      setResults(await api.evaluation.results());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No results yet");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchResults(); }, []);

  const triggerRun = async () => {
    setRunning(true);
    try {
      await api.evaluation.run();
      const poll = setInterval(async () => {
        const { running: still } = await api.evaluation.status();
        if (!still) { clearInterval(poll); setRunning(false); fetchResults(); }
      }, 3000);
    } catch { setRunning(false); }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Benchmark Results</h1>
          {results && (
            <div className="font-mono text-xs text-text-muted mt-1">
              {results.total_questions} questions · run {new Date(results.run_at).toLocaleString()}
            </div>
          )}
        </div>
        <button
          onClick={triggerRun}
          disabled={running}
          className={`font-mono text-sm px-4 py-1.5 rounded-md border transition-all duration-150
            ${running
              ? "text-text-muted border-border-subtle cursor-not-allowed"
              : "text-accent-cyan bg-accent-cyan/[0.08] border-accent-cyan/30 hover:bg-accent-cyan/[0.14] cursor-pointer"
            }`}
        >
          {running ? "running…" : "re-run benchmark"}
        </button>
      </div>

      {loading && (
        <div className="flex justify-center py-10">
          <span className="inline-flex gap-1.5 items-center">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-cyan animate-dot-1" />
            <span className="w-1.5 h-1.5 rounded-full bg-accent-cyan animate-dot-2" />
            <span className="w-1.5 h-1.5 rounded-full bg-accent-cyan animate-dot-3" />
          </span>
        </div>
      )}

      {error && !loading && (
        <div className="bg-accent-red/[0.06] border border-accent-red/20 rounded-lg px-4 py-4 font-mono text-xs text-accent-red">
          {error}
        </div>
      )}

      {results && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <MetricCard label="Recall @ 5"       value={results.metrics.recall_at_5}      description="Correct chunk in top-5 retrieved"  colorClass="text-accent-cyan"  glowStyle="shadow-[0_0_24px_rgba(0,212,255,0.08)]" />
            <MetricCard label="Faithfulness"     value={results.metrics.faithfulness}     description="Answer grounded in context"         colorClass="text-accent-green" glowStyle="shadow-[0_0_24px_rgba(0,255,157,0.08)]" />
            <MetricCard label="Answer Relevancy" value={results.metrics.answer_relevancy} description="Answer addresses the question"      colorClass="text-accent-amber" glowStyle="shadow-[0_0_24px_rgba(255,179,71,0.08)]" />
          </div>

          <div>
            <div className="font-mono text-xs text-text-muted uppercase tracking-widest mb-3">Per-question breakdown</div>
            <div className="flex flex-col gap-1.5">
              {results.per_question.map((q, i) => <QuestionRow key={q.id} q={q} index={i} />)}
            </div>
          </div>
        </>
      )}
    </div>
  );
}