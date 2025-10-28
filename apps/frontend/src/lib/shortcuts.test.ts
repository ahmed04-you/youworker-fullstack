import { afterEach, describe, expect, it, vi } from "vitest";
import * as shortcuts from "./shortcuts";

describe("shortcuts utilities", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("groups shortcuts by their category names", () => {
    const categories = shortcuts.getShortcutsByCategory();

    const navigation = categories.find((category) => category.name === "Navigation");
    expect(navigation).toBeDefined();
    expect(navigation?.shortcuts).toEqual(
      expect.arrayContaining([expect.objectContaining({ key: "cmd+n" })])
    );

    const chat = categories.find((category) => category.name === "Chat");
    expect(chat?.shortcuts).toEqual(
      expect.arrayContaining([expect.objectContaining({ key: "cmd+enter" })])
    );
  });

  it("formats shortcut keys using detected modifier", () => {
    const spy = vi.spyOn(shortcuts, "getModifierKey").mockReturnValue("Ctrl");
    expect(shortcuts.formatShortcutKey("cmd+k")).toBe("Ctrl+k");
    spy.mockRestore();
  });

  it("parses keyboard events and matches shortcuts correctly", () => {
    const event = {
      key: "V",
      metaKey: true,
      ctrlKey: false,
      shiftKey: true,
      altKey: false,
    } as KeyboardEvent;

    expect(shortcuts.parseKeyboardEvent(event)).toBe("cmd+shift+v");
    expect(shortcuts.matchesShortcut(event, "cmd+shift+v")).toBe(true);
    expect(shortcuts.matchesShortcut(event, "cmd+v")).toBe(false);
  });
});
