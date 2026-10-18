import { describe, expect, it, vi } from "vitest";
import { log } from "./logger.js";

describe("log", () => {
  it.each(["debug", "info", "warn", "error"])("forwards %s to the console", (level) => {
    const spy = vi.spyOn(console, level).mockImplementation(() => {});
    log[level]("hello", 1);
    expect(spy).toHaveBeenCalledWith("hello", 1); // tests run in dev mode, so debug logs too
  });
});
