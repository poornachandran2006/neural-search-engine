"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { BenchmarkResults, QuestionResult, FeedbackSummary } from "@/types";

function MetricCard({ label, value, description, color, glow }: {
  label: string; value: number; description: string; color: string; glow: string;
}) {
  const pct = Math.round(value * 100);
  return (
    <div
      className="animate-fade-in rounded-xl p-5 transition-all duration-200 hover:scale-[1.02]"
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-default)",
        boxShadow: glow,
      }}
    >
      <div className="font-mono text-xs uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>
        {label}
      </div>
      <div className="font-mono text-4xl font-semibold leading-none mb-3" style={{ color }}>
        {pct}<span className="text-xl opacity-60">%</span>
      </div>
      <div className="h-px overflow-hidden rounded-full mb-2" style={{ background: "var(--border-subtle)" }}>
        <div className="h-full rounded-full animate-score-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
        {description}
      </div>
    </div>
  );
}

function FeedbackCard({ summary }: { summary: FeedbackSummary }) {
  const upPct = summary.total > 0 ? Math.round((summary.thumbs_up / summary.total) * 100) : 0;
  return (
    <div
      className="animate-fade-in rounded-xl p-5"
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-default)",
      }}
    >
      <div className="font-mono text-xs uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>
        User Feedback
      </div>
      {summary.total === 0 ? (
        <div className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>
          No feedback yet — rate answers in the chat.
        </div>
      ) : (
        <>
          <div className="flex items-end gap-6 mb-3">
            <div>
              <div className="font-mono text-3xl font-semibold" style={{ color: "var(--accent-green)" }}>
                {summary.thumbs_up}
                <span className="text-base opacity-60 ml-1">↑</span>
              </div>
              <div className="font-mono text-xs mt-1" style={{ color: "var(--text-muted)" }}>thumbs up</div>
            </div>
            <div>
              <div className="font-mono text-3xl font-semibold" style={{ color: "var(--accent-red)" }}>
                {summary.thumbs_down}
                <span className="text-base opacity-60 ml-1">↓</span>
              </div>
              <div className="font-mono text-xs mt-1" style={{ color: "var(--text-muted)" }}>thumbs down</div>
            </div>
            <div className="ml-auto text-right">
              <div className="font-mono text-3xl font-semibold" style={{ color: "var(--accent-cyan)" }}>
                {upPct}<span className="text-xl opacity-60">%</span>
              </div>
              <div className="font-mono text-xs mt-1" style={{ color: "var(--text-muted)" }}>positive rate</div>
            </div>
          </div>
          <div className="h-px overflow-hidden rounded-full" style={{ background: "var(--border-subtle)" }}>
            <div className="h-full rounded-full" style={{ width: `${upPct}%`, background: "var(--accent-green)" }} />
          </div>
          <div className="font-mono text-xs mt-2" style={{ color: "var(--text-muted)" }}>
            {summary.total} total ratings
          </div>
        </>
      )}
    </div>
  );
}

function QuestionRow({ q, index }: { q: QuestionResult; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const avg = Math.round(((q.recall_at_5 + q.faithfulness + q.answer_relevancy) / 3) * 100);
  const avgColor = avg >= 80 ? "var(--accent-green)" : avg >= 60 ? "var(--accent-cyan)" : "var(--accent-amber)";

  return (
    <div
      className="animate-fade-in rounded-lg overflow-hidden transition-all duration-200"
      style={{ border: "1px solid var(--border-subtle)", animationDelay: `${index * 0.03}s` }}
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-2.5 border-none cursor-pointer text-left transition-all duration-150"
        style={{ background: "var(--bg-elevated)" }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "var(--bg-elevated)")}
      >
        <span className="font-mono text-xs w-9 shrink-0" style={{ color: "var(--text-muted)" }}>{q.id}</span>
        <span className="flex-1 text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{q.question}</span>
        <span className="font-mono text-sm font-semibold w-10 text-right shrink-0" style={{ color: avgColor }}>{avg}%</span>
        <span
          className="text-xs transition-transform duration-150"
          style={{ color: "var(--text-muted)", display: "inline-block", transform: expanded ? "rotate(0deg)" : "rotate(-90deg)" }}
        >
          ▾
        </span>
      </button>

      {expanded && (
        <div
          className="px-4 py-3 flex flex-col gap-3 animate-fade-in"
          style={{ borderTop: "1px solid var(--border-subtle)", background: "var(--bg-surface)" }}
        >
          <div className="flex gap-4 flex-wrap">
            {[
              { label: "Recall@5",  value: q.recall_at_5,      color: "var(--accent-cyan)"  },
              { label: "Faithful",  value: q.faithfulness,     color: "var(--accent-green)" },
              { label: "Relevancy", value: q.answer_relevancy, color: "var(--accent-amber)" },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex-1 min-w-[60px]">
                <div className="font-mono text-2xs mb-1" style={{ color: "var(--text-muted)" }}>{label}</div>
                <div className="font-mono text-lg font-semibold" style={{ color }}>{Math.round(value * 100)}%</div>
              </div>
            ))}
            <div>
              <div className="font-mono text-2xs mb-1" style={{ color: "var(--text-muted)" }}>Intent</div>
              <span className={`badge-${q.intent} font-mono text-xs rounded-sm px-1.5 py-px`}>{q.intent}</span>
            </div>
          </div>
          <div>
            <div className="font-mono text-2xs mb-1" style={{ color: "var(--text-muted)" }}>ANSWER</div>
            <div className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{q.answer}</div>
          </div>
        </div>
      )}
    </div>
  );
}

export function BenchmarkDashboard() {
  const [results, setResults]       = useState<BenchmarkResults | null>(null);
  const [feedback, setFeedback]     = useState<FeedbackSummary | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [running, setRunning]       = useState(false);

  const fetchResults = async () => {
    try {
      const [benchmarkData, feedbackData] = await Promise.all([
        api.evaluation.results(),
        api.chats.feedbackSummary(),
      ]);
      setResults(benchmarkData);
      setFeedback(feedbackData);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No results yet");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        const { running: isRunning } = await api.evaluation.status();
        if (isRunning) {
          setRunning(true);
          setLoading(false);
          const poll = setInterval(async () => {
            const { running: still } = await api.evaluation.status();
            if (!still) { clearInterval(poll); setRunning(false); fetchResults(); }
          }, 3000);
        } else {
          fetchResults();
        }
      } catch {
        fetchResults();
      }
    };
    init();
  }, []); // eslint-disable-line

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
      <div className="flex items-start justify-between gap-4 animate-fade-in flex-wrap">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
            Benchmark Results
          </h1>
          {results && (
            <div className="font-mono text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              {results.total_questions} questions · run {new Date(results.run_at).toLocaleString()}
            </div>
          )}
        </div>
        <button
          onClick={triggerRun}
          disabled={running}
          className="font-mono text-sm px-4 py-1.5 rounded-md transition-all duration-150 cursor-pointer disabled:cursor-not-allowed"
          style={{
            color: running ? "var(--text-muted)" : "var(--accent-cyan)",
            background: running ? "transparent" : "rgba(0,212,255,0.08)",
            border: running ? "1px solid var(--border-subtle)" : "1px solid rgba(0,212,255,0.30)",
          }}
        >
          {running ? "running…" : "re-run benchmark"}
        </button>
      </div>

      {loading && (
        <div className="flex justify-center py-10">
          <span className="inline-flex gap-1.5 items-center">
            <span className="w-1.5 h-1.5 rounded-full animate-dot-1" style={{ background: "var(--accent-cyan)" }} />
            <span className="w-1.5 h-1.5 rounded-full animate-dot-2" style={{ background: "var(--accent-cyan)" }} />
            <span className="w-1.5 h-1.5 rounded-full animate-dot-3" style={{ background: "var(--accent-cyan)" }} />
          </span>
        </div>
      )}

      {error && !loading && (
        <div
          className="rounded-lg px-4 py-4 font-mono text-xs"
          style={{ background: "rgba(255,77,109,0.06)", border: "1px solid rgba(255,77,109,0.20)", color: "var(--accent-red)" }}
        >
          {error}
        </div>
      )}

      {/* Feedback card — always shown once loaded */}
      {!loading && feedback && (
        <FeedbackCard summary={feedback} />
      )}

      {results && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <MetricCard
              label="Recall @ 5"
              value={results.metrics.recall_at_5}
              description="Correct chunk in top-5 retrieved"
              color="var(--accent-cyan)"
              glow="0 0 24px rgba(0,212,255,0.08)"
            />
            <MetricCard
              label="Faithfulness"
              value={results.metrics.faithfulness}
              description="Answer grounded in context"
              color="var(--accent-green)"
              glow="0 0 24px rgba(0,255,157,0.08)"
            />
            <MetricCard
              label="Answer Relevancy"
              value={results.metrics.answer_relevancy}
              description="Answer addresses the question"
              color="var(--accent-amber)"
              glow="0 0 24px rgba(255,179,71,0.08)"
            />
          </div>

          <div>
            <div className="font-mono text-xs uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>
              Per-question breakdown
            </div>
            <div className="flex flex-col gap-1.5">
              {results.per_question.map((q, i) => (
                <QuestionRow key={q.id} q={q} index={i} />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}