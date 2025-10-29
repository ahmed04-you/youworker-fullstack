"use client";

import type { ReactNode } from "react";

interface AppShellProps {
  sidebar?: ReactNode;
  conversation: ReactNode;
  insights: ReactNode;
}

export function AppShell({ sidebar, conversation, insights }: AppShellProps) {
  return (
    <div className="flex h-full overflow-hidden">
      {sidebar}
      <main className="flex flex-1 flex-col overflow-hidden">
        <div className="flex flex-1 gap-6 overflow-hidden px-6 py-6 xl:flex-row">
          <section className="flex-1 flex flex-col overflow-hidden">{conversation}</section>
          {insights}
        </div>
      </main>
    </div>
  );
}
