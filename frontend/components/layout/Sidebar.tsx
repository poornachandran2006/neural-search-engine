"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  active: boolean;
}

interface Props {
  activePage: "chat" | "documents" | "evaluation";
  children?: React.ReactNode;
}

export function Sidebar({ activePage, children }: Props) {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [mobileOpen, setMobileOpen] = useState(false);

  // On mount, read saved theme
  useEffect(() => {
    const saved = localStorage.getItem("theme") as "dark" | "light" | null;
    const initial = saved ?? "dark";
    setTheme(initial);
    document.documentElement.setAttribute("data-theme", initial);
  }, []);

  // Close sidebar on route change / resize to desktop
  useEffect(() => {
    const onResize = () => { if (window.innerWidth >= 768) setMobileOpen(false); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  };

  const navItems: NavItem[] = [
    { href: "/chat",       label: "Chat",       icon: "◉", active: activePage === "chat"       },
    { href: "/documents",  label: "Documents",  icon: "◻", active: activePage === "documents"  },
    { href: "/evaluation", label: "Evaluation", icon: "◈", active: activePage === "evaluation" },
  ];

  const sidebarContent = (
    <aside
      className="w-60 h-full flex flex-col"
      style={{
        background: "var(--bg-surface)",
        borderRight: "1px solid var(--border-subtle)",
      }}
    >
      {/* Header */}
      <div
        className="px-4 py-4 flex items-start justify-between"
        style={{ borderBottom: "1px solid var(--border-subtle)" }}
      >
        <div>
          <div className="font-mono text-md font-medium tracking-wide" style={{ color: "var(--accent-cyan)" }}>
            ◈ NEURAL SEARCH
          </div>
          <div className="font-mono text-2xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            RAG · Hybrid Retrieval · Reranking
          </div>
        </div>

        {/* Mobile close button */}
        <button
          onClick={() => setMobileOpen(false)}
          className="md:hidden w-6 h-6 flex items-center justify-center rounded transition-colors duration-150 ml-2 mt-0.5"
          style={{ color: "var(--text-secondary)" }}
          aria-label="Close sidebar"
        >
          ✕
        </button>
      </div>

      {/* Nav */}
      <nav className="px-2 pt-2 flex flex-col gap-0.5">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-base font-sans transition-all duration-150 no-underline"
            style={{
              fontWeight: item.active ? 500 : 400,
              color: item.active ? "var(--accent-cyan)" : "var(--text-secondary)",
              background: item.active ? "rgba(0,212,255,0.08)" : "transparent",
            }}
          >
            <span className="font-mono text-xs">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Slot — chat history, etc. */}
      {children && (
        <div className="flex flex-col flex-1 min-h-0">{children}</div>
      )}

      {/* Footer */}
      <div
        className="px-3 py-3 flex items-center justify-between"
        style={{ borderTop: "1px solid var(--border-subtle)" }}
      >
        {/* Back to landing */}
        <Link
          href="/landing"
          className="flex items-center gap-1.5 font-mono text-xs transition-colors duration-150 no-underline"
          style={{ color: "var(--text-muted)" }}
          title="Back to home"
        >
          <span>⌂</span>
          <span>Home</span>
        </Link>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="flex items-center gap-1.5 font-mono text-xs px-2 py-1 rounded-md transition-all duration-150"
          style={{
            color: "var(--text-secondary)",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-default)",
          }}
          title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        >
          {theme === "dark" ? "☀ Light" : "☾ Dark"}
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {/* ── Desktop sidebar (always visible ≥ md) ── */}
      <div className="hidden md:flex h-screen shrink-0">
        {sidebarContent}
      </div>

      {/* ── Mobile: hamburger button ── */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-3 left-3 z-40 w-8 h-8 flex items-center justify-center rounded-md transition-colors duration-150"
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-default)",
          color: "var(--text-primary)",
        }}
        aria-label="Open sidebar"
      >
        <span className="font-mono text-base leading-none">☰</span>
      </button>

      {/* ── Mobile: backdrop ── */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40"
          style={{ background: "rgba(0,0,0,0.55)" }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Mobile: sliding sidebar ── */}
      <div
        className={`md:hidden fixed top-0 left-0 h-full z-50 transition-transform duration-250 ease-out ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebarContent}
      </div>
    </>
  );
}