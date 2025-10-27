"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * Renders markdown content with syntax highlighting and GFM support
 *
 * Features:
 * - GitHub Flavored Markdown (tables, strikethrough, task lists)
 * - Syntax highlighted code blocks
 * - Theme-aware styling (dark/light mode)
 * - Responsive design
 */
export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <ReactMarkdown
      className={cn(
        "prose prose-sm max-w-none",
        isDark ? "prose-invert" : "",
        "prose-headings:font-semibold prose-headings:tracking-tight",
        "prose-p:leading-relaxed prose-p:my-2",
        "prose-a:text-primary prose-a:no-underline hover:prose-a:underline",
        "prose-pre:p-0 prose-pre:m-0 prose-pre:bg-transparent",
        "prose-code:before:content-none prose-code:after:content-none",
        "prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded",
        "prose-code:text-foreground prose-code:font-mono prose-code:text-xs",
        "prose-strong:font-semibold prose-strong:text-foreground",
        "prose-ul:my-2 prose-ol:my-2",
        "prose-li:my-1",
        "prose-blockquote:border-l-primary prose-blockquote:bg-muted/50",
        "prose-blockquote:py-2 prose-blockquote:px-4 prose-blockquote:my-4",
        "prose-table:border-collapse prose-table:w-full",
        "prose-th:border prose-th:border-border prose-th:bg-muted prose-th:px-3 prose-th:py-2",
        "prose-td:border prose-td:border-border prose-td:px-3 prose-td:py-2",
        className
      )}
      remarkPlugins={[remarkGfm]}
      components={{
        code({ node, inline, className, children, ...props }: any) {
          const match = /language-(\w+)/.exec(className || "");
          const language = match ? match[1] : "";

          if (!inline && language) {
            return (
              <div className="relative group my-4">
                <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(String(children));
                    }}
                    className="px-2 py-1 text-xs bg-background/90 border border-border rounded hover:bg-accent text-foreground"
                    aria-label="Copy code"
                  >
                    Copy
                  </button>
                </div>
                <SyntaxHighlighter
                  style={isDark ? oneDark : oneLight}
                  language={language}
                  PreTag="div"
                  className="rounded-lg !my-0"
                  {...props}
                >
                  {String(children).replace(/\n$/, "")}
                </SyntaxHighlighter>
              </div>
            );
          }

          return (
            <code className={className} {...props}>
              {children}
            </code>
          );
        },
        a({ node, children, href, ...props }: any) {
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              {...props}
            >
              {children}
            </a>
          );
        },
        img({ node, src, alt, ...props }: any) {
          return (
            <img
              src={src}
              alt={alt}
              className="max-w-full h-auto rounded-lg my-4"
              loading="lazy"
              {...props}
            />
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
