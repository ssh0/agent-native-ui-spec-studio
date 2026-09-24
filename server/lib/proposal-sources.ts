import { fail } from "@agent-native/core/action";
import { getThread } from "@agent-native/core/server";
import type { ProposalSource } from "../db/schema.js";

export type SourceInput = Pick<ProposalSource, "kind" | "threadId" | "messageId" | "attachmentId" | "locator" | "evidence" | "targetKeys">;

type StoredAttachment = { id?: string; name?: string; metadata?: { uploadUrl?: string; storageRequired?: boolean }; content?: Array<{ type?: string; text?: string; url?: string; image?: string }> };
type StoredMessage = { id?: string; role?: string; content?: Array<{ type?: string; text?: string }>; attachments?: StoredAttachment[] };
const durableUrl = (url: string | undefined) => !!url && url.length <= 2000 && (url.startsWith("https://") || url.startsWith("http://") || url.startsWith("/"));

export async function listProposalSources(projectId: string, ownerEmail: string, threadId: string) {
  const thread = await getThread(threadId);
  if (!thread || thread.ownerEmail !== ownerEmail || (projectId === "default"
    ? thread.scope !== null
    : thread.scope?.type !== "ui-spec-project" || thread.scope.id !== projectId))
    fail("参照元の会話がこのプロジェクトにありません。", { statusCode: 404 });
  let data: { messages?: Array<{ message?: StoredMessage } & StoredMessage> };
  try { data = JSON.parse(thread.threadData); } catch { fail("参照元の会話を読み取れません。", { statusCode: 400 }); }
  return (data.messages ?? []).map((entry) => entry.message ?? entry).filter((item) => item.role === "user" && item.id).map((item) => ({
    messageId: item.id!,
    text: item.content?.filter((part) => part.type === "text").map((part) => part.text ?? "").join("\n").slice(0, 8000) ?? "",
    attachments: (item.attachments ?? []).map((attachment) => ({
      attachmentId: attachment.id,
      name: attachment.name,
      durable: durableUrl(attachment.metadata?.uploadUrl ?? attachment.content?.find((part) => part.url || part.image)?.url ?? attachment.content?.find((part) => part.url || part.image)?.image) && !attachment.metadata?.storageRequired,
    })).filter((item) => item.attachmentId),
  }));
}

/** Resolve source IDs against the private project thread. Never accept a caller-supplied file URL. */
export async function resolveProposalSources(projectId: string, ownerEmail: string, sources: SourceInput[]): Promise<ProposalSource[]> {
  const threads = new Map<string, Awaited<ReturnType<typeof getThread>>>();
  const result: ProposalSource[] = [];
  for (const source of sources) {
    let thread = threads.get(source.threadId);
    if (thread === undefined) {
      thread = await getThread(source.threadId);
      threads.set(source.threadId, thread);
    }
    if (!thread || thread.ownerEmail !== ownerEmail || (projectId === "default"
      ? thread.scope !== null
      : thread.scope?.type !== "ui-spec-project" || thread.scope.id !== projectId)) {
      fail("参照元の会話がこのプロジェクトにありません。", { statusCode: 404 });
    }
    let data: { messages?: Array<{ message?: StoredMessage } & StoredMessage> };
    try { data = JSON.parse(thread.threadData); } catch { fail("参照元の会話を読み取れません。", { statusCode: 400 }); }
    const message = data.messages?.map((entry) => entry.message ?? entry).find((item) => item.id === source.messageId && item.role === "user");
    if (!message) fail("参照元のメッセージが見つかりません。", { statusCode: 404 });
    if (source.kind === "chat") {
      if (source.attachmentId) fail("会話の引用に添付 ID は指定できません。", { statusCode: 400 });
      const text = message.content?.filter((part) => part.type === "text").map((part) => part.text ?? "").join("\n") ?? "";
      if (!text.includes(source.evidence)) fail("引用文が指定メッセージにありません。", { statusCode: 400 });
      result.push({ ...source, evidenceVerified: true });
      continue;
    }
    if (!source.attachmentId) fail("添付 ID を指定してください。", { statusCode: 400 });
    const attachment = message.attachments?.find((item) => item.id === source.attachmentId);
    if (!attachment || attachment.metadata?.storageRequired) fail("利用可能な添付資料が見つかりません。", { statusCode: 404 });
    const url = attachment.metadata?.uploadUrl ?? attachment.content?.find((part) => part.url || part.image)?.url ?? attachment.content?.find((part) => part.url || part.image)?.image;
    if (!durableUrl(url)) fail("添付資料の保存先がありません。", { statusCode: 400 });
    result.push({ ...source, attachmentName: attachment.name ?? "attachment", attachmentUrl: url, evidenceVerified: false });
  }
  return result;
}
