'use client'

import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { GlassCard } from '@/src/components/ui/glass/GlassCard'
import { GlassButton } from '@/src/components/ui/glass/GlassButton'
import { Message } from '@/src/lib/types'
import { formatTimestamp } from '@/src/lib/utils'
import { User, Bot, Copy, Check } from 'lucide-react'

interface MessageItemProps {
  message: Message
}

function CodeBlock({ children, className }: { children: string; className?: string }) {
  const [copied, setCopied] = useState(false)
  const language = className?.replace('language-', '') || 'text'

  const handleCopy = async () => {
    await navigator.clipboard.writeText(children)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative group my-2">
      <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <GlassButton
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="h-8"
        >
          {copied ? (
            <Check className="w-4 h-4 text-green-400" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </GlassButton>
      </div>
      <div className="rounded-lg bg-[#1a1625]/80 p-3 overflow-x-auto border border-[var(--color-glass-dark)]">
        <div className="text-xs text-white/50 mb-2 font-mono">{language}</div>
        <pre className="text-sm">
          <code className={className}>{children}</code>
        </pre>
      </div>
    </div>
  )
}

export function MessageItem({ message }: MessageItemProps) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
        isUser
          ? 'bg-gradient-brand'
          : 'bg-gradient-slate'
      }`}>
        {isUser ? (
          <User className="w-4 h-4 text-white" />
        ) : (
          <Bot className="w-4 h-4 text-white" />
        )}
      </div>

      {/* Message content */}
      <div className={`flex-1 max-w-[70%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        <GlassCard variant="card" className="p-3">
          <div className="markdown-content text-white text-sm leading-relaxed">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={{
                // Code blocks
                code(props) {
                  const { children, className, node, ...rest } = props
                  const match = /language-(\w+)/.exec(className || '')
                  const codeString = String(children).replace(/\n$/, '')
                  const isInline = !match

                  if (!isInline && match) {
                    return <CodeBlock className={className}>{codeString}</CodeBlock>
                  }

                  // Inline code
                  return (
                    <code
                      className="px-1.5 py-0.5 rounded bg-[#454055]/50 text-[#E32D21] font-mono text-xs border border-[var(--color-glass-dark)]"
                      {...rest}
                    >
                      {children}
                    </code>
                  )
                },
                // Headings
                h1: ({ children }) => <h1 className="text-2xl font-bold mb-3 mt-4 text-white">{children}</h1>,
                h2: ({ children }) => <h2 className="text-xl font-bold mb-2 mt-3 text-white">{children}</h2>,
                h3: ({ children }) => <h3 className="text-lg font-semibold mb-2 mt-3 text-white">{children}</h3>,
                h4: ({ children }) => <h4 className="text-base font-semibold mb-2 mt-2 text-white">{children}</h4>,
                h5: ({ children }) => <h5 className="text-sm font-semibold mb-1 mt-2 text-white">{children}</h5>,
                h6: ({ children }) => <h6 className="text-sm font-semibold mb-1 mt-2 text-white/90">{children}</h6>,
                // Paragraphs
                p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
                // Lists
                ul: ({ children }) => <ul className="list-disc list-inside mb-3 space-y-1 pl-2">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal list-inside mb-3 space-y-1 pl-2">{children}</ol>,
                li: ({ children }) => <li className="text-white/90">{children}</li>,
                // Blockquotes
                blockquote: ({ children }) => (
                  <blockquote className="border-l-4 border-[#E32D21] pl-4 py-2 my-3 bg-[#454055]/20 italic text-white/80">
                    {children}
                  </blockquote>
                ),
                // Links
                a: ({ href, children }) => (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#E32D21] hover:text-[#E32D21]/80 underline transition-colors"
                  >
                    {children}
                  </a>
                ),
                // Tables
                table: ({ children }) => (
                  <div className="overflow-x-auto my-3">
                    <table className="min-w-full border border-[var(--color-glass-dark)] rounded-lg">
                      {children}
                    </table>
                  </div>
                ),
                thead: ({ children }) => <thead className="bg-[#454055]/30">{children}</thead>,
                tbody: ({ children }) => <tbody>{children}</tbody>,
                tr: ({ children }) => <tr className="border-b border-[var(--color-glass-dark)] last:border-0">{children}</tr>,
                th: ({ children }) => (
                  <th className="px-3 py-2 text-left text-xs font-semibold text-white border-r border-[var(--color-glass-dark)] last:border-0">
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td className="px-3 py-2 text-sm text-white/90 border-r border-[var(--color-glass-dark)] last:border-0">
                    {children}
                  </td>
                ),
                // Horizontal rule
                hr: () => <hr className="my-4 border-[var(--color-glass-dark)]" />,
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        </GlassCard>
        <span className="text-xs text-white/40 px-2">
          {formatTimestamp(message.timestamp)}
        </span>
      </div>
    </div>
  )
}
