"use client";

import { createContext, useContext, useEffect, useState } from "react";

const KeyboardNavContext = createContext<{
  isKeyboardUser: boolean;
}>({ isKeyboardUser: false });

export function KeyboardNavProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isKeyboardUser, setIsKeyboardUser] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        setIsKeyboardUser(true);
        document.body.classList.add("keyboard-user");
      }
    };

    const handleMouseDown = () => {
      setIsKeyboardUser(false);
      document.body.classList.remove("keyboard-user");
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("mousedown", handleMouseDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mousedown", handleMouseDown);
    };
  }, []);

  return (
    <KeyboardNavContext.Provider value={{ isKeyboardUser }}>
      {children}
    </KeyboardNavContext.Provider>
  );
}

export const useKeyboardNav = () => useContext(KeyboardNavContext);
