const CHAT_HOME_THREAD_STORAGE_KEY = "agent-native.chat-home-thread";
const CHAT_HOME_THREAD_TTL_MS = 10 * 60 * 1000;

type PendingChatHomeThread = {
  id: string;
  issuedAt: number;
};

export function consumeChatHomeThreadId(threadId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.sessionStorage.getItem(CHAT_HOME_THREAD_STORAGE_KEY);
    window.sessionStorage.removeItem(CHAT_HOME_THREAD_STORAGE_KEY);
    if (!raw) return false;
    const pending = JSON.parse(raw) as Partial<PendingChatHomeThread>;
    return (
      pending.id === threadId &&
      typeof pending.issuedAt === "number" &&
      Date.now() - pending.issuedAt <= CHAT_HOME_THREAD_TTL_MS
    );
  } catch {
    // coercion-ok: sessionStorage is optional lifecycle attribution; the chat remains valid when unavailable.
    return false;
  }
}
