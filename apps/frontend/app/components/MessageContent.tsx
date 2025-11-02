"use client";

import { useState, useEffect, useRef, memo } from "react";
import { marked } from "marked";

interface MessageContentProps {
  content: string;
  isStreaming?: boolean;
}

// Update interval for streaming content (10fps = 100ms)
const STREAMING_UPDATE_INTERVAL = 100;

// Parse markdown to HTML safely
function parseMarkdown(text: string): string {
  try {
    // Configure marked
    marked.setOptions({
      breaks: true,
      gfm: true,
      async: false,
    });

    return marked.parse(text, { async: false }) as string;
  } catch (error) {
    console.error("Error parsing markdown:", error);
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br />');
  }
}

function MessageContent({ content, isStreaming = false }: MessageContentProps) {
  const [renderedContent, setRenderedContent] = useState("");
  const contentRef = useRef(content);
  const lastUpdateRef = useRef(0);
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    contentRef.current = content;

    if (isStreaming) {
      // For streaming content, throttle updates to 10fps
      const updateContent = () => {
        const now = Date.now();
        if (now - lastUpdateRef.current >= STREAMING_UPDATE_INTERVAL) {
          const html = parseMarkdown(contentRef.current);
          setRenderedContent(html);
          lastUpdateRef.current = now;
        }
        animationFrameRef.current = requestAnimationFrame(updateContent);
      };

      animationFrameRef.current = requestAnimationFrame(updateContent);

      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };
    } else {
      // For non-streaming content, render immediately
      const html = parseMarkdown(content);
      setRenderedContent(html);
    }
  }, [content, isStreaming]);

  return (
    <div
      className="message-content-html"
      dangerouslySetInnerHTML={{ __html: renderedContent }}
    />
  );
}

// Memoize to prevent unnecessary re-renders
export default memo(MessageContent);
