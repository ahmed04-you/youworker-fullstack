"use client"

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Check, Copy } from "lucide-react"
import { cn } from "@/lib/utils"

interface ChatMarkdownProps {
  content: string
  className?: string
}

const Paragraph = ({ className, ...props }: ComponentPropsWithoutRef<"p">) => (
  <p className={cn("text-sm leading-relaxed text-foreground/90", className)} {...props} />
)

const Heading = (Tag: "h1" | "h2" | "h3" | "h4") =>
  ({ className, ...props }: ComponentPropsWithoutRef<typeof Tag>) => {
    const sizes: Record<typeof Tag, string> = {
      h1: "text-2xl",
      h2: "text-xl",
      h3: "text-lg",
      h4: "text-base",
    }

    return (
      <Tag
        className={cn(
          "scroll-m-20 font-semibold tracking-tight text-foreground",
          sizes[Tag],
          Tag === "h1" ? "mb-4 mt-6" : "mb-3 mt-5",
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
  const label =
    language.length > 0 ? language.replace(/[-_]/g, " ").toUpperCase() : undefined

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
    <div className="group relative">
      {label && (
        <span className="absolute left-3 top-3 rounded-md bg-background/80 px-2 py-0.5 text-[0.62rem] font-medium uppercase tracking-wide text-muted-foreground shadow-sm">
          {label}
        </span>
      )}
      {content && (
        <button
          type="button"
          aria-label="Copia codice"
          onClick={handleCopy}
          className="pointer-events-auto absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-md border border-border/50 bg-background/80 text-muted-foreground shadow-sm opacity-0 transition-opacity focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-primary/40 group-hover:opacity-100"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      )}
      <pre className="overflow-x-auto rounded-xl border border-border/50 bg-muted/40 p-3">
        <code
          className={cn("block font-mono text-xs leading-relaxed text-foreground/90", className)}
          {...props}
        >
          {content}
        </code>
      </pre>
    </div>
  )
}

export function ChatMarkdown({ content, className }: ChatMarkdownProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      className={cn("space-y-3 break-words", className)}
      components={{
        p: Paragraph,
        strong: ({ className, ...props }) => (
          <strong className={cn("font-semibold text-foreground", className)} {...props} />
        ),
        em: ({ className, ...props }) => <em className={cn("italic text-foreground/90", className)} {...props} />,
        a: ({ className, ...props }) => (
          <a
            className={cn(
              "text-primary underline-offset-4 decoration-primary/40 hover:underline focus:underline focus:outline-none",
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
                  "rounded-md bg-muted px-1.5 py-0.5 font-mono text-[0.8rem] text-foreground/90",
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
        blockquote: ({ className, ...props }) => (
          <blockquote
            className={cn(
              "border-l-2 border-primary/40 bg-primary/5 px-4 py-3 text-sm italic text-foreground/80",
              className,
            )}
            {...props}
          />
        ),
        ul: ({ className, ...props }) => (
          <ul className={cn("list-disc space-y-1.5 pl-6 text-sm text-foreground/90 marker:text-muted-foreground", className)} {...props} />
        ),
        ol: ({ className, ...props }) => (
          <ol className={cn("list-decimal space-y-1.5 pl-6 text-sm text-foreground/90 marker:text-muted-foreground", className)} {...props} />
        ),
        li: ({ className, children, ...props }) => (
          <li className={cn("leading-relaxed", className)} {...props}>
            <span className="inline-block align-baseline">{children}</span>
          </li>
        ),
        hr: ({ className, ...props }) => (
          <hr className={cn("my-4 border-border/60", className)} {...props} />
        ),
        table: ({ className, ...props }) => (
          <div className="overflow-x-auto">
            <table className={cn("w-full border-collapse text-sm text-foreground/90", className)} {...props} />
          </div>
        ),
        th: ({ className, ...props }) => (
          <th className={cn("border border-border/40 bg-muted/40 px-3 py-2 text-left font-semibold", className)} {...props} />
        ),
        td: ({ className, ...props }) => (
          <td className={cn("border border-border/40 px-3 py-2 align-top", className)} {...props} />
        ),
        img: ({ className, ...props }) => (
          <img
            loading="lazy"
            className={cn("max-h-96 w-full rounded-xl border border-border/40 object-cover", className)}
            {...props}
          />
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  )
}
