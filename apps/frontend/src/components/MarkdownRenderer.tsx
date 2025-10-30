"use client";

import { memo } from "react";
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
 * - Memoized to prevent unnecessary re-parsing during token streaming
 */
export const MarkdownRenderer = memo(function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const markdownClasses = cn(
    "prose prose-sm max-w-none",
    isDark ? "prose-invert" : "",

    // Base text styling - Compact readability
    "prose-p:text-sm prose-p:leading-relaxed prose-p:text-foreground/90",
    "prose-p:my-0 prose-p:mb-2",

    // Headings - Professional grayscale typography with subtle accents
    "prose-headings:font-bold prose-headings:tracking-tight prose-headings:scroll-mt-16",

    // H1 - Most prominent with subtle gradient
    "prose-h1:text-xl prose-h1:mb-3 prose-h1:mt-4 prose-h1:pb-2",
    "prose-h1:text-foreground",
    "prose-h1:border-b-2 prose-h1:border-border/60",

    // H2 - Secondary with subtle accent
    "prose-h2:text-lg prose-h2:mb-2 prose-h2:mt-4 prose-h2:pb-1.5",
    "prose-h2:text-foreground/95",
    "prose-h2:border-b prose-h2:border-border/50",

    // H3 - Tertiary
    "prose-h3:text-base prose-h3:mb-2 prose-h3:mt-3",
    "prose-h3:text-foreground/90",
    "prose-h3:font-semibold",

    // H4, H5, H6
    "prose-h4:text-sm prose-h4:mb-1.5 prose-h4:mt-3 prose-h4:text-foreground/85 prose-h4:font-semibold",
    "prose-h5:text-sm prose-h5:mb-1 prose-h5:mt-2 prose-h5:text-foreground/80",
    "prose-h6:text-sm prose-h6:mb-1 prose-h6:mt-2 prose-h6:text-foreground/75 prose-h6:font-medium",

    // Links - Subtle professional states
    "prose-a:text-primary prose-a:font-medium prose-a:no-underline",
    "prose-a:decoration-primary/50 prose-a:decoration-2 prose-a:underline-offset-2",
    "prose-a:transition-all prose-a:duration-200 prose-a:underline",
    "hover:prose-a:decoration-primary hover:prose-a:text-primary/80 hover:prose-a:underline-offset-4",

    // Code blocks - Compact styling (handled separately in components)
    "prose-pre:bg-transparent prose-pre:p-0 prose-pre:m-0",

    // Inline code - Professional grayscale pills
    "prose-code:before:content-none prose-code:after:content-none",
    "prose-code:bg-muted/80",
    "prose-code:text-foreground/90 prose-code:px-1.5 prose-code:py-0.5",
    "prose-code:rounded prose-code:text-[0.85em] prose-code:font-mono prose-code:font-semibold",
    "prose-code:border prose-code:border-border/60",
    "prose-code:transition-all prose-code:duration-200",
    "hover:prose-code:bg-muted hover:prose-code:border-border",

    // Strong/Bold - Subtle emphasis
    "prose-strong:font-bold prose-strong:text-foreground prose-strong:font-extrabold",

    // Em/Italic
    "prose-em:text-foreground/95 prose-em:italic",

    // Lists - Compact hierarchy
    "prose-ul:my-2 prose-ul:space-y-1",
    "prose-ol:my-2 prose-ol:space-y-1",
    "prose-li:my-0 prose-li:leading-relaxed prose-li:text-foreground/90",
    "prose-li:marker:text-primary prose-li:marker:font-bold",
    "prose-li:pl-1",

    // Nested lists
    "prose-li>ul:my-1 prose-li>ol:my-1",

    // Blockquotes - Professional grayscale cards
    "prose-blockquote:border-l-4 prose-blockquote:border-l-border",
    "prose-blockquote:bg-muted/40",
    "prose-blockquote:py-2 prose-blockquote:px-3 prose-blockquote:my-3",
    "prose-blockquote:rounded-r-lg prose-blockquote:shadow-sm",
    "prose-blockquote:text-foreground/95 prose-blockquote:not-italic",
    "prose-blockquote:font-normal prose-blockquote:text-sm",

    // Tables - Professional compact design
    "prose-table:w-full prose-table:border-collapse",
    "prose-table:rounded-lg prose-table:overflow-hidden",
    "prose-table:shadow-md prose-table:shadow-black/5",
    "prose-table:border prose-table:border-border/50",

    "prose-thead:bg-muted/60",
    "prose-thead:backdrop-blur-sm",

    "prose-th:border prose-th:border-border/50 prose-th:px-2 prose-th:py-1",
    "prose-th:font-bold prose-th:text-left prose-th:text-foreground",
    "prose-th:text-xs prose-th:uppercase prose-th:tracking-wide",

    "prose-td:border prose-td:border-border/50 prose-td:px-2 prose-td:py-1",
    "prose-td:text-foreground/90 prose-td:text-sm",

    "prose-tbody:divide-y prose-tbody:divide-border/50",
    "prose-tr:transition-all prose-tr:duration-200",
    "hover:prose-tr:bg-muted/30",

    // Horizontal rules - Subtle dividers
    "prose-hr:my-4 prose-hr:border-0 prose-hr:h-px",
    "prose-hr:bg-gradient-to-r prose-hr:from-transparent prose-hr:via-border prose-hr:to-transparent",

    // Images (will be styled in component)
    "prose-img:rounded-lg prose-img:shadow-lg prose-img:my-3",

    className
  );

  return (
    <article className={markdownClasses}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeSanitize]}
        components={{
        // Paragraphs
        p({ node, children, ...props }: any) {
          return (
            <p className="text-sm leading-relaxed text-foreground/90 my-0 mb-2" {...props}>
              {children}
            </p>
          );
        },
        // Headings with professional grayscale
        h1({ node, children, ...props }: any) {
          return (
            <h1
              className="text-xl font-bold tracking-tight mb-3 mt-4 pb-2 text-foreground border-b-2 border-border/60"
              {...props}
            >
              {children}
            </h1>
          );
        },
        h2({ node, children, ...props }: any) {
          return (
            <h2
              className="text-lg font-bold tracking-tight mb-2 mt-4 pb-1.5 text-foreground/95 border-b border-border/50"
              {...props}
            >
              {children}
            </h2>
          );
        },
        h3({ node, children, ...props }: any) {
          return (
            <h3
              className="text-base font-semibold tracking-tight mb-2 mt-3 text-foreground/90"
              {...props}
            >
              {children}
            </h3>
          );
        },
        h4({ node, children, ...props }: any) {
          return (
            <h4
              className="text-sm font-semibold mb-1.5 mt-3 text-foreground/85"
              {...props}
            >
              {children}
            </h4>
          );
        },
        h5({ node, children, ...props }: any) {
          return (
            <h5
              className="text-sm font-semibold mb-1 mt-2 text-foreground/80"
              {...props}
            >
              {children}
            </h5>
          );
        },
        h6({ node, children, ...props }: any) {
          return (
            <h6
              className="text-sm font-medium mb-1 mt-2 text-foreground/75"
              {...props}
            >
              {children}
            </h6>
          );
        },
        // Lists
        ul({ node, children, ...props }: any) {
          return (
            <ul className="my-2 space-y-1 list-disc pl-5" {...props}>
              {children}
            </ul>
          );
        },
        ol({ node, children, ...props }: any) {
          return (
            <ol className="my-2 space-y-1 list-decimal pl-5" {...props}>
              {children}
            </ol>
          );
        },
        li({ node, children, ...props }: any) {
          return (
            <li className="leading-relaxed text-sm text-foreground/90 marker:text-primary marker:font-bold" {...props}>
              {children}
            </li>
          );
        },
        // Strong/Bold
        strong({ node, children, ...props }: any) {
          return (
            <strong className="font-extrabold text-foreground" {...props}>
              {children}
            </strong>
          );
        },
        // Emphasis/Italic
        em({ node, children, ...props }: any) {
          return (
            <em className="italic text-foreground/95" {...props}>
              {children}
            </em>
          );
        },
        // Horizontal rule
        hr({ node, ...props }: any) {
          return (
            <hr
              className="my-4 border-0 h-px bg-gradient-to-r from-transparent via-border to-transparent"
              {...props}
            />
          );
        },
        // Tables
        table({ node, children, ...props }: any) {
          return (
            <div className="overflow-hidden rounded-lg shadow-md shadow-black/5 border border-border/50">
              <table className="w-full border-collapse" {...props}>
                {children}
              </table>
            </div>
          );
        },
        thead({ node, children, ...props }: any) {
          return (
            <thead
              className="bg-muted/60 backdrop-blur-sm"
              {...props}
            >
              {children}
            </thead>
          );
        },
        tbody({ node, children, ...props }: any) {
          return (
            <tbody className="divide-y divide-border/50" {...props}>
              {children}
            </tbody>
          );
        },
        tr({ node, children, ...props }: any) {
          return (
            <tr className="transition-all duration-200 hover:bg-muted/30" {...props}>
              {children}
            </tr>
          );
        },
        th({ node, children, ...props }: any) {
          return (
            <th
              className="border border-border/50 px-2 py-1 font-bold text-left text-foreground text-xs uppercase tracking-wide"
              {...props}
            >
              {children}
            </th>
          );
        },
        td({ node, children, ...props }: any) {
          return (
            <td
              className="border border-border/50 px-2 py-1 text-foreground/90 text-sm"
              {...props}
            >
              {children}
            </td>
          );
        },
        code({ node, inline, className, children, ...props }: any) {
          const match = /language-(\w+)/.exec(className || "");
          const language = match ? match[1] : "";

          if (!inline && language) {
            return (
              <div className="relative group overflow-hidden rounded-lg shadow-lg ring-1 ring-border/40 transition-all duration-300 hover:ring-primary/40 bg-card">
                {/* Header with language and controls */}
                <div className="relative flex items-center justify-between px-3 py-1.5 border-b border-border/40 bg-muted/50">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 rounded-full bg-red-500/80" />
                      <div className="w-2 h-2 rounded-full bg-yellow-500/80" />
                      <div className="w-2 h-2 rounded-full bg-green-500/80" />
                    </div>
                    <span className="ml-2 px-2 py-0.5 text-[10px] font-bold rounded bg-primary/15 text-primary border border-primary/30 uppercase tracking-wide">
                      {language}
                    </span>
                  </div>

                  {/* Copy button */}
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(String(children));
                    }}
                    className="px-2 py-1 text-[10px] font-semibold bg-primary/10 text-primary rounded border border-primary/20 hover:bg-primary hover:text-primary-foreground transition-all duration-200 opacity-60 group-hover:opacity-100"
                    aria-label="Copy code"
                  >
                    Copy
                  </button>
                </div>

                {/* Code content */}
                <div className="relative">
                  <SyntaxHighlighter
                    style={isDark ? oneDark : oneLight}
                    language={language}
                    PreTag="div"
                    className="!my-0 !rounded-none"
                    customStyle={{
                      margin: 0,
                      borderRadius: 0,
                      fontSize: "0.8125rem",
                      lineHeight: "1.5",
                      padding: "0.75rem",
                      background: isDark ? "rgb(40, 44, 52)" : "rgb(250, 250, 250)",
                    }}
                    showLineNumbers={false}
                    {...props}
                  >
                    {String(children).replace(/\n$/, "")}
                  </SyntaxHighlighter>
                </div>
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
              className="inline-flex items-center gap-1 group/link relative"
              {...props}
            >
              <span className="relative">
                {children}
                <span className="absolute bottom-0 left-0 w-full h-[2px] bg-gradient-to-r from-primary to-primary/60 transform scale-x-100 group-hover/link:scale-x-110 transition-transform duration-200 origin-left" />
              </span>
              <svg
                className="w-3.5 h-3.5 opacity-60 -translate-y-0.5 translate-x-0 group-hover/link:opacity-100 group-hover/link:translate-x-1 group-hover/link:-translate-y-1 transition-all duration-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </a>
          );
        },
        img({ node, src, alt, ...props }: any) {
          return (
            <figure className="group/img my-8">
              <div className="relative overflow-hidden rounded-2xl shadow-2xl ring-1 ring-border/30 transition-all duration-500 group-hover/img:shadow-[0_25px_70px_-15px_rgba(0,0,0,0.4)] group-hover/img:ring-primary/50">
                {/* Gradient overlay on hover */}
                <div className="absolute inset-0 bg-gradient-to-t from-primary/10 via-transparent to-transparent opacity-0 group-hover/img:opacity-100 transition-opacity duration-500 z-10 pointer-events-none" />

                <img
                  src={src}
                  alt={alt}
                  className="max-w-full h-auto transition-all duration-500 group-hover/img:scale-[1.03]"
                  loading="lazy"
                  {...props}
                />
              </div>
              {alt && (
                <figcaption className="mt-4 text-center text-sm text-muted-foreground italic px-4 py-2 rounded-lg bg-muted/30">
                  {alt}
                </figcaption>
              )}
            </figure>
          );
        },
        // Enhanced checkbox styling for task lists
        input({ node, type, checked, ...props }: any) {
          if (type === "checkbox") {
            return (
              <input
                type="checkbox"
                checked={checked}
                className="w-4 h-4 mr-2 rounded border-2 border-primary/40 text-primary focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer accent-primary"
                {...props}
              />
            );
          }
          return <input type={type} {...props} />;
        },
        // Enhanced blockquote with icon
        blockquote({ node, children, ...props }: any) {
          return (
            <blockquote className="relative" {...props}>
              {/* Quote icon */}
              <div className="absolute -left-2 -top-2 text-primary/20 text-6xl font-serif leading-none select-none">
                "
              </div>
              <div className="relative z-10">{children}</div>
            </blockquote>
          );
        },
        }}
      >
        {content}
      </ReactMarkdown>
    </article>
  );
});
