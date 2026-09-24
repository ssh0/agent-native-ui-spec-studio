import { agentNativePath } from "@agent-native/core/client/api-path";

/** Persist Core's thread scope before the first message or attachment. */
export async function createProjectThread(
  id: string,
  project: { id: string; name: string },
) {
  const scope =
    project.id === "default"
      ? null
      : { type: "ui-spec-project", id: project.id, label: project.name };
  const response = await fetch(
    agentNativePath("/_agent-native/agent-chat/threads"),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        title: "新しい会話",
        ...(scope ? { scope } : {}),
      }),
    },
  );
  if (!response.ok && response.status !== 409)
    throw new Error(
      "会話を作成できませんでした。接続を確認して再試行してください。",
    );
}

/** Empty chats are omitted from the thread list, so verify an explicit route by id. */
export async function projectThreadExists(
  threadId: string,
  projectId: string,
): Promise<boolean> {
  const params = new URLSearchParams();
  if (projectId !== "default") {
    params.set("scopeType", "ui-spec-project");
    params.set("scopeId", projectId);
  }
  const response = await fetch(
    agentNativePath(
      `/_agent-native/agent-chat/threads/${encodeURIComponent(threadId)}${params.size ? `?${params}` : ""}`,
    ),
  );
  if (!response.ok) return false;
  const thread = await response.json();
  return (
    thread?.id === threadId &&
    (projectId === "default"
      ? !thread.scope
      : thread.scope?.type === "ui-spec-project" &&
        thread.scope.id === projectId)
  );
}
