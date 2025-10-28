"use client";

import type { ReactNode } from "react";

interface AppShellProps {
  sidebar: ReactNode;
  header: ReactNode;
  conversation: ReactNode;
  insights: ReactNode;
}

export function AppShell({ sidebar, header, conversation, insights }: AppShellProps) {
  return (
    <div className="flex h-full">
      {sidebar}
      <main className="flex flex-1 flex-col">
        <div className="border-b border-border/60 bg-card/70 px-6 py-4">
          {header}
        </div>
        <div className="flex flex-1 flex-col gap-6 overflow-hidden px-6 py-6 xl:flex-row">
          <section className="relative flex-1">{conversation}</section>
          {insights}
        </div>
      </main>
    </div>
  );
}
