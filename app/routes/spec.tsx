import {
  useActionMutation,
  useActionQuery,
} from "@agent-native/core/client/hooks";
import { useSetPageTitle } from "@agent-native/toolkit/app-shell";
import {
  domainSections,
  stages,
  stageLabels,
  SpecSchema,
  formatZodIssues,
  type UiSpec,
  type DomainSection,
  type SpecStage,
} from "@shared/spec-schema";
import { parseSpecYaml } from "@shared/spec-utils";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { parse, stringify } from "yaml";

import { Field, SourceEditor } from "@/components/spec-studio/spec-editor-ui";
import { GeneratedLists } from "@/components/spec-studio/generated-lists";
import {
  StageContent,
  sectionValue,
} from "@/components/spec-studio/stage-content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import "../spec-studio.css";

export function meta() {
  return [{ title: "UI仕様スタジオ" }];
}
const statusLabels: Record<string, string> = {
  draft: "下書き",
  approved: "承認済み",
  changes_requested: "修正依頼",
};
const formatDate = (date: string) =>
  new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(date));

export default function SpecPage() {
  useSetPageTitle("UI仕様スタジオ");
  const [params, setParams] = useSearchParams();
  const projectId = params.get("project") ?? "";
  const projects = useActionQuery("project-list", {});
  const project = projects.data?.find((item) => item.id === projectId);
  const loaded = useActionQuery("spec-load", { projectId });
  const save = useActionMutation("spec-update");
  const review = useActionMutation("spec-review");
  const validate = useActionMutation("spec-validate");
  const migrate = useActionMutation("spec-migrate");
  const generated = useActionQuery("spec-generated-lists", { projectId });
  const stage = stages.includes(params.get("stage") as SpecStage)
    ? (params.get("stage") as SpecStage)
    : "domain";
  const domainSection = domainSections.includes(
    params.get("section") as DomainSection,
  )
    ? (params.get("section") as DomainSection)
    : "entities";
  const selectedId = params.get("selected") ?? "";
  const mode = params.get("mode") === "yaml" ? "yaml" : params.get("mode") === "lists" ? "lists" : "builder";
  const [yaml, setYaml] = useState("");
  // Retain the structured draft while a required field is temporarily empty.
  // The YAML still owns validation, saving and the review gate.
  const [builderDraft, setBuilderDraft] = useState<{
    yaml: string;
    spec: UiSpec;
  } | null>(null);
  const [base, setBase] = useState({ yaml: "", updatedAt: "" });
  const [sectionDraft, setSectionDraft] = useState<{
    stage: SpecStage;
    yaml: string;
  } | null>(null);
  const [sectionError, setSectionError] = useState("");
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState("");
  const dirty = yaml !== base.yaml;
  const parsed = useMemo(() => parseSpecYaml(yaml), [yaml]);
  const spec =
    parsed.spec ??
    (builderDraft?.yaml === yaml ? builderDraft.spec : undefined);
  const pending = save.isPending || review.isPending;

  useEffect(() => {
    setYaml("");
    setBase({ yaml: "", updatedAt: "" });
    setBuilderDraft(null);
    setSectionDraft(null);
    setMessage("");
  }, [projectId]);

  useEffect(() => {
    if (loaded.data && !dirty && sectionDraft === null) {
      setYaml(loaded.data.yaml);
      setBase({ yaml: loaded.data.yaml, updatedAt: loaded.data.updatedAt });
    }
    // A dirty draft keeps the timestamp it was based on for conflict detection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, loaded.data?.updatedAt]);

  const navigate = (patch: Record<string, string | null>) => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        Object.entries(patch).forEach(([k, v]) =>
          v === null ? next.delete(k) : next.set(k, v),
        );
        return next;
      },
      { replace: true },
    );
  };
  useEffect(() => {
    if (!spec || sectionDraft !== null) return;
    const items =
      stage === "domain"
        ? domainSection === "entities"
          ? spec.domain.entities
          : domainSection === "relations"
            ? spec.domain.relations
            : domainSection === "terms"
              ? spec.domain.terms
              : []
        : stage === "flows"
          ? spec.flows
          : stage === "useCases"
            ? spec.useCases
            : spec.screens;
    const id =
      items?.find((item) => item.id === selectedId)?.id ?? items?.[0]?.id ?? "";
    if (id !== selectedId) navigate({ selected: id || null });
  }, [spec, stage, domainSection, selectedId, sectionDraft]);

  const update = (next: UiSpec) => {
    const nextYaml = stringify(next);
    setBuilderDraft({ yaml: nextYaml, spec: next });
    setYaml(nextYaml);
    setMessage("");
  };
  const discard = () => {
    if (!loaded.data) return;
    setYaml(loaded.data.yaml);
    setBase({ yaml: loaded.data.yaml, updatedAt: loaded.data.updatedAt });
    setBuilderDraft(null);
    setSectionDraft(null);
    setMessage("保存済みの仕様を読み込みました。");
  };
  async function saveSpec() {
    setMessage("保存中…");
    try {
      const result = await save.mutateAsync({
        projectId,
        yaml,
        expectedUpdatedAt: base.updatedAt || undefined,
      });
      setBase({ yaml: result.yaml, updatedAt: result.updatedAt });
      setMessage(
        parsed.issues.length
          ? "下書きを保存しました。検証エラーがあります。"
          : "保存しました。",
      );
      await generated.refetch();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "保存できませんでした。",
      );
    }
  }
  async function migrateSpec() {
    setMessage("2.1 に移行中…");
    try {
      const result = await migrate.mutateAsync({ projectId, expectedUpdatedAt: base.updatedAt });
      setYaml(result.yaml);
      setBase({ yaml: result.yaml, updatedAt: result.updatedAt });
      setBuilderDraft(null);
      setMessage("2.1 に移行しました。旧版のレビュー履歴とハッシュは保持されています。");
      await loaded.refetch();
      await generated.refetch();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "移行できませんでした。");
    }
  }
  async function decide(status: "approved" | "changes_requested") {
    setMessage("レビューを記録中…");
    try {
      await review.mutateAsync({
        projectId,
        status,
        comment: comment || undefined,
        stage,
        expectedUpdatedAt: base.updatedAt,
      });
      setComment("");
      setMessage(
        status === "approved"
          ? "仕様を承認しました。"
          : "修正依頼を記録しました。",
      );
      await loaded.refetch();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "レビューを記録できませんでした。",
      );
    }
  }
  function applySection() {
    if (!spec || sectionDraft === null) return;
    try {
      const next = SpecSchema.safeParse({
        ...spec,
        [sectionDraft.stage === "actions" ? "screens" : sectionDraft.stage]:
          parse(sectionDraft.yaml),
      });
      if (!next.success) {
        setSectionError(
          formatZodIssues(next.error)
            .map((i) => `${i.path}: ${i.message}`)
            .join("\n"),
        );
        return;
      }
      update(next.data);
      setSectionDraft(null);
      setSectionError("");
    } catch {
      setSectionError("YAMLの構文を確認してください。");
    }
  }
  const hasUnapplied = sectionDraft !== null;
  const reviewStatus = dirty ? "draft" : (loaded.data?.reviewStatus ?? "draft");
  const remoteChanged =
    (dirty || hasUnapplied) && loaded.data?.updatedAt !== base.updatedAt;
  const counts: Record<SpecStage, number> = {
    domain:
      spec === undefined
        ? 0
        : spec.domain.entities.length +
          spec.domain.terms.length +
          spec.domain.actors.length +
          spec.domain.relations.length +
          spec.domain.externalSystems.length,
    flows: spec?.flows?.length ?? 0,
    useCases: spec?.useCases?.length ?? 0,
    screens: spec?.screens.length ?? 0,
    actions:
      spec?.screens.reduce(
        (n, s) => n + s.components.filter((c) => c.action).length,
        0,
      ) ?? 0,
  };

  if (!projectId || (projects.data && !project))
    return (
      <main className="p-8" lang="ja">
        <p>プロジェクトを一覧から選んでください。</p>
        <Link to="/projects">既存のプロジェクトを開く</Link>
      </main>
    );

  return (
    <div className="spec-studio" lang="ja">
      <header className="spec-studio-header">
        <Link className="spec-brand" to="/projects">
          UI仕様スタジオ
        </Link>
        <span className="spec-document-name">
          {project?.name ?? "読込中…"} · {spec?.title ?? "仕様書"}
        </span>
        <div className="spec-header-actions">
          <span className="spec-save-state">
            {dirty || hasUnapplied
              ? "未保存の変更"
              : base.updatedAt
                ? "保存済み"
                : "読込中"}
          </span>
          <Link to={`/projects/${encodeURIComponent(projectId)}`}>
            エージェントチャット
          </Link>
          <Button
            size="sm"
            onClick={() => void saveSpec()}
            disabled={pending || !yaml.trim() || hasUnapplied}
          >
            {save.isPending ? "保存中…" : "仕様を保存"}
          </Button>
          {spec?.version === "2.0" && <Button variant="outline" size="sm" disabled={dirty || hasUnapplied || pending || migrate.isPending || !!parsed.issues.length} onClick={() => void migrateSpec()}>{migrate.isPending ? "移行中…" : "2.1 に移行"}</Button>}
        </div>
      </header>
      <div className="spec-workspace">
        <nav className="spec-stage-nav" aria-label="仕様の検討段階">
          <div className="spec-nav-label">検討の順序</div>
          {stages.map((value, i) => (
            <Button
              variant="ghost"
              key={value}
              className={`spec-stage-link ${stage === value ? "is-active" : ""}`}
              aria-current={stage === value ? "step" : undefined}
              disabled={hasUnapplied}
              onClick={() => navigate({ stage: value, selected: null })}
            >
              <span className="spec-stage-index">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span>
                {stageLabels[value]}
                <small>{counts[value] ? `${counts[value]}件` : "未定義"}</small>
              </span>
            </Button>
          ))}
          <div className="spec-nav-footer">
            <span>仕様形式 {spec?.version ?? "—"}</span>
            <Button variant="outline" size="sm" disabled={hasUnapplied} onClick={() => navigate({ mode: mode === "lists" ? "builder" : "lists" })}>{mode === "lists" ? "編集に戻る" : "画面・項目一覧"}</Button>
            <Button
              variant="outline"
              size="sm"
              disabled={hasUnapplied}
              onClick={() => navigate({ mode: mode === "yaml" ? "builder" : "yaml" })}
            >
              {mode === "yaml" ? "構造ビューに戻る" : "YAMLを直接編集"}
            </Button>
          </div>
        </nav>
        <section className="spec-center" aria-label="仕様の編集領域">
          <div className="spec-stage-toolbar">
            <h1>{mode === "yaml" ? "仕様YAML" : mode === "lists" ? "保存済み仕様の一覧" : stageLabels[stage]}</h1>
            <div>
              {mode === "builder" && spec && !hasUnapplied && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSectionDraft({ stage, yaml: sectionValue(spec, stage) });
                    setSectionError("");
                  }}
                >
                  この段階を編集
                </Button>
              )}
              {(dirty || hasUnapplied) && (
                <Button variant="ghost" size="sm" onClick={discard}>
                  保存済みに戻す
                </Button>
              )}
            </div>
          </div>
          {(message || remoteChanged) && (
            <div className="spec-message" role="status">
              {remoteChanged
                ? "別の編集が保存されています。下書きをコピーしてから、保存済みの仕様を読み直してください。"
                : message}
            </div>
          )}
          {loaded.isError && (
            <div className="spec-errors" role="alert">
              仕様を読み込めませんでした。
              <Button
                variant="outline"
                size="sm"
                onClick={() => void loaded.refetch()}
              >
                再試行
              </Button>
            </div>
          )}
          {!base.updatedAt && loaded.data?.yaml === "" ? (
            <div className="spec-empty">
              仕様の骨格はまだありません。まずチャットでプロダクトの目的、利用者、主要な操作を説明してください。
              <Link to={`/projects/${encodeURIComponent(projectId)}`}>
                チャットを開く
              </Link>
            </div>
          ) : !base.updatedAt && !loaded.isError ? (
            <div
              className="spec-skeleton"
              aria-label="仕様を読み込み中"
              aria-busy="true"
            >
              <div />
              <div />
              <div />
            </div>
          ) : mode === "lists" ? (
            generated.isError ? <div className="spec-errors" role="alert">保存済みの仕様を検証できません。仕様を確認して保存してください。</div> : generated.data ? <><GeneratedLists lists={generated.data} />{dirty && <p className="spec-muted">未保存の変更は一覧に反映されません。</p>}</> : <div className="spec-skeleton" aria-busy="true"><div /><div /></div>
          ) : mode === "yaml" ? (
            <SourceEditor
              value={yaml}
              onChange={(value) => {
                setBuilderDraft(null);
                setYaml(value);
              }}
            />
          ) : hasUnapplied ? (
            <div className="spec-section-editor">
              <div className="spec-section-edit-actions">
                <span>{stageLabels[sectionDraft.stage]}のYAML</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSectionDraft(null);
                    setSectionError("");
                  }}
                >
                  キャンセル
                </Button>
                <Button size="sm" onClick={applySection}>
                  編集内容を反映
                </Button>
              </div>
              <SourceEditor
                value={sectionDraft.yaml}
                onChange={(yaml) => setSectionDraft({ ...sectionDraft, yaml })}
                label="段階のYAML"
              />
              {sectionError && (
                <pre className="spec-errors" role="alert">
                  {sectionError}
                </pre>
              )}
            </div>
          ) : spec ? (
            <StageContent
              {...{ stage, spec, update, selectedId, domainSection }}
              select={(id) => navigate({ selected: id })}
              selectDomainSection={(section) =>
                navigate({ section, selected: null })
              }
              valid={!parsed.issues.length}
            />
          ) : (
            <div className="spec-empty">
              YAMLの形式を確認してください。
              <Button
                variant="outline"
                onClick={() => navigate({ mode: "yaml" })}
              >
                YAMLを編集
              </Button>
            </div>
          )}
        </section>
        <aside className="spec-inspector" aria-label="検証・レビュー・履歴">
          <section className="spec-inspector-section">
            <div className="spec-section-heading">
              <h2>検証</h2>
              <Button
                variant="ghost"
                size="sm"
                disabled={validate.isPending || !yaml}
                onClick={async () => {
                  setMessage("検証中…");
                  try {
                    const r = await validate.mutateAsync({ yaml });
                    setMessage(
                      r.valid
                        ? "参照と形式に問題はありません。"
                        : `検証エラーが${r.issues.length}件あります。`,
                    );
                  } catch {
                    setMessage("検証に失敗しました。");
                  }
                }}
              >
                再検証
              </Button>
            </div>
            {!yaml ? (
              <p className="spec-muted">読込中</p>
            ) : parsed.issues.length ? (
              <div className="spec-validation-issues" role="alert">
                {parsed.issues.map((issue, i) => (
                  <div key={i}>
                    <code>{issue.path}</code>
                    <p>{issue.message}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="spec-valid">参照・形式に問題なし</p>
            )}
            <details className="spec-disclosure">
              <summary>検討段階の定義状況</summary>
              {stages.map((s) => (
                <div className="spec-coverage" key={s}>
                  <span>{stageLabels[s]}</span>
                  <span>{counts[s] ? "定義あり" : "未定義"}</span>
                </div>
              ))}
            </details>
          </section>
          <section className="spec-inspector-section">
            <div className="spec-section-heading">
              <h2>レビュー</h2>
              <span className={`spec-status spec-status--${reviewStatus}`}>
                {statusLabels[reviewStatus] ?? reviewStatus}
              </span>
            </div>
            <p className="spec-review-focus">検討対象：{stageLabels[stage]}</p>
            <Field label="コメント">
              <textarea
                className="spec-comment"
                maxLength={2000}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="判断理由・未決事項を記録"
              />
            </Field>
            <div className="spec-review-actions">
              <Button
                variant="outline"
                size="sm"
                disabled={
                  pending ||
                  dirty ||
                  hasUnapplied ||
                  !base.updatedAt ||
                  !!parsed.issues.length
                }
                onClick={() => void decide("changes_requested")}
              >
                修正を依頼
              </Button>
              <Button
                size="sm"
                disabled={
                  pending ||
                  dirty ||
                  hasUnapplied ||
                  !base.updatedAt ||
                  !!parsed.issues.length
                }
                onClick={() => void decide("approved")}
              >
                仕様を承認
              </Button>
            </div>
            {(dirty || hasUnapplied) && (
              <p className="spec-muted">変更を保存してからレビューできます。</p>
            )}
          </section>
          <section className="spec-inspector-section spec-history">
            <h2>レビュー履歴</h2>
            {loaded.data?.reviewHistory?.length ? (
              <ol>
                {[...loaded.data.reviewHistory].reverse().map((entry) => (
                  <li key={entry.id}>
                    <div>
                      <strong>{statusLabels[entry.status]}</strong>
                      <time>{formatDate(entry.createdAt)}</time>
                    </div>
                    <span>{stageLabels[entry.stage]}</span>
                    {entry.comment && <p>{entry.comment}</p>}
                    <details>
                      <summary>対象の仕様</summary>
                      <code>{entry.documentHash}</code>
                    </details>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="spec-muted">レビューはまだありません。</p>
            )}
            {!loaded.data?.reviewHistory?.length &&
              loaded.data?.reviewComment && (
                <p>以前のコメント：{loaded.data.reviewComment}</p>
              )}
          </section>
          {spec && (
            <details className="spec-inspector-section spec-disclosure">
              <summary>仕様書の設定</summary>
              <Field label="仕様名">
                <Input
                  value={spec.title}
                  onChange={(e) => update({ ...spec, title: e.target.value })}
                />
              </Field>
              <Field label="全体の検討メモ">
                <textarea
                  value={spec.notes ?? ""}
                  onChange={(e) => update({ ...spec, notes: e.target.value })}
                />
              </Field>
            </details>
          )}
        </aside>
      </div>
    </div>
  );
}
