"use client";

import { Sidebar } from "@/components/layout/Sidebar";
import { BenchmarkDashboard } from "@/components/evaluation/BenchmarkDashboard";

export default function EvaluationPage() {
  return (
    <div className="flex h-screen bg-bg-base">
      <Sidebar activePage="evaluation" />

      <main className="flex-1 overflow-y-auto px-10 py-8">
        <BenchmarkDashboard />
      </main>
    </div>
  );
}