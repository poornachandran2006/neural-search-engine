"use client";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  active: boolean;
}

interface Props {
  activePage: "chat" | "documents" | "evaluation";
  children?: React.ReactNode; // slot for chat-specific content
}

export function Sidebar({ activePage, children }: Props) {
  const navItems: NavItem[] = [
    { href: "/",           label: "Chat",       icon: "◉", active: activePage === "chat"       },
    { href: "/documents",  label: "Documents",  icon: "◻", active: activePage === "documents"  },
    { href: "/evaluation", label: "Evaluation", icon: "◈", active: activePage === "evaluation" },
  ];

  return (
    <aside className="w-60 shrink-0 bg-bg-surface border-r border-border-subtle flex flex-col">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-border-subtle">
        <div className="font-mono text-md font-medium text-accent-cyan tracking-wide">
          ◈ NEURAL SEARCH
        </div>
        <div className="font-mono text-2xs text-text-muted mt-0.5">
          RAG · Hybrid Retrieval · Reranking
        </div>
      </div>

      {/* Nav */}
      <nav className="px-2 pt-2 flex flex-col gap-0.5">
        {navItems.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className={`
              flex items-center gap-2 px-2.5 py-1.5 rounded-md text-base font-sans
              transition-all duration-150 no-underline
              ${item.active
                ? "font-medium text-accent-cyan bg-accent-cyan/[0.08]"
                : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
              }
            `}
          >
            <span className="font-mono text-xs">{item.icon}</span>
            {item.label}
          </a>
        ))}
      </nav>

      {/* Slot — chat history, etc. */}
      {children && <div className="flex flex-col flex-1 min-h-0">{children}</div>}
    </aside>
  );
}