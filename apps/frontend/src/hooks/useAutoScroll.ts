import { useEffect, useRef, useState, useCallback } from "react";

interface UseAutoScrollOptions {
  enabled?: boolean;
  threshold?: number; // pixels from bottom to consider "at bottom"
}

export function useAutoScroll<T extends HTMLElement>({
  enabled = true,
  threshold = 100,
}: UseAutoScrollOptions = {}) {
  const scrollRef = useRef<T | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const prevScrollHeight = useRef(0);
  const userScrolledUp = useRef(false);

  const checkIfAtBottom = useCallback(() => {
    if (!scrollRef.current) return true;

    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

    return distanceFromBottom <= threshold;
  }, [threshold]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    if (!scrollRef.current) return;

    scrollRef.current.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior,
    });

    setIsAtBottom(true);
    setHasNewMessages(false);
    userScrolledUp.current = false;
  }, []);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;

    const atBottom = checkIfAtBottom();
    setIsAtBottom(atBottom);

    if (atBottom) {
      setHasNewMessages(false);
      userScrolledUp.current = false;
    } else {
      userScrolledUp.current = true;
    }
  }, [checkIfAtBottom]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    element.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      element.removeEventListener("scroll", handleScroll);
    };
  }, [handleScroll]);

  useEffect(() => {
    if (!enabled || !scrollRef.current) return;

    const element = scrollRef.current;
    const currentScrollHeight = element.scrollHeight;

    // Content has changed (new messages)
    if (currentScrollHeight !== prevScrollHeight.current) {
      if (isAtBottom && !userScrolledUp.current) {
        // Auto-scroll if user is at bottom
        scrollToBottom("smooth");
      } else if (userScrolledUp.current) {
        // User has scrolled up, show "new messages" indicator
        setHasNewMessages(true);
      }

      prevScrollHeight.current = currentScrollHeight;
    }
  }, [enabled, isAtBottom, scrollToBottom]);

  return {
    scrollRef,
    isAtBottom,
    hasNewMessages,
    scrollToBottom,
  };
}
