import { useActionMutation, useActionQuery } from "@agent-native/core/client/hooks";
import { useSetPageTitle } from "@agent-native/toolkit/app-shell";
import { parseSpecYaml } from "@shared/spec-utils";
import { specTargets } from "@shared/spec-versions";
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { stringify } from "yaml";
import { Button } from "@/components/ui/button";
import "../spec-studio.css";

const date = (value: string) => new Intl.DateTimeFormat("ja-JP", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
const decisions: Record<string, string> = { approved: "要素を承認", changes_requested: "修正依頼", comment: "コメント" };

export default function SpecReviewPage() {
  useSetPageTitle("版別レビュー");
  const [params, setParams] = useSearchParams();
  const projectId = params.get("project") ?? "";
  const versions = useActionQuery("spec-version-list", { projectId });
  const versionId = params.get("version") || versions.data?.currentVersionId || versions.data?.versions[0]?.id || "";
  const fromVersionId = params.get("from") || versions.data?.versions.find((item) => item.id !== versionId)?.id || "";
  const targetKey = params.get("target") || "";
  const navigate = (patch: Record<string, string | null>) => setParams((current) => {
    const next = new URLSearchParams(current);
    for (const [key, value] of Object.entries(patch)) value === null ? next.delete(key) : next.set(key, value);
    return next;
  }, { replace: true });
  if (!projectId) return <main className="p-8" lang="ja"><Link to="/projects">プロジェクトを選択</Link></main>;
  return <main className="spec-version-page" lang="ja">
    <header className="spec-version-header"><Link to={`/spec?project=${encodeURIComponent(projectId)}`}>← 仕様の編集</Link><h1>版別レビュー</h1></header>
    {versions.isError && <p role="alert">版の一覧を読み込めませんでした。</p>}
    {versions.data && versions.data.versions.length === 0 && <p>検証済みの保存版はまだありません。</p>}
    {versionId && <VersionReview projectId={projectId} versionId={versionId} fromVersionId={fromVersionId} targetKey={targetKey} versions={versions.data?.versions ?? []} currentVersionId={versions.data?.currentVersionId ?? null} navigate={navigate} />}
  </main>;
}

type VersionInfo = { id: string; createdAt: string; documentHash: string };
function VersionReview({ projectId, versionId, fromVersionId, targetKey, versions, currentVersionId, navigate }: {
  projectId: string; versionId: string; fromVersionId: string; targetKey: string; versions: VersionInfo[]; currentVersionId: string | null; navigate: (patch: Record<string, string | null>) => void;
}) {
  const loaded = useActionQuery("spec-version-load", { projectId, versionId });
  const compared = useActionQuery("spec-version-compare", { projectId, fromVersionId: fromVersionId || versionId, toVersionId: versionId });
  const submit = useActionMutation("spec-element-review");
  const [decision, setDecision] = useState<"approved" | "changes_requested" | "comment">("comment");
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState("");
  const spec = useMemo(() => loaded.data ? parseSpecYaml(loaded.data.yaml).spec : undefined, [loaded.data?.yaml]);
  const targets = useMemo(() => spec ? specTargets(spec) : [], [spec]);
  const selected = targets.find((item) => item.key === targetKey) ?? targets[0];
  const feedback = loaded.data?.feedback ?? [];
  async function save() {
    if (!selected) return;
    setMessage("記録中…");
    try {
      await submit.mutateAsync({ projectId, versionId, targetKey: selected.key, decision, comment });
      setComment(""); setMessage("この版の要素に記録しました。");
      await loaded.refetch();
    } catch (error) { setMessage(error instanceof Error ? error.message : "記録できませんでした。"); }
  }
  return <>
    <section className="spec-version-controls" aria-label="版の選択">
      <label>表示する版 <select value={versionId} onChange={(event) => navigate({ version: event.target.value, target: null })}>{versions.map((item) => <option key={item.id} value={item.id}>{date(item.createdAt)} · {item.id.slice(0, 8)}{item.id === currentVersionId ? " · 現在" : ""}</option>)}</select></label>
      <label>比較元 <select value={fromVersionId || versionId} onChange={(event) => navigate({ from: event.target.value })}>{versions.map((item) => <option key={item.id} value={item.id}>{date(item.createdAt)} · {item.id.slice(0, 8)}</option>)}</select></label>
      <span>{versionId === currentVersionId ? "現在の保存版" : "過去の保存版"}</span>
    </section>
    {loaded.isError && <p role="alert">この版を読み込めませんでした。</p>}
    {loaded.data && <div className="spec-version-grid">
      <aside className="spec-version-nav" aria-label="変更と要素">
        <h2>変更 <small>{compared.data?.changes.length ?? 0}</small></h2>
        {compared.isError && <p role="alert">差分を読み込めませんでした。</p>}
        {compared.data?.changes.map((change) => <button key={`${change.change}:${change.key}`} type="button" onClick={() => navigate(change.change === "removed" ? { version: fromVersionId, target: change.key } : { target: change.key })}>
          <span>{change.change === "added" ? "追加" : change.change === "removed" ? "削除" : "変更"}</span> {change.title} <small>{change.kind} · {change.id}</small>
        </button>)}
        <h2>この版の要素</h2>
        {targets.map((target) => <button className={selected?.key === target.key ? "is-active" : ""} key={target.key} type="button" onClick={() => navigate({ target: target.key })}>{target.title}<small>{target.kind} · {target.id}</small></button>)}
      </aside>
      <section className="spec-version-content">
        <div className="spec-version-meta"><strong>{spec?.title}</strong><span>保存: {date(loaded.data.createdAt)}</span><code>{versionId}</code></div>
        {selected ? <><h2>{selected.title}</h2><p>{selected.kind} · {selected.id}{selected.parentId ? ` / ${selected.parentId}` : ""}</p><pre className="spec-version-yaml">{stringify(selected.value)}</pre></> : <p>この版にレビュー対象の要素はありません。</p>}
        <details><summary>保存済み YAML 全文</summary><pre className="spec-version-yaml">{loaded.data.yaml}</pre></details>
      </section>
      <aside className="spec-version-feedback" aria-label="要素レビュー">
        <h2>この版へのフィードバック</h2>
        <p>{versionId === currentVersionId ? "現在の版" : "過去の版"} · 文書全体の承認には反映されません。</p>
        {selected && <><label>判断 <select value={decision} onChange={(event) => setDecision(event.target.value as typeof decision)}>{Object.entries(decisions).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>コメント <textarea maxLength={2000} value={comment} onChange={(event) => setComment(event.target.value)} /></label>
          <Button disabled={submit.isPending || (decision === "comment" && !comment.trim())} onClick={() => void save()}>記録する</Button></>}
        {message && <p role="status">{message}</p>}
        <ol>{feedback.map((item) => <li key={item.id}><strong>{decisions[item.decision] ?? item.decision}</strong> · {item.targetTitle}<small>{item.targetKind} · {item.reviewerEmail} · {date(item.createdAt)}</small>{!targets.some((target) => target.key === item.targetKey) && <em>この保存版で対象を解決できません</em>}{item.comment && <p>{item.comment}</p>}</li>)}</ol>
      </aside>
    </div>}
  </>;
}
