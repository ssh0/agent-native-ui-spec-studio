import {
  useActionMutation,
  useActionQuery,
} from "@agent-native/core/client/hooks";
import { useState } from "react";
import { Link, useNavigate } from "react-router";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ProjectsPage() {
  const projects = useActionQuery("project-list", {});
  const create = useActionMutation("project-create");
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  async function start() {
    setError("");
    try {
      const project = await create.mutateAsync({ name: name.trim() });
      navigate(`/projects/${encodeURIComponent(project.id)}`);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "プロジェクトを作成できませんでした。再試行してください。",
      );
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-9 px-6 py-10" lang="ja">
      <header className="space-y-2">
        <p className="text-xs font-semibold tracking-widest text-muted-foreground">
          UI SPEC STUDIO
        </p>
        <h1 className="text-3xl font-semibold">プロジェクト</h1>
        <p className="text-muted-foreground">
          新しい構想を会話から始めるか、保存済みのプロジェクトを開きます。
        </p>
      </header>
      <section
        className="rounded-xl border bg-card p-6 space-y-4"
        aria-labelledby="new-project-heading"
      >
        <div>
          <h2 id="new-project-heading" className="text-lg font-semibold">
            新規プロジェクトを始める
          </h2>
          <p className="text-sm text-muted-foreground">
            名前を決めたらチャットで作りたいプロダクトを説明してください。AI
            が仕様の骨格を作ります。
          </p>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void start();
          }}
          className="flex gap-2"
        >
          <Input
            aria-label="新規プロジェクト名"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="例: 予約管理アプリ"
            maxLength={120}
            required
          />
          <Button disabled={create.isPending || !name.trim()} type="submit">
            {create.isPending ? "作成中…" : "チャットで始める"}
          </Button>
        </form>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </section>
      <section
        className="space-y-3"
        aria-labelledby="existing-projects-heading"
      >
        <h2 id="existing-projects-heading" className="text-lg font-semibold">
          既存のプロジェクトを開く
        </h2>
        {projects.isLoading && (
          <p className="text-sm text-muted-foreground">読込中…</p>
        )}
        {projects.isError && (
          <p role="alert" className="text-sm text-destructive">
            一覧を読み込めませんでした。
            <Button variant="ghost" onClick={() => void projects.refetch()}>
              再試行
            </Button>
          </p>
        )}
        {projects.data?.length === 0 && (
          <p className="text-sm text-muted-foreground">
            保存済みのプロジェクトはありません。
          </p>
        )}
        <ul className="space-y-2">
          {projects.data?.map((project) => (
            <li key={project.id}>
              <Link
                to={`/projects/${encodeURIComponent(project.id)}`}
                className="block rounded-lg border bg-card p-4 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="font-medium">{project.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {project.id === "default"
                    ? "以前の仕様を引き継いだプロジェクト"
                    : "会話と仕様を再開"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
