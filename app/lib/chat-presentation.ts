export type ChatPresentation = "full" | "pane" | "hidden";

export function chatPresentation(
  pathname: string,
  paneOpen: boolean,
): ChatPresentation {
  if (pathname.startsWith("/chat/")) return "full";
  if (pathname === "/spec" && paneOpen) return "pane";
  return "hidden";
}
