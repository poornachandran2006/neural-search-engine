"use client";

import { Sidebar } from "@/components/layout/Sidebar";
import { BenchmarkDashboard } from "@/components/evaluation/BenchmarkDashboard";

export default function EvaluationPage() {
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg-base)" }}>
      <Sidebar activePage="evaluation" />

      <main className="flex-1 overflow-y-auto">
        {/* Mobile top bar */}
        <div
          className="md:hidden h-12 shrink-0 flex items-center px-14 border-b sticky top-0 z-10"
          style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}
        >
          <span className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>Evaluation</span>
        </div>

        <div className="px-6 md:px-10 py-8">
          <BenchmarkDashboard />
        </div>
      </main>
    </div>
  );
}