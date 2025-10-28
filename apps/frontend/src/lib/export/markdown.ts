/**
 * Markdown export utilities
 */
import { SessionDetail } from "@/lib/types";
import type { ChatMessage } from "@/features/chat";

/**
 * Exports a conversation as Markdown format
 * @param session - Session metadata
 * @param messages - Array of conversation messages
 * @returns Formatted Markdown string
 */
export function exportConversationAsMarkdown(
  session: { title?: string | null; model?: string | null; created_at: string },
  messages: ChatMessage[]
): string {
  const title = session.title || 'Conversation';
  const date = new Date(session.created_at).toLocaleDateString();

  let markdown = `# ${title}\n\n`;
  markdown += `**Date:** ${date}\n`;
  if (session.model) {
    markdown += `**Model:** ${session.model}\n`;
  }
  markdown += `\n---\n\n`;

  messages.forEach((msg) => {
    const role = msg.role === 'user' ? '👤 User' : msg.role === 'assistant' ? '🤖 YouWorker' : '⚙️ System';
    markdown += `## ${role}\n\n`;
    markdown += `${msg.content}\n\n`;

    if (msg.toolCallName) {
      markdown += `*Used tool: ${msg.toolCallName}*\n\n`;
    }

    markdown += `---\n\n`;
  });

  return markdown;
}

/**
 * Triggers a download of Markdown content
 * @param filename - Name of the file to download
 * @param content - Markdown content
 */
export function downloadMarkdown(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.md') ? filename : `${filename}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
