import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import BottomSheet from "./BottomSheet.jsx";

describe("BottomSheet", () => {
  it("is a dialog that closes with Close, Escape or the backdrop, but not a click inside", () => {
    const onClose = vi.fn();
    render(
      <BottomSheet title="What's wrong?" onClose={onClose}>
        <p>Inside</p>
      </BottomSheet>
    );
    const dialog = screen.getByRole("dialog", { name: "What's wrong?" });
    expect(dialog).toHaveFocus();
    fireEvent.click(screen.getByText("Inside"));
    expect(onClose).not.toHaveBeenCalled();
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.mouseDown(screen.getByText("Inside"));
    fireEvent.click(dialog.parentElement); // a drag from inside that ends on the backdrop
    expect(onClose).toHaveBeenCalledTimes(2);
    fireEvent.mouseDown(dialog.parentElement);
    fireEvent.click(dialog.parentElement);
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("keeps Tab inside the sheet", () => {
    render(
      <BottomSheet title="Sheet" onClose={() => {}}>
        <button type="button">Send</button>
      </BottomSheet>
    );
    const close = screen.getByRole("button", { name: "Close" });
    const send = screen.getByRole("button", { name: "Send" });
    send.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(close).toHaveFocus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(send).toHaveFocus();
  });
});
