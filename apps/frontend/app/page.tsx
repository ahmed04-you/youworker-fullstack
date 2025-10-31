import { Button } from "@/components/ui/button";
import { ThemeSwitcher } from "@/components/ui/theme-switcher";
import { MessageSquare, FileText, Settings } from "lucide-react";
import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 gap-12">
      {/* Theme Switcher */}
      <div className="fixed top-8 right-8 z-50">
        <ThemeSwitcher />
      </div>

      {/* Welcome Section */}
      <div className="flex flex-col items-center text-center gap-6 max-w-2xl">
        <h1
          className="font-bold text-[var(--text-color)]"
          style={{ fontSize: 'var(--font-banner)' }}
        >
          Welcome to YouWorker
        </h1>
        <p
          className="text-[var(--text-muted)]"
          style={{ fontSize: 'var(--font-larger)' }}
        >
          Your AI-Powered Work Assistant
        </p>
        <p
          className="text-[var(--text-color)] leading-relaxed"
          style={{ fontSize: 'var(--font-medium)' }}
        >
          YouWorker is a modern LLM chat application with local document support,
          designed for privacy-first interactions and seamless productivity.
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-8 flex-wrap justify-center">
        <Link href="/chat">
          <Button
            variant="welcome"
            className="slide-up"
            style={{ animationDelay: '0.1s' }}
          >
            <MessageSquare size={64} color="var(--accent-color)" />
            <div>
              <div
                className="font-bold text-[var(--text-color)]"
                style={{ fontSize: 'var(--font-larger)' }}
              >
                Start Chatting
              </div>
              <div
                className="text-[var(--text-muted)] mt-2"
                style={{ fontSize: 'var(--font-medium)' }}
              >
                Begin conversations with AI models
              </div>
            </div>
          </Button>
        </Link>

        <Button
          variant="welcome"
          className="slide-up"
          style={{ animationDelay: '0.2s' }}
        >
          <FileText size={64} color="var(--accent-color)" />
          <div>
            <div
              className="font-bold text-[var(--text-color)]"
              style={{ fontSize: 'var(--font-larger)' }}
            >
              LocalDocs
            </div>
            <div
              className="text-[var(--text-muted)] mt-2"
              style={{ fontSize: 'var(--font-medium)' }}
            >
              Chat with your local documents
            </div>
          </div>
        </Button>

        <Button
          variant="welcome"
          className="slide-up"
          style={{ animationDelay: '0.3s' }}
        >
          <Settings size={64} color="var(--accent-color)" />
          <div>
            <div
              className="font-bold text-[var(--text-color)]"
              style={{ fontSize: 'var(--font-larger)' }}
            >
              Settings
            </div>
            <div
              className="text-[var(--text-muted)] mt-2"
              style={{ fontSize: 'var(--font-medium)' }}
            >
              Customize your experience
            </div>
          </div>
        </Button>
      </div>

      {/* Demo Buttons Section */}
      <div className="flex flex-col items-center gap-6 mt-8">
        <h2
          className="font-bold text-[var(--text-color)]"
          style={{ fontSize: 'var(--font-larger)' }}
        >
          Button Variants Demo
        </h2>
        <div className="flex gap-4 flex-wrap justify-center">
          <Button variant="default">Default Button</Button>
          <Button variant="mini">Mini Button</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="text">Text Button</Button>
          <Button variant="tool">
            <Settings size={24} />
          </Button>
          <Button variant="default" disabled>
            Disabled
          </Button>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-12 text-center">
        <p
          className="text-[var(--text-muted)]"
          style={{ fontSize: 'var(--font-small)' }}
        >
          Built with Next.js 16 • React 19 • Tailwind CSS v4
        </p>
        <p
          className="text-[var(--text-muted)] mt-2"
          style={{ fontSize: 'var(--font-small)' }}
        >
          Design based on GPT4All v3.10 • Adapted for YouWorker
        </p>
      </footer>
    </main>
  );
}
