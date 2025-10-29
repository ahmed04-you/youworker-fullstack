"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * Renders markdown content with syntax highlighting, HTML support, and beautiful styling
 *
 * Features:
 * - GitHub Flavored Markdown (tables, strikethrough, task lists)
 * - HTML element support (including <br> tags)
 * - Syntax highlighted code blocks with copy button
 * - Theme-aware styling (dark/light mode)
 * - Beautiful Tailwind Typography prose styles
 * - Responsive design
 */
export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const markdownClasses = cn(
    "prose prose-base lg:prose-lg max-w-none",
    isDark ? "prose-invert" : "",

    // Headings - Stunning typography
    "prose-headings:font-bold prose-headings:tracking-tight",
    "prose-h1:text-3xl prose-h1:mb-5 prose-h1:mt-8 prose-h1:pb-3 prose-h1:border-b-2 prose-h1:border-primary/30",
    "prose-h2:text-2xl prose-h2:mb-4 prose-h2:mt-8 prose-h2:pb-2 prose-h2:border-b prose-h2:border-border/50",
    "prose-h3:text-xl prose-h3:mb-3 prose-h3:mt-6 prose-h3:text-primary",
    "prose-h4:text-lg prose-h4:mb-2 prose-h4:mt-5",

    // Paragraphs - Enhanced readability
    "prose-p:leading-relaxed prose-p:my-4 prose-p:text-[15px]",

    // Links - Beautiful hover effects
    "prose-a:text-primary prose-a:font-medium prose-a:no-underline",
    "prose-a:underline prose-a:decoration-primary/40 prose-a:decoration-2 prose-a:underline-offset-4",
    "prose-a:transition-all prose-a:duration-200",
    "hover:prose-a:decoration-primary hover:prose-a:text-primary/80",

    // Code blocks - Premium styling
    "prose-pre:bg-transparent prose-pre:p-0 prose-pre:m-0",

    // Inline code - Refined appearance
    "prose-code:before:content-none prose-code:after:content-none",
    "prose-code:bg-primary/10 prose-code:text-primary prose-code:px-1.5 prose-code:py-0.5",
    "prose-code:rounded prose-code:text-[13px] prose-code:font-mono prose-code:font-medium",
    "prose-code:border prose-code:border-primary/20",

    // Strong/Bold - Emphasis
    "prose-strong:font-bold prose-strong:text-foreground",

    // Lists - Beautiful spacing
    "prose-ul:my-4 prose-ul:space-y-1.5",
    "prose-ol:my-4 prose-ol:space-y-1.5",
    "prose-li:my-1 prose-li:leading-relaxed",
    "prose-li:marker:text-primary prose-li:marker:font-bold",

    // Blockquotes - Elegant
    "prose-blockquote:border-l-4 prose-blockquote:border-l-primary",
    "prose-blockquote:bg-muted/40 prose-blockquote:py-3 prose-blockquote:px-5",
    "prose-blockquote:my-5 prose-blockquote:italic prose-blockquote:rounded-r-lg",
    "prose-blockquote:text-foreground/90 prose-blockquote:not-italic",

    // Tables - Modern and clean
    "prose-table:w-full prose-table:my-5 prose-table:border-collapse",
    "prose-table:rounded-lg prose-table:overflow-hidden",
    "prose-thead:bg-muted",
    "prose-th:border prose-th:border-border prose-th:px-4 prose-th:py-2.5",
    "prose-th:font-semibold prose-th:text-left",
    "prose-td:border prose-td:border-border prose-td:px-4 prose-td:py-2.5",
    "prose-tr:transition-colors hover:prose-tr:bg-muted/50",

    // Horizontal rules
    "prose-hr:my-8 prose-hr:border-t-2 prose-hr:border-border/50",

    className
  );

  return (
    <div className={markdownClasses}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeSanitize]}
        components={{
        code({ node, inline, className, children, ...props }: any) {
          const match = /language-(\w+)/.exec(className || "");
          const language = match ? match[1] : "";

          if (!inline && language) {
            return (
              <div className="relative group my-6 overflow-hidden rounded-xl shadow-lg ring-1 ring-border/50 transition-all duration-300 hover:shadow-xl hover:ring-primary/30">
                {/* Language badge */}
                <div className="absolute left-4 top-3 z-10">
                  <span className="px-3 py-1 text-xs font-semibold rounded-full bg-primary/10 text-primary border border-primary/20 backdrop-blur-sm">
                    {language}
                  </span>
                </div>

                {/* Copy button */}
                <div className="absolute right-3 top-3 z-10 opacity-0 group-hover:opacity-100 transition-all duration-200">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(String(children));
                    }}
                    className="px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg shadow-md hover:bg-primary/90 hover:scale-105 transition-all duration-200 active:scale-95"
                    aria-label="Copy code"
                  >
                    Copy
                  </button>
                </div>

                <SyntaxHighlighter
                  style={isDark ? oneDark : oneLight}
                  language={language}
                  PreTag="div"
                  className="!my-0 !rounded-xl !pt-12 !pb-4"
                  customStyle={{
                    margin: 0,
                    borderRadius: "0.75rem",
                    fontSize: "0.875rem",
                    lineHeight: "1.5",
                  }}
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
              className="inline-flex items-center gap-1 group/link"
              {...props}
            >
              {children}
              <svg
                className="w-3 h-3 opacity-0 -translate-y-0.5 translate-x-0 group-hover/link:opacity-100 group-hover/link:translate-x-0.5 group-hover/link:translate-y-0 transition-all duration-200"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </a>
          );
        },
        img({ node, src, alt, ...props }: any) {
          return (
            <figure className="group/img my-6">
              <img
                src={src}
                alt={alt}
                className="max-w-full h-auto rounded-xl shadow-lg ring-1 ring-border/20 transition-all duration-300 group-hover/img:shadow-2xl group-hover/img:scale-[1.02] group-hover/img:ring-primary/30"
                loading="lazy"
                {...props}
              />
              {alt && (
                <figcaption className="mt-3 text-center text-sm text-muted-foreground italic">
                  {alt}
                </figcaption>
              )}
            </figure>
          );
        },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
