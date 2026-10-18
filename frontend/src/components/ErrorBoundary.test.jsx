import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { log } from "../logger.js";
import ErrorBoundary from "./ErrorBoundary.jsx";

function Boom() {
  throw new Error("kaboom");
}

describe("ErrorBoundary", () => {
  it("renders its children when nothing breaks", () => {
    render(<ErrorBoundary><p>Fine</p></ErrorBoundary>);
    expect(screen.getByText("Fine")).toBeInTheDocument();
  });

  it("logs a render crash and shows a fallback", () => {
    vi.spyOn(console, "error").mockImplementation(() => {}); // React reports the caught error too
    const logError = vi.spyOn(log, "error").mockImplementation(() => {});
    render(<ErrorBoundary><Boom /></ErrorBoundary>);
    expect(screen.getByRole("heading", { name: "Something went wrong" })).toBeInTheDocument();
    expect(logError).toHaveBeenCalledWith("Unhandled UI error", expect.objectContaining({ message: "kaboom" }), expect.any(String));
  });
});
