import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { consumeChatHomeThreadId } from "./chat-home-thread";

const key = "agent-native.chat-home-thread";
const now = Date.parse("2026-01-01T00:00:00Z");
let values: Map<string, string>;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  values = new Map();
  vi.stubGlobal("window", {
    sessionStorage: {
      getItem: (name: string) => values.get(name) ?? null,
      removeItem: (name: string) => values.delete(name),
    },
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("retained chat-home handoff consumption", () => {
  it("consumes a matching handoff once without creating another thread", () => {
    values.set(key, JSON.stringify({ id: "chat-example", issuedAt: now }));
    expect(consumeChatHomeThreadId("chat-example")).toBe(true);
    expect(values.has(key)).toBe(false);
    expect(consumeChatHomeThreadId("chat-example")).toBe(false);
    expect(values.size).toBe(0);
  });

  it("accepts a handoff at the TTL boundary", () => {
    values.set(
      key,
      JSON.stringify({ id: "chat-example", issuedAt: now - 10 * 60 * 1000 }),
    );
    expect(consumeChatHomeThreadId("chat-example")).toBe(true);
  });

  it.each([
    JSON.stringify({ id: "chat-other-example", issuedAt: now }),
    JSON.stringify({ id: "chat-example", issuedAt: now - 10 * 60 * 1000 - 1 }),
    JSON.stringify({ id: "chat-example", issuedAt: "invalid" }),
    "not valid JSON",
  ])("clears an invalid, expired or mismatched handoff: %s", (raw) => {
    values.set(key, raw);
    expect(consumeChatHomeThreadId("chat-example")).toBe(false);
    expect(values.has(key)).toBe(false);
  });

  it("does not create a handoff when none exists", () => {
    expect(consumeChatHomeThreadId("chat-example")).toBe(false);
    expect(values.size).toBe(0);
  });

  it("works without a browser or accessible session storage", () => {
    vi.stubGlobal("window", undefined);
    expect(consumeChatHomeThreadId("chat-example")).toBe(false);
    vi.stubGlobal("window", {
      sessionStorage: {
        getItem: () => {
          throw new Error("storage blocked");
        },
      },
    });
    expect(consumeChatHomeThreadId("chat-example")).toBe(false);
  });
});
