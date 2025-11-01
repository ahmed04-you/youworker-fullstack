"use client";

import { useState, useRef, useEffect } from "react";

export default function Chats() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState<number | null>(null);
  const [activeChat, setActiveChat] = useState<number>(1);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const actionButtonRefs = useRef<{ [key: number]: HTMLButtonElement | null }>({});

  const mockChats = [
    { id: 1, title: "Project Discussion" },
    { id: 2, title: "Team Meeting Notes and Weekly Sprint Planning Session for Q4 2024" },
    { id: 3, title: "Design Review" },
    { id: 4, title: "Code Review Feedback" },
  ];

  useEffect(() => {
    if (activeMenu !== null && actionButtonRefs.current[activeMenu]) {
      const button = actionButtonRefs.current[activeMenu];
      if (button) {
        const rect = button.getBoundingClientRect();
        const menuHeight = 88; // Approximate height of menu with 2 items
        const viewportHeight = window.innerHeight;

        // Check if menu would go off bottom of screen
        const wouldOverflow = rect.bottom + menuHeight > viewportHeight;

        setMenuPosition({
          top: wouldOverflow ? rect.top - menuHeight + 6 : rect.bottom - 6,
          left: rect.right - 110,
        });
      }
    }
  }, [activeMenu, isDrawerOpen]);

  return (
    <div className="chats-page">
      <div className="chat-list-card">
        {isDrawerOpen && (
          <div
            className="drawer-blur-overlay"
            onClick={() => {
              setIsDrawerOpen(false);
              setActiveMenu(null);
            }}
          />
        )}
        {activeMenu !== null && (
          <div
            className="menu-overlay"
            onClick={() => setActiveMenu(null)}
          />
        )}
        {activeMenu !== null && (
          <div
            className="actions-menu"
            style={{
              top: `${menuPosition.top}px`,
              left: `${menuPosition.left}px`,
            }}
          >
            <button
              className="menu-item"
              onClick={() => {
                setActiveMenu(null);
                // Handle edit action here
              }}
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit
            </button>
            <button
              className="menu-item delete"
              onClick={() => {
                setActiveMenu(null);
                // Handle delete action here
              }}
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete
            </button>
          </div>
        )}

        <button
          className={`drawer-toggle ${isDrawerOpen ? "open" : ""}`}
          onClick={() => setIsDrawerOpen(!isDrawerOpen)}
        >
          <svg className="drawer-icon" viewBox="0 0 24 24" fill="none">
            <rect x="3.5" y="3.5" width="17" height="17" rx="3.5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M10.5 3.5 L10.5 20.5 L7 20.5 C4.79 20.5 3.5 19.21 3.5 17 L3.5 7 C3.5 4.79 4.79 3.5 7 3.5 Z" fill="currentColor"/>
            <path className="drawer-arrow" d="M14.5 9.5 L17 12 L14.5 14.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        <div
          className={`chat-drawer ${isDrawerOpen ? "open" : ""}`}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setActiveMenu(null);
            }
          }}
        >
          <button className="new-chat-btn">
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Chat
          </button>

          <div className="drawer-separator"></div>

          <div
            className="chat-history"
            onScroll={() => setActiveMenu(null)}
          >
            {mockChats.map((chat) => (
              <div
                key={chat.id}
                className={`chat-history-item ${activeChat === chat.id ? "active" : ""}`}
                onClick={() => setActiveChat(chat.id)}
              >
                <span className="chat-title">{chat.title}</span>
                <div className="chat-actions">
                  <button
                    ref={(el) => (actionButtonRefs.current[chat.id] = el)}
                    className="actions-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMenu(activeMenu === chat.id ? null : chat.id);
                    }}
                  >
                    <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                      <circle cx="12" cy="5" r="2" />
                      <circle cx="12" cy="12" r="2" />
                      <circle cx="12" cy="19" r="2" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Chat list content goes here */}
      </div>
      <div className="chat-detail-card">
        {isDrawerOpen && (
          <div
            className="drawer-blur-overlay"
            onClick={() => {
              setIsDrawerOpen(false);
              setActiveMenu(null);
            }}
          />
        )}
        {/* Chat details go here */}
      </div>
    </div>
  );
}
