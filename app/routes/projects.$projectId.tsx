import { useChatThreads } from "@agent-native/core/client/agentkit-chat/rail";
import { useActionQuery } from "@agent-native/core/client/hooks";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { createProjectThread } from "@/lib/project-chat";

export default function OpenProjectPage() {
  const { projectId = "" } = useParams();
  const projects = useActionQuery("project-list", {});
  const project = projects.data?.find((item) => item.id === projectId);
  if (projects.isLoading)
    return (
      <main className="p-8" lang="ja">
        プロジェクトを読み込み中…
      </main>
    );
  if (projects.isError || !project)
    return (
      <main className="p-8" lang="ja">
        <p role="alert">
          プロジェクトを開けませんでした。一覧から選び直してください。
        </p>
        <Link to="/projects">プロジェクト一覧</Link>
      </main>
    );
  return <OpenSelectedProject key={project.id} project={project} />;
}

function OpenSelectedProject({
  project,
}: {
  project: { id: string; name: string };
}) {
  const scope =
    project.id !== "default"
      ? { type: "ui-spec-project", id: project.id, label: project.name }
      : null;
  const { threads, isLoading, createThread } = useChatThreads(
    undefined,
    "chat",
    scope,
    {
      autoCreate: false,
      restoreActiveThread: false,
      isolateHistoryByScope: Boolean(scope),
    },
  );
  const navigate = useNavigate();
  const started = useRef(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isLoading || started.current) return;
    started.current = true;
    const existing = threads
      .filter((thread) =>
        scope
          ? thread.scope?.type === scope.type && thread.scope.id === scope.id
          : !thread.scope,
      )
      .sort((a, b) => b.updatedAt - a.updatedAt)[0];
    if (existing) {
      navigate(
        `/chat/${encodeURIComponent(existing.id)}?project=${encodeURIComponent(project.id)}`,
        { replace: true },
      );
      return;
    }
    void (async () => {
      const id = crypto.randomUUID();
      await createProjectThread(id, project);
      await createThread(id);
      navigate(
        `/chat/${encodeURIComponent(id)}?project=${encodeURIComponent(project.id)}`,
        { replace: true },
      );
    })().catch((cause) => {
      setError(
        cause instanceof Error ? cause.message : "会話を開けませんでした。",
      );
    });
  }, [project, scope, isLoading, threads, createThread, navigate]);

  return (
    <main className="p-8" lang="ja">
      <p role={error ? "alert" : undefined}>
        {error || "プロジェクトのチャットを開いています…"}
      </p>
      <Link to="/projects">プロジェクト一覧</Link>
    </main>
  );
}
