import { useActionMutation, useActionQuery } from "@agent-native/core/client/hooks";
import { useSetPageTitle } from "@agent-native/toolkit/app-shell";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { stringify } from "yaml";
import { parseSpecYaml } from "@shared/spec-utils";
import { specTargets } from "@shared/spec-versions";
import { Button } from "@/components/ui/button";
import "../spec-studio.css";

const labels: Record<string, string> = { proposed: "提案中", approved: "適用済み", rejected: "却下" };
const changeLabels: Record<string, string> = { added: "追加", removed: "削除", changed: "変更" };

export default function SpecProposalsPage() {
  useSetPageTitle("AI 仕様案");
  const [params, setParams] = useSearchParams();
  const projectId = params.get("project") ?? "";
  const list = useActionQuery("spec-proposal-list", { projectId }, { enabled: Boolean(projectId) });
  const proposalId = params.get("proposal") || list.data?.[0]?.id || "";
  const loaded = useActionQuery("spec-proposal-load", { projectId, proposalId }, { enabled: Boolean(projectId && proposalId) });
  const decide = useActionMutation("spec-proposal-decide");
  const [message, setMessage] = useState("");
  if (!projectId) return <main className="p-8" lang="ja"><Link to="/projects">プロジェクトを選択</Link></main>;
  const proposal = loaded.data;
  const before = proposal ? parseSpecYaml(proposal.baseYaml).spec : null;
  const beforeTargets = new Map(before ? specTargets(before).map((target) => [target.key, target]) : []);
  async function submit(decision: "approved" | "rejected") {
    setMessage("判断を記録中…");
    try {
      await decide.mutateAsync({ projectId, proposalId, decision });
      await Promise.all([loaded.refetch(), list.refetch()]);
      setMessage(decision === "approved" ? "仕様に新しい版として適用しました。" : "仕様案を却下しました。仕様は変更されていません。");
    } catch (error) { setMessage(error instanceof Error ? error.message : "判断を記録できませんでした。"); }
  }
  return <main className="spec-version-page spec-proposal-page" lang="ja">
    <header className="spec-version-header"><Link to={`/spec?project=${encodeURIComponent(projectId)}`}>← 仕様の編集</Link><h1>AI 仕様案</h1></header>
    <p>AI が作った変更案です。文書全体の承認や要素レビューとは別の判断です。適用するまで仕様は変わりません。</p>
    {list.isError && <p role="alert">仕様案の一覧を読み込めませんでした。</p>}
    {list.data?.length === 0 && <p>仕様案はまだありません。プロジェクトのチャットで変更を相談できます。</p>}
    {list.data && list.data.length > 0 && <label className="spec-proposal-select">仕様案 <select value={proposalId} onChange={(event) => { setMessage(""); setParams({ project: projectId, proposal: event.target.value }); }}>{list.data.map((item) => <option key={item.id} value={item.id}>{labels[item.status] ?? item.status} · {item.summary} · {new Date(item.createdAt).toLocaleString("ja-JP")}</option>)}</select></label>}
    {loaded.isError && <p role="alert">仕様案を読み込めませんでした。</p>}
    {proposal && <div className="spec-proposal-body">
      <section className="spec-version-content"><h2>{proposal.summary}</h2><p><strong>{labels[proposal.status] ?? proposal.status}</strong> · 基準版 <code>{proposal.baseVersionId ?? "未作成（初回案）"}</code></p>
        {proposal.appliedVersionId && <p>適用先の版: <code>{proposal.appliedVersionId}</code></p>}
        {proposal.stale && proposal.status === "proposed" && <p role="alert">基準版から仕様が変わっています。この案は適用できません。現在の版をもとに作り直してください。</p>}
        <h3>影響の概要</h3><p>{proposal.impactSummary}</p>
        <h3>差分と影響する要素</h3><p>{proposal.changes.length} 件の安定 ID による変更</p>
        {proposal.changes.map((change) => <details key={`${change.change}:${change.key}`} className="spec-proposal-change"><summary>{changeLabels[change.change]} · {change.title} <small>{change.kind} · {change.id}{change.parentId ? ` / ${change.parentId}` : ""}</small></summary>
          {change.change !== "added" && <><h4>基準版</h4><pre className="spec-version-yaml">{stringify(beforeTargets.get(change.key)?.value)}</pre></>}
          {change.change !== "removed" && <><h4>提案</h4><pre className="spec-version-yaml">{stringify(change.value)}</pre></>}
        </details>)}
        <details><summary>提案 YAML 全文</summary><pre className="spec-version-yaml">{proposal.yaml}</pre></details>
        {proposal.baseYaml && <details><summary>基準版 YAML 全文</summary><pre className="spec-version-yaml">{proposal.baseYaml}</pre></details>}
      </section>
      <aside className="spec-version-feedback"><h2>根拠と未解決事項</h2>
        <h3>参照元</h3><ol>{proposal.sources.map((source, index) => <li key={`${source.messageId}:${source.attachmentId ?? "chat"}:${index}`}><strong>{source.kind === "chat" ? "会話" : `添付: ${source.attachmentName}`}</strong><small>会話 {source.threadId} · メッセージ {source.messageId}{source.attachmentId ? ` · 添付 ${source.attachmentId}` : ""}</small><Link to={`/chat/${encodeURIComponent(source.threadId)}?project=${encodeURIComponent(projectId)}`}>会話を開く</Link>{source.kind === "attachment" && source.attachmentUrl?.startsWith("https://") && <p><a href={source.attachmentUrl} target="_blank" rel="noopener noreferrer">添付の原本を開く</a></p>}<p>位置: {source.locator}</p><blockquote>{source.evidence}</blockquote><small>対応する変更: {source.targetKeys.map((key) => proposal.changes.find((change) => change.key === key)?.title ?? key).join("、")}</small>{source.kind === "attachment" && <small>引用内容は作成者の申告です。原本を確認してください。</small>}</li>)}</ol>
        <h3>前提</h3>{proposal.assumptions.length ? <ul>{proposal.assumptions.map((item, index) => <li key={index}>{item}</li>)}</ul> : <p>なし</p>}
        <h3>未解決の質問</h3>{proposal.questions.length ? <ul>{proposal.questions.map((item, index) => <li key={index}>{item}</li>)}</ul> : <p>なし</p>}
        {proposal.status === "proposed" && <div className="spec-proposal-actions"><Button disabled={decide.isPending || proposal.stale} onClick={() => void submit("approved")}>この案を仕様に適用</Button><Button variant="outline" disabled={decide.isPending} onClick={() => void submit("rejected")}>却下</Button></div>}
        {message && <p role="status">{message}</p>}
      </aside>
    </div>}
  </main>;
}
