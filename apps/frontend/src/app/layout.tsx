import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { LoginDialog } from "@/components/login-dialog";
import { Sidebar } from "@/components/sidebar";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { LanguageProvider } from "@/components/language-provider";
import { SettingsProvider } from "@/lib/settings-context";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { TooltipProvider } from "@/components/ui/tooltip";
import { OnboardingManager } from "@/components/OnboardingManager";
import { KeyboardShortcutsHint } from "@/components/KeyboardShortcutsHint";
import { GlobalModals } from "@/components/GlobalModals";
import { PageTransition } from "@/components/page-transition";
import { KeyboardNavProvider } from "@/components/keyboard-nav-provider";
import { SpotlightCursor } from "@/components/spotlight-cursor";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "YouWorker.AI - Professional AI Assistant",
  description: "Advanced conversational AI with voice, semantic search, and extensible tools.",
  icons: {
    icon: "/YouWorker.ai-ico.svg",
    shortcut: "/YouWorker.ai-ico.svg",
    apple: "/YouWorker.ai-ico.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:rounded focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          Skip to main content
        </a>
        <ErrorBoundary>
          <QueryProvider>
            <ThemeProvider>
              <SettingsProvider>
                <LanguageProvider>
                  <TooltipProvider delayDuration={300}>
                    <KeyboardNavProvider>
                      <AuthProvider>
                      <SpotlightCursor />
                      <LoginDialog />
                      <OnboardingManager />
                      <KeyboardShortcutsHint />
                      <GlobalModals />
                      <div className="flex h-screen bg-background">
                        <Sidebar />
                        <main id="main-content" className="flex-1 overflow-auto md:pl-0">
                          <PageTransition>{children}</PageTransition>
                        </main>
                      </div>
                      <Toaster />
                      </AuthProvider>
                    </KeyboardNavProvider>
                  </TooltipProvider>
                </LanguageProvider>
              </SettingsProvider>
            </ThemeProvider>
          </QueryProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
