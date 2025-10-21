"use client"

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react"
import { memo } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeHighlight from "rehype-highlight"
import rehypeRaw from "rehype-raw"
import { Check, Copy } from "lucide-react"
import { cn } from "@/lib/utils"
import "highlight.js/styles/github-dark.css"

interface ChatMarkdownProps {
  content: string
  className?: string
}

const Paragraph = ({ className, ...props }: ComponentPropsWithoutRef<"p">) => (
  <p className={cn("mb-4 leading-7 text-foreground/90 [&:not(:first-child)]:mt-4", className)} {...props} />
)

const Heading = (Tag: "h1" | "h2" | "h3" | "h4") =>
  ({ className, ...props }: ComponentPropsWithoutRef<typeof Tag>) => {
    const styles: Record<typeof Tag, string> = {
      h1: "text-3xl font-bold mt-8 mb-4 pb-2 border-b border-border/40",
      h2: "text-2xl font-semibold mt-8 mb-4",
      h3: "text-xl font-semibold mt-6 mb-3",
      h4: "text-lg font-semibold mt-4 mb-2",
    }

    return (
      <Tag
        className={cn(
          "scroll-m-20 tracking-tight text-foreground first:mt-0",
          styles[Tag],
          className,
        )}
        {...props}
      />
    )
  }

const toPlainString = (value: ReactNode): string => {
  if (value == null) return ""
  if (typeof value === "string" || typeof value === "number") return String(value)
  if (Array.isArray(value)) return value.map(toPlainString).join("")
  return ""
}

type CodeBlockProps = ComponentPropsWithoutRef<"code"> & { children: ReactNode }

const CodeBlock = ({ className, children, ...props }: CodeBlockProps) => {
  const [copied, setCopied] = useState(false)
  const resetTimer = useRef<ReturnType<typeof setTimeout>>()

  const langMatch = /language-([\w-]+)/.exec(className || "")
  const language = langMatch?.[1] ?? ""
  const content = toPlainString(children).replace(/\n$/, "")
  const label = language.length > 0 ? language.replace(/[-_]/g, " ").toUpperCase() : "CODE"

  const handleCopy = useCallback(async () => {
    if (!content) return
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(content)
        setCopied(true)
        if (resetTimer.current) {
          clearTimeout(resetTimer.current)
        }
        resetTimer.current = setTimeout(() => setCopied(false), 1600)
      }
    } catch {
      setCopied(false)
    }
  }, [content])

  useEffect(() => {
    return () => {
      if (resetTimer.current) {
        clearTimeout(resetTimer.current)
      }
    }
  }, [])

  return (
    <div className="group relative my-4 rounded-lg border border-border/50 bg-muted/30 overflow-hidden">
      <div className="flex items-center justify-between border-b border-border/40 bg-muted/50 px-4 py-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        {content && (
          <button
            type="button"
            aria-label="Copia codice"
            onClick={handleCopy}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border/50 bg-background/80 text-muted-foreground transition-all hover:bg-background hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>
      <pre className="overflow-x-auto p-4">
        <code
          className={cn("block font-mono text-sm leading-relaxed", className)}
          {...props}
        >
          {children}
        </code>
      </pre>
    </div>
  )
}

export const ChatMarkdown = memo(function ChatMarkdown({ content, className }: ChatMarkdownProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw, rehypeHighlight]}
      className={cn("prose prose-neutral dark:prose-invert max-w-none break-words", className)}
      components={{
        p: Paragraph,
        strong: ({ className, ...props }) => (
          <strong className={cn("font-semibold text-foreground", className)} {...props} />
        ),
        em: ({ className, ...props }) => <em className={cn("italic", className)} {...props} />,
        a: ({ className, ...props }) => (
          <a
            className={cn(
              "font-medium text-primary underline underline-offset-4 decoration-primary/50 hover:decoration-primary transition-colors",
              className,
            )}
            target="_blank"
            rel="noreferrer"
            {...props}
          />
        ),
        h1: Heading("h1"),
        h2: Heading("h2"),
        h3: Heading("h3"),
        h4: Heading("h4"),
        code: ({ inline, className, children, ...props }) => {
          if (inline) {
            return (
              <code
                className={cn(
                  "relative rounded bg-muted px-[0.4rem] py-[0.2rem] font-mono text-sm font-medium text-foreground border border-border/40",
                  className,
                )}
                {...props}
              >
                {children}
              </code>
            )
          }
          return <CodeBlock className={className} {...props}>{children}</CodeBlock>
        },
        pre: ({ className, ...props }) => (
          <pre className={cn("", className)} {...props} />
        ),
        blockquote: ({ className, ...props }) => (
          <blockquote
            className={cn(
              "my-4 border-l-4 border-primary/60 bg-muted/40 pl-4 pr-4 py-3 italic [&>p]:mb-0",
              className,
            )}
            {...props}
          />
        ),
        ul: ({ className, ...props }) => (
          <ul className={cn("my-4 ml-6 list-disc space-y-2 [&>li]:mt-2", className)} {...props} />
        ),
        ol: ({ className, ...props }) => (
          <ol className={cn("my-4 ml-6 list-decimal space-y-2 [&>li]:mt-2", className)} {...props} />
        ),
        li: ({ className, ...props }) => (
          <li className={cn("leading-7", className)} {...props} />
        ),
        hr: ({ className, ...props }) => (
          <hr className={cn("my-6 border-border", className)} {...props} />
        ),
        table: ({ className, ...props }) => (
          <div className="my-4 overflow-x-auto rounded-lg border border-border/40">
            <table className={cn("w-full border-collapse text-sm", className)} {...props} />
          </div>
        ),
        thead: ({ className, ...props }) => (
          <thead className={cn("bg-muted/50", className)} {...props} />
        ),
        th: ({ className, ...props }) => (
          <th className={cn("border-b border-border/40 px-4 py-2 text-left font-semibold [&[align=center]]:text-center [&[align=right]]:text-right", className)} {...props} />
        ),
        td: ({ className, ...props }) => (
          <td className={cn("border-b border-border/30 px-4 py-2 [&[align=center]]:text-center [&[align=right]]:text-right", className)} {...props} />
        ),
        tr: ({ className, ...props }) => (
          <tr className={cn("transition-colors hover:bg-muted/30", className)} {...props} />
        ),
        img: ({ className, ...props }) => (
          <img
            loading="lazy"
            className={cn("my-4 max-w-full rounded-lg border border-border/40 shadow-sm", className)}
            {...props}
          />
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  )
})
