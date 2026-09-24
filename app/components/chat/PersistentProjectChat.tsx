import { useChatThreads } from "@agent-native/core/client/agentkit-chat/rail";
import { useActionQuery } from "@agent-native/core/client/hooks";
import { IconMenu2, IconMessage, IconX } from "@tabler/icons-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";

import { Button } from "@/components/ui/button";
import { APP_TITLE } from "@/lib/app-config";
import { chatPresentation } from "@/lib/chat-presentation";
import { createProjectThread, projectThreadExists } from "@/lib/project-chat";
import { selectProjectThread } from "@/lib/project-chat-selection";

import { ChatThreadRouteContent } from "./ChatRouteContent";

type Selection = { projectId: string; threadId: string };

function remember(selection: Selection) {
  try {
    localStorage.setItem(
      `ui-spec-chat-active:${selection.projectId}`,
      selection.threadId,
    );
  } catch {
    /* Optional browser storage. */
  }
}

function remembered(projectId: string): string | null {
  try {
    return localStorage.getItem(`ui-spec-chat-active:${projectId}`);
  } catch {
    return null;
  }
}

export function PersistentProjectChat({
  onOpenMobileSidebar,
}: {
  onOpenMobileSidebar: () => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const projectId = new URLSearchParams(location.search).get("project") ?? "";
  const routeThreadId = location.pathname.startsWith("/chat/")
    ? decodeURIComponent(location.pathname.slice(6).split("/")[0] ?? "")
    : "";
  const fullPage = Boolean(routeThreadId);
  const specPage = location.pathname === "/spec";
  const projects = useActionQuery("project-list", {});
  const project = projects.data?.find((item) => item.id === projectId);
  const scope = useMemo(
    () =>
      project && project.id !== "default"
        ? { type: "ui-spec-project", id: project.id, label: project.name }
        : null,
    [project?.id, project?.name],
  );
  const history = useChatThreads(undefined, "chat", scope, {
    autoCreate: false,
    restoreActiveThread: false,
    isolateHistoryByScope: Boolean(scope),
  });
  const [selection, setSelection] = useState<Selection | null>(null);
  const [paneOpen, setPaneOpen] = useState(false);
  const [error, setError] = useState("");
  const [opening, setOpening] = useState(false);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setPaneOpen(false);
  }, [projectId]);

  useEffect(() => {
    if (!fullPage || !project || !routeThreadId) return;
    let active = true;
    void projectThreadExists(routeThreadId, project.id)
      .then((exists) => {
        if (!active) return;
        if (exists) {
          const next = { projectId: project.id, threadId: routeThreadId };
          setSelection(next);
          remember(next);
          setError("");
        } else setError("このプロジェクトの会話を開けませんでした。");
      })
      .catch(() => {
        if (active) setError("会話を確認できませんでした。");
      });
    return () => {
      active = false;
    };
  }, [fullPage, project?.id, routeThreadId]);

  useEffect(() => {
    if (
      !specPage ||
      !paneOpen ||
      !project ||
      history.isLoading ||
      selection?.projectId === project.id
    )
      return;
    let active = true;
    setOpening(true);
    void (async () => {
      try {
        const existing = await selectProjectThread(
          project.id,
          remembered(project.id),
          history.threads,
          projectThreadExists,
        );
        if (existing) {
          if (active) {
            const next = {
              projectId: project.id,
              threadId: existing,
            };
            setSelection(next);
            remember(next);
          }
        } else {
          const threadId = crypto.randomUUID();
          await createProjectThread(threadId, project);
          await history.createThread(threadId);
          if (active) {
            const next = { projectId: project.id, threadId };
            setSelection(next);
            remember(next);
          }
        }
        if (active) setError("");
      } catch (cause) {
        if (active)
          setError(
            cause instanceof Error ? cause.message : "会話を開けませんでした。",
          );
      } finally {
        if (active) setOpening(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [
    specPage,
    paneOpen,
    project?.id,
    history.isLoading,
    selection?.projectId,
  ]);

  useEffect(() => {
    const onOpen = () => {
      setError("");
      setPaneOpen(true);
    };
    window.addEventListener("spec-chat:open", onOpen);
    return () => window.removeEventListener("spec-chat:open", onOpen);
  });

  useEffect(() => {
    if (specPage && paneOpen) closeButton.current?.focus();
  }, [specPage, paneOpen]);

  const presentation = chatPresentation(location.pathname, paneOpen);
  const visible = presentation !== "hidden";
  const correctProject = selection?.projectId === projectId;
  const correctThread = !fullPage || selection?.threadId === routeThreadId;
  const showChat = visible && correctProject && correctThread;
  const visibleError =
    error ||
    (!projects.isLoading && !project ? "プロジェクトを開けませんでした。" : "");
  return (
    <aside
      className={
        presentation === "full"
          ? "agent-kit-persistent-chat flex min-w-0 flex-1 flex-col overflow-hidden"
          : presentation === "pane"
            ? "agent-kit-persistent-chat agent-kit-persistent-pane flex min-w-0 flex-col overflow-hidden border-l border-border bg-card"
            : "agent-kit-persistent-chat hidden"
      }
      data-chat-visible={showChat ? "true" : "false"}
      aria-label="エージェントチャット"
    >
      {fullPage && (
        <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-card px-3 md:hidden">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onOpenMobileSidebar}
            aria-label="ナビゲーションを開く"
          >
            <IconMenu2 size={16} />
          </Button>
          <span className="truncate text-sm font-semibold">{APP_TITLE}</span>
        </div>
      )}
      {specPage && paneOpen && (
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-border px-3">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <IconMessage size={16} /> エージェントチャット
          </span>
          <Button
            ref={closeButton}
            type="button"
            variant="ghost"
            size="icon"
            aria-label="チャットを閉じる"
            onClick={() => {
              setPaneOpen(false);
              document
                .querySelector<HTMLElement>(
                  '[aria-label="エージェントチャットを開く"]',
                )
                ?.focus();
            }}
          >
            <IconX size={16} />
          </Button>
        </div>
      )}
      {visibleError && visible && (
        <p role="alert" className="p-3 text-sm text-destructive">
          {visibleError}
        </p>
      )}
      {opening && visible && (
        <p role="status" className="p-3 text-sm">
          会話を開いています…
        </p>
      )}
      {fullPage && !showChat && !visibleError && (
        <p role="status" className="p-3 text-sm">
          会話を読み込み中…
        </p>
      )}
      {selection && (
        <div className={showChat ? "min-h-0 flex-1" : "hidden"}>
          <ChatThreadRouteContent
            resolvedThreadId={selection.threadId}
            projectId={selection.projectId}
            compact={!fullPage}
            navigate={navigate}
          />
        </div>
      )}
    </aside>
  );
}
