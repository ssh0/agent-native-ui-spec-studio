import type {
  AgentConnectionRequest,
  AgentMessage,
} from "@agent-native/agentkit";
import {
  AgentConnectionRequestCard,
  AgentKitChat,
} from "@agent-native/agentkit/react/components";
import {
  useAgentKit,
  useAgentKitControl,
  useAgentThread,
  type AgentKitRenderProps,
} from "@agent-native/agentkit/react/context";
import { AgentKitRoot } from "@agent-native/agentkit/react/root";
import { CoreComposerRuntimeProvider } from "@agent-native/core/client/agentkit-chat/composer";
import {
  McpAgentKitConnectionRequestCard,
  McpAgentKitConnectionResume,
} from "@agent-native/core/client/agentkit-chat/connections";
import { createAgentKitIntegrityReporter } from "@agent-native/core/client/agentkit-chat/integrity";
import {
  GuidedQuestionFlow,
  useGuidedQuestionFlow,
} from "@agent-native/core/client/agentkit-chat/questions";
import { useChatThreads } from "@agent-native/core/client/agentkit-chat/rail";
import {
  findMcpConnectionSuggestionIntegration,
  McpConnectionSuggestion,
} from "@agent-native/core/client/agentkit-chat/suggestions";
import { createAgentNativeAgentKitTransport } from "@agent-native/core/client/agentkit-chat/transport";
import { trackEvent } from "@agent-native/core/client/analytics";
import { useActionQuery } from "@agent-native/core/client/hooks";
import { useT } from "@agent-native/core/client/i18n";
import { IconLayoutSidebarRight } from "@tabler/icons-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { APP_TITLE } from "@/lib/app-config";
import { consumeChatHomeThreadId } from "@/lib/chat-home-thread";
import { TAB_ID } from "@/lib/tab-id";

function chatThreadPath(threadId: string | null) {
  return threadId ? `/chat/${encodeURIComponent(threadId)}` : "/home";
}

// Module scope on purpose: AgentKitRoot memoizes the client on its options, so
// a new callback each render would rebuild the client and drop the stream.
const reportStreamIntegrity = createAgentKitIntegrityReporter("chat");

export default function ChatRouteContent({
  initialThreadId,
}: {
  initialThreadId?: string;
} = {}) {
  const { threadId: routeThreadId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const projectId = new URLSearchParams(location.search).get("project");
  const projects = useActionQuery("project-list", {});
  const project = projects.data?.find((item) => item.id === projectId);
  const threadId = routeThreadId ?? initialThreadId;

  if (!threadId) return null;
  if (projects.isLoading)
    return (
      <p className="p-8" lang="ja">
        プロジェクトのチャットを読み込み中…
      </p>
    );
  if (!project)
    return (
      <main className="p-8" lang="ja">
        <p role="alert">プロジェクトを開けませんでした。</p>
        <Link to="/projects">プロジェクト一覧に戻る</Link>
      </main>
    );
  return (
    <ProjectChatRouteContent
      key={project.id}
      project={project}
      threadId={threadId}
      routeThreadId={routeThreadId}
      navigate={navigate}
    />
  );
}

function ProjectChatRouteContent({
  project,
  threadId,
  routeThreadId,
  navigate,
}: {
  project: { id: string; name: string };
  threadId: string;
  routeThreadId?: string;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const scope =
    project.id !== "default"
      ? { type: "ui-spec-project", id: project.id, label: project.name }
      : null;
  const history = useChatThreads(undefined, "chat", scope, {
    autoCreate: false,
    restoreActiveThread: false,
    isolateHistoryByScope: Boolean(scope),
  });
  if (history.isLoading)
    return (
      <p className="p-8" lang="ja">
        プロジェクトのチャットを読み込み中…
      </p>
    );
  if (
    !history.threads.some(
      (thread) =>
        thread.id === threadId &&
        (scope
          ? thread.scope?.type === scope.type && thread.scope.id === scope.id
          : !thread.scope),
    )
  ) {
    return (
      <main className="p-8" lang="ja">
        <p role="alert">このプロジェクトの会話を開けませんでした。</p>
        <Link to="/projects">プロジェクト一覧に戻る</Link>
      </main>
    );
  }

  return (
    <ChatThreadRouteContent
      routeThreadId={routeThreadId}
      resolvedThreadId={threadId}
      navigate={navigate}
    />
  );
}

function ChatThreadRouteContent({
  routeThreadId,
  resolvedThreadId,
  navigate,
}: {
  routeThreadId?: string;
  resolvedThreadId: string;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const t = useT();
  const [workspaceOpen, setWorkspaceOpen] = useState(false);

  const [transport] = useState(() =>
    createAgentNativeAgentKitTransport({
      browserTabId: TAB_ID,
      surface: "app",
      adapter: { textFormat: "markdown" },
    }),
  );

  return (
    <div
      className="relative flex h-full min-h-0 overflow-hidden bg-background"
      data-agent-chat-workspace-state={workspaceOpen ? "open" : "closed"}
    >
      <div
        className={`agent-kit-chat-canvas-body min-w-0 flex-none ${
          workspaceOpen ? "agent-kit-chat-canvas-body--workspace-open" : ""
        }`}
      >
        <CoreComposerRuntimeProvider>
          <AgentKitRoot
            transport={transport}
            clientOptions={{
              transportOwnership: "owned",
              retainActiveRunsOnThreadRelease: true,
              onIntegrityReport: reportStreamIntegrity,
            }}
            threadId={resolvedThreadId}
            labels={{
              composerPlaceholder:
                "作りたいプロダクト、利用者、主要な操作を教えてください",
            }}
            slots={{
              emptyState: ChatEmptyState,
              messageSupplement: ChatMcpConnectionSuggestion,
              connectionRequest: ChatMcpConnectionRequest,
              footer: ChatAgentFooter,
            }}
            onThreadForked={(thread) =>
              navigate(`${chatThreadPath(thread.id)}${window.location.search}`)
            }
          >
            <ChatLifecycleTracking threadId={resolvedThreadId} />
            <ChatMcpConnectionResume />
            <ChatCanvas
              workspaceOpen={workspaceOpen}
              setWorkspaceOpen={setWorkspaceOpen}
            />
          </AgentKitRoot>
        </CoreComposerRuntimeProvider>
      </div>
      <aside
        data-agent-chat-workspace-panel=""
        data-state={workspaceOpen ? "open" : "closed"}
        aria-hidden={workspaceOpen ? undefined : true}
        inert={workspaceOpen ? undefined : true}
        className="agent-kit-workspace-panel absolute end-0 flex flex-col border-s border-border bg-background shadow-lg md:shadow-none"
      >
        <header className="agent-kit-workspace-panel__header flex shrink-0 items-center border-b border-border px-3">
          <h2 className="min-w-0 truncate text-xs font-medium text-foreground">
            {t("settings.workspaceTitle")}
          </h2>
        </header>
        <div data-agent-chat-workspace-slot="" className="min-h-0 flex-1" />
      </aside>
    </div>
  );
}

function ChatLifecycleTracking({ threadId }: { threadId: string }) {
  const thread = useAgentThread(threadId);
  const lifecycleRef = useRef({
    threadId: "",
    pendingCreation: false,
    observedMessages: false,
    messageCount: 0,
  });

  useEffect(() => {
    const pendingCreation = consumeChatHomeThreadId(threadId);
    lifecycleRef.current = {
      threadId,
      pendingCreation,
      observedMessages: false,
      messageCount: 0,
    };
    if (!pendingCreation) {
      trackEvent("thread_resumed", { thread_id: threadId });
    }
  }, [threadId]);

  useEffect(() => {
    const lifecycle = lifecycleRef.current;
    if (lifecycle.threadId !== threadId) return;
    const count = thread.messages.length;
    const initialObservation = !lifecycle.observedMessages;
    lifecycle.observedMessages = true;
    if (count <= lifecycle.messageCount) {
      lifecycle.messageCount = count;
      return;
    }
    const pendingCreation = lifecycle.pendingCreation;
    if (pendingCreation) {
      lifecycle.pendingCreation = false;
      trackEvent("thread_created", {
        output_id: threadId,
        output_type: "thread",
      });
    }
    if (!initialObservation || pendingCreation) {
      trackEvent("message_exchanged", {
        thread_id: threadId,
        msg_count: count,
      });
    }
    lifecycle.messageCount = count;
  }, [thread.messages.length, threadId]);

  return null;
}

function ChatAgentFooter({ children }: { children: ReactNode }) {
  const { controller, threadId } = useAgentKit();
  const submitAnswers = useCallback(
    ({ formattedAnswers }: { formattedAnswers: string }) => {
      void controller.sendMessage({ threadId, text: formattedAnswers });
    },
    [controller, threadId],
  );
  const skipQuestions = useCallback(
    ({ message }: { message: string }) => {
      void controller.sendMessage({ threadId, text: message });
    },
    [controller, threadId],
  );
  const {
    questions,
    title,
    description,
    skipLabel,
    submitLabel,
    handleSubmit,
    handleSkip,
  } = useGuidedQuestionFlow({
    stateKey: "guided-questions",
    queryKey: ["guided-questions", "agentkit"],
    browserTabId: TAB_ID,
    threadId,
    onSubmitMessage: submitAnswers,
    onSkipMessage: skipQuestions,
  });

  return (
    <div className="agent-kit-chat-footer-stack">
      {questions?.length ? (
        <div className="agent-kit-chat-guided-question">
          <GuidedQuestionFlow
            questions={questions}
            onSubmit={handleSubmit}
            onSkip={handleSkip}
            {...(title ? { title } : {})}
            {...(description ? { description } : {})}
            {...(skipLabel ? { skipLabel } : {})}
            {...(submitLabel ? { submitLabel } : {})}
            className="h-auto items-stretch justify-stretch bg-transparent"
          />
        </div>
      ) : null}
      {children}
    </div>
  );
}

function ChatMcpConnectionRequest({
  value: request,
  runId,
}: AgentKitRenderProps<AgentConnectionRequest> & { runId: string }) {
  const control = useAgentKitControl();
  const { threadId } = useAgentKit();
  if (request.status === "connected" || request.status === "declined") {
    return <AgentConnectionRequestCard request={request} runId={runId} />;
  }
  const resolve = (status: "connected" | "declined") =>
    control.resolveConnectionRequest(runId, request.id, { status });
  return (
    <McpAgentKitConnectionRequestCard
      provider={request.provider}
      {...(request.detail ? { detail: request.detail } : {})}
      target={{ threadId, runId, requestId: request.id }}
      onConnected={() => resolve("connected")}
      onDeclined={() => resolve("declined")}
      fallback={<AgentConnectionRequestCard request={request} runId={runId} />}
    />
  );
}

function ChatMcpConnectionResume() {
  const { controller, threadId } = useAgentKit();
  const onResume = useCallback(
    async (
      target: { threadId: string; runId: string; requestId: string },
      request: { message: string },
    ) => {
      try {
        await controller.resolveConnectionRequest({
          ...target,
          response: { status: "connected" },
        });
      } catch {
        await controller.sendMessage({
          threadId: target.threadId,
          text: request.message,
        });
      }
    },
    [controller],
  );
  const onMessageResume = useCallback(
    async (request: { message: string }) => {
      await controller.sendMessage({ threadId, text: request.message });
    },
    [controller, threadId],
  );
  return (
    <McpAgentKitConnectionResume
      onResume={onResume}
      onMessageResume={onMessageResume}
    />
  );
}

function messageText(message: AgentMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();
}

function ChatMcpConnectionSuggestion({
  value: message,
  threadId,
}: AgentKitRenderProps<AgentMessage>) {
  const thread = useAgentThread(threadId);
  if (message.role !== "assistant" || message.status === "streaming") {
    return null;
  }
  const responseText = messageText(message);
  const messageIndex = thread.messages.findIndex(
    (candidate) => candidate.id === message.id,
  );
  let contextText = "";
  for (let index = messageIndex - 1; index >= 0; index -= 1) {
    const candidate = thread.messages[index];
    if (candidate?.role === "user") {
      contextText = messageText(candidate);
      break;
    }
  }
  const integration = findMcpConnectionSuggestionIntegration({
    text: responseText,
    contextText,
    variant: "response",
  });
  if (!integration) return null;
  const hasStructuredRequest = Object.values(
    thread.connectionRequests ?? {},
  ).some(
    (request) =>
      request.provider.trim().toLowerCase() === integration.id.toLowerCase() ||
      request.provider.trim().toLowerCase() ===
        integration.provider.toLowerCase(),
  );
  if (hasStructuredRequest) return null;
  return (
    <McpConnectionSuggestion
      text={responseText}
      contextText={contextText}
      variant="response"
      requestedByAgent
      integrationId={integration.id}
    />
  );
}

function ChatEmptyState() {
  return (
    <div className="agentkit-chat-empty-copy">
      <h1>作りたいプロダクトから始めましょう</h1>
      <p>
        目的、利用者、主な操作を話してください。会話をもとに UI
        仕様の骨格を保存します。
      </p>
      <p>
        参考資料は入力欄の ＋ から添付します。画像、PDF、テキスト、Office
        文書など 25 MB
        まで対応します。添付が無効な場合はファイル保存先の接続を確認してください。
      </p>
      <p>
        形式や容量で拒否された場合は PDF かテキストに変換するか、25 MB
        以下に分けて再度添付してください。アップロードに失敗した場合は接続を確認して再試行してください。
      </p>
    </div>
  );
}

function ChatCanvas({
  workspaceOpen,
  setWorkspaceOpen,
}: {
  workspaceOpen: boolean;
  setWorkspaceOpen: (value: boolean | ((current: boolean) => boolean)) => void;
}) {
  const t = useT();
  const location = useLocation();
  const projectId = new URLSearchParams(location.search).get("project");
  const thread = useAgentThread();
  const hasConversation = thread.messages.length > 0;

  useEffect(() => {
    if (!hasConversation) setWorkspaceOpen(false);
  }, [hasConversation, setWorkspaceOpen]);

  const toolbar = (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          data-agent-page-workspace-toggle=""
          aria-label={t("settings.workspaceTitle")}
          aria-expanded={workspaceOpen}
          onClick={() => setWorkspaceOpen((open) => !open)}
          className="size-8"
        >
          <IconLayoutSidebarRight className="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{t("settings.workspaceTitle")}</TooltipContent>
    </Tooltip>
  );

  return (
    <div className="flex h-full flex-col">
      {projectId && (
        <div className="flex items-center justify-between border-b px-4 py-2 text-sm">
          <Link to="/projects">プロジェクト一覧</Link>
          <Link to={`/spec?project=${encodeURIComponent(projectId)}`}>
            仕様を開く
          </Link>
        </div>
      )}
      <AgentKitChat
        className="min-h-0 flex-1"
        title={thread.thread?.title ?? APP_TITLE}
        toolbar={toolbar}
        emptyComposerPlacement="center"
        composerProps={{
          queueWhileRunning: true,
          autoFocus: true,
          plusMenuMode: "full",
          voiceEnabled: true,
          includeDefaultSlashCommands: false,
          includeDefaultSlashSkills: false,
        }}
      />
    </div>
  );
}
