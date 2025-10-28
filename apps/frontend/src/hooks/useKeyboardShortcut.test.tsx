import { fireEvent, renderHook } from "@testing-library/react";

import { useKeyboardShortcut, useKeyboardShortcuts } from "./useKeyboardShortcut";

describe("useKeyboardShortcut", () => {
  it("runs callback when shortcut matches", () => {
    const callback = vi.fn();

    renderHook(() => useKeyboardShortcut("k", callback, { meta: true }));

    const event = new KeyboardEvent("keydown", { key: "k", metaKey: true, cancelable: true });
    document.dispatchEvent(event);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it("ignores plain input targets when ignoreInputs is enabled", () => {
    const callback = vi.fn();
    const { unmount } = renderHook(() => useKeyboardShortcut("k", callback));

    const input = document.createElement("input");
    document.body.appendChild(input);

    fireEvent.keyDown(input, { key: "k" });
    expect(callback).not.toHaveBeenCalled();

    document.body.removeChild(input);
    unmount();
  });

  it("invokes handler inside inputs when ignoreInputs is disabled", () => {
    const callback = vi.fn();
    renderHook(() => useKeyboardShortcut("k", callback, { ignoreInputs: false }));

    const textarea = document.createElement("textarea");
    document.body.appendChild(textarea);

    fireEvent.keyDown(textarea, { key: "k" });

    expect(callback).toHaveBeenCalledTimes(1);

    document.body.removeChild(textarea);
  });

  it("does not prevent default when preventDefault is false", () => {
    const callback = vi.fn();
    renderHook(() => useKeyboardShortcut("k", callback, { preventDefault: false }));

    const event = new KeyboardEvent("keydown", { key: "k", cancelable: true });
    document.dispatchEvent(event);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(false);
  });
});

describe("useKeyboardShortcuts", () => {
  it("dispatches the matching handler for registered shortcuts", () => {
    const paletteHandler = vi.fn();
    const exitHandler = vi.fn();

    renderHook(() =>
      useKeyboardShortcuts(
        {
          "cmd+k": paletteHandler,
          escape: exitHandler,
        },
        { preventDefault: true, ignoreInputs: false }
      )
    );

    fireEvent.keyDown(document.body, { key: "k", metaKey: true });
    expect(paletteHandler).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(exitHandler).toHaveBeenCalledTimes(1);
  });
});
