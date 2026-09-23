import { renameParticipant, renameScreen } from "@shared/spec-edit";
import {
  componentTypes,
  domainSectionLabels,
  domainSections,
  type DomainSection,
  type UiComponent,
  type UiSpec,
  type SpecStage,
} from "@shared/spec-schema";
import { renderFlow, renderWireframe } from "@shared/spec-utils";
import { useState, type ReactNode } from "react";
import { stringify } from "yaml";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { MermaidFlowPreview } from "./mermaid-preview";

export const newId = (prefix: string) =>
  `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
const typeLabels: Record<(typeof componentTypes)[number], string> = {
  button: "ボタン",
  text: "テキスト",
  input: "入力",
  image: "画像",
  toggle: "切替",
  select: "選択",
  link: "リンク",
  card: "カード",
  list: "一覧",
  divider: "区切り",
  navigation: "ナビゲーション",
};
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="spec-field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function Note({ value }: { value?: string }) {
  return value ? (
    <div className="spec-note">
      <strong>検討メモ</strong>
      <p>{value}</p>
    </div>
  ) : null;
}
export function Empty({ children }: { children: ReactNode }) {
  return <div className="spec-empty">{children}</div>;
}
export function SourceEditor({
  value,
  onChange,
  label = "仕様YAML",
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
}) {
  return (
    <textarea
      className="spec-editor"
      aria-label={label}
      spellCheck={false}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function StageContent({
  stage,
  spec,
  update,
  selectedId,
  select,
  domainSection,
  selectDomainSection,
  valid,
}: {
  stage: SpecStage;
  spec: UiSpec;
  update: (s: UiSpec) => void;
  selectedId: string;
  select: (id: string) => void;
  domainSection: DomainSection;
  selectDomainSection: (section: DomainSection) => void;
  valid: boolean;
}) {
  if (stage === "screens" || stage === "actions")
    return (
      <ScreenBuilder {...{ stage, spec, update, selectedId, select, valid }} />
    );
  if (stage === "domain")
    return (
      <DomainContent
        {...{
          spec,
          update,
          selectedId,
          select,
          domainSection,
          selectDomainSection,
        }}
      />
    );
  const items = stage === "flows" ? (spec.flows ?? []) : (spec.useCases ?? []);
  const selected = items.find((i) => i.id === selectedId) ?? items[0];
  return (
    <div className="spec-stage-layout">
      <aside className="spec-item-list" aria-label="検討対象">
        {items.map((item) => (
          <Button
            key={item.id}
            variant="ghost"
            className={`spec-item ${item.id === selected?.id ? "is-selected" : ""}`}
            onClick={() => select(item.id)}
          >
            <span>{item.title}</span>
            <code>{item.id}</code>
          </Button>
        ))}
        {!items.length && <Empty>未定義</Empty>}
      </aside>
      <div className="spec-stage-detail">
        {!selected ? (
          <Empty>「この段階を編集」から検討内容を追加できます。</Empty>
        ) : (
          <>
            <div className="spec-detail-title">
              <h2>{selected.title}</h2>
              <code>{selected.id}</code>
            </div>
            {stage === "flows" &&
              (() => {
                const flow = spec.flows!.find((f) => f.id === selected.id)!;
                return (
                  <>
                    <dl className="spec-facts">
                      <div>
                        <dt>目的</dt>
                        <dd>{flow.goal ?? "—"}</dd>
                      </div>
                    </dl>
                    <ol className="spec-step-list">
                      {flow.steps.map((s, i) => (
                        <li key={s.id}>
                          <span className="spec-step-number">{i + 1}</span>
                          <div>
                            <strong>{s.title}</strong>
                            <p>
                              {s.performer.kind === "actor"
                                ? "アクター"
                                : "外部システム"}
                              ：
                              {(s.performer.kind === "actor"
                                ? spec.domain.actors
                                : spec.domain.externalSystems
                              ).find((p) => p.id === s.performer.id)?.title ??
                                s.performer.id}
                            </p>
                            {s.useCase && (
                              <p>
                                ユースケース：
                                {spec.useCases?.find((u) => u.id === s.useCase)
                                  ?.title ?? s.useCase}
                              </p>
                            )}
                            <Note value={s.notes} />
                          </div>
                        </li>
                      ))}
                    </ol>
                    <Note value={flow.notes} />
                    <h3>業務フロー図</h3>
                    {valid ? (
                      <Diagram
                        key={flow.id}
                        source={renderFlow(spec, "flows", flow.id)}
                      />
                    ) : (
                      <Empty>参照エラーを修正すると図を表示できます。</Empty>
                    )}
                  </>
                );
              })()}
            {stage === "useCases" &&
              (() => {
                const u = spec.useCases!.find((u) => u.id === selected.id)!;
                return (
                  <>
                    <dl className="spec-facts">
                      <div>
                        <dt>利用者</dt>
                        <dd>{u.actor ?? "—"}</dd>
                      </div>
                      <div>
                        <dt>対象データ</dt>
                        <dd>{u.entities?.join("、") || "—"}</dd>
                      </div>
                      <div>
                        <dt>事前条件</dt>
                        <dd>{u.preconditions?.join(" / ") || "—"}</dd>
                      </div>
                      <div>
                        <dt>事後条件</dt>
                        <dd>{u.postconditions?.join(" / ") || "—"}</dd>
                      </div>
                    </dl>
                    <h3>基本系列</h3>
                    <table className="spec-table">
                      <thead>
                        <tr>
                          <th>手順</th>
                          <th>画面</th>
                          <th>操作部品</th>
                        </tr>
                      </thead>
                      <tbody>
                        {u.steps.map((s, i) => (
                          <tr key={s.id}>
                            <td>
                              {i + 1}. {s.title}
                              <code>{s.id}</code>
                              {s.notes && <p>{s.notes}</p>}
                            </td>
                            <td>{s.screen ?? s.action?.screen ?? "—"}</td>
                            <td>{s.action?.component ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <h3>条件による分岐・例外</h3>
                    {u.branches.length ? (
                      <table className="spec-table">
                        <thead>
                          <tr>
                            <th>種類・条件</th>
                            <th>発生手順</th>
                            <th>対応・再開先</th>
                          </tr>
                        </thead>
                        <tbody>
                          {u.branches.map((b) => (
                            <tr key={b.id}>
                              <td>
                                <span className={`spec-branch-kind ${b.kind}`}>
                                  {b.kind === "exception" ? "例外" : "分岐"}
                                </span>
                                {b.condition}
                              </td>
                              <td>{b.from}</td>
                              <td>
                                {b.outcome}
                                <code>
                                  {b.resumeAt
                                    ? `→ ${b.resumeAt}`
                                    : "この分岐で終了"}
                                </code>
                                {b.notes && <p>{b.notes}</p>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <Empty>分岐・例外は未定義です。</Empty>
                    )}
                    <Note value={u.notes} />
                    <details className="spec-disclosure">
                      <summary>ユースケースフロー図</summary>
                      {valid ? (
                        <Diagram
                          key={u.id}
                          source={renderFlow(spec, "useCases", u.id)}
                        />
                      ) : (
                        <Empty>参照エラーを修正すると図を表示できます。</Empty>
                      )}
                    </details>
                  </>
                );
              })()}
          </>
        )}
      </div>
    </div>
  );
}

function DomainContent({
  spec,
  update,
  selectedId,
  select,
  domainSection,
  selectDomainSection,
}: {
  spec: UiSpec;
  update: (spec: UiSpec) => void;
  selectedId: string;
  select: (id: string) => void;
  domainSection: DomainSection;
  selectDomainSection: (section: DomainSection) => void;
}) {
  const sectionItems =
    domainSection === "entities"
      ? spec.domain.entities
      : domainSection === "terms"
        ? spec.domain.terms
        : [];
  const selected =
    sectionItems.find((item) => item.id === selectedId) ?? sectionItems[0];

  return (
    <div className="spec-domain-content">
      <nav
        className="spec-domain-sections"
        aria-label="データ・用語のセクション"
      >
        {domainSections.map((section) => {
          const count = spec.domain[section].length;
          return (
            <Button
              key={section}
              variant="ghost"
              className={`spec-domain-section ${domainSection === section ? "is-active" : ""}`}
              aria-current={domainSection === section ? "page" : undefined}
              onClick={() => selectDomainSection(section)}
            >
              <span>{domainSectionLabels[section]}</span>
              <small>{count}</small>
            </Button>
          );
        })}
      </nav>
      {domainSection === "actors" || domainSection === "externalSystems" ? (
        <ParticipantEditor
          key={domainSection}
          spec={spec}
          update={update}
          section={domainSection}
        />
      ) : (
        <div className="spec-stage-layout">
          <aside
            className="spec-item-list"
            aria-label={`${domainSectionLabels[domainSection]}一覧`}
          >
            {sectionItems.map((item) => (
              <Button
                key={item.id}
                variant="ghost"
                className={`spec-item ${item.id === selected?.id ? "is-selected" : ""}`}
                onClick={() => select(item.id)}
              >
                <span>{item.title}</span>
                <code>{item.id}</code>
              </Button>
            ))}
            {!sectionItems.length && <Empty>未定義</Empty>}
          </aside>
          <div className="spec-stage-detail">
            {!selected ? (
              <>
                <Empty>「この段階を編集」から検討内容を追加できます。</Empty>
                <Note value={spec.domain.notes} />
              </>
            ) : domainSection === "entities" ? (
              <EntityDetail
                entity={
                  spec.domain.entities.find(
                    (entity) => entity.id === selected.id,
                  )!
                }
                domainNotes={spec.domain.notes}
              />
            ) : (
              <TermDetail
                term={
                  spec.domain.terms.find((term) => term.id === selected.id)!
                }
                domainNotes={spec.domain.notes}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function EntityDetail({
  entity,
  domainNotes,
}: {
  entity: UiSpec["domain"]["entities"][number];
  domainNotes?: string;
}) {
  return (
    <>
      <div className="spec-detail-title">
        <h2>{entity.title}</h2>
        <code>{entity.id}</code>
      </div>
      {entity.description && <p>{entity.description}</p>}
      <table className="spec-table">
        <thead>
          <tr>
            <th>項目</th>
            <th>型・構造</th>
            <th>必須</th>
            <th>関連データ</th>
          </tr>
        </thead>
        <tbody>
          {entity.fields.map((field) => (
            <tr key={field.id}>
              <td>
                {field.title}
                <code>{field.id}</code>
              </td>
              <td>{field.type}</td>
              <td>{field.required ? "必須" : "任意"}</td>
              <td>
                {field.entity ?? "—"}
                {field.notes && <p>{field.notes}</p>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Note value={entity.notes} />
      <Note value={domainNotes} />
    </>
  );
}

function TermDetail({
  term,
  domainNotes,
}: {
  term: UiSpec["domain"]["terms"][number];
  domainNotes?: string;
}) {
  return (
    <>
      <div className="spec-detail-title">
        <h2>{term.title}</h2>
        <code>{term.id}</code>
      </div>
      <p>{term.definition}</p>
      <dl className="spec-facts">
        <div>
          <dt>関連エンティティ</dt>
          <dd>{term.entity ?? "—"}</dd>
        </div>
      </dl>
      <Note value={term.notes} />
      <Note value={domainNotes} />
    </>
  );
}

function ParticipantEditor({
  spec,
  update,
  section,
}: {
  spec: UiSpec;
  update: (spec: UiSpec) => void;
  section: Extract<DomainSection, "actors" | "externalSystems">;
}) {
  const kind = section === "actors" ? "actor" : "externalSystem";
  const title = domainSectionLabels[section];
  const patch = (
    index: number,
    values: Partial<UiSpec["domain"]["actors"][number]>,
  ) =>
    update({
      ...spec,
      domain: {
        ...spec.domain,
        [section]: spec.domain[section].map((participant, i) =>
          i === index ? { ...participant, ...values } : participant,
        ),
      },
    });

  return (
    <div className="spec-participant-editor">
      <div className="spec-section-heading">
        <h2>{title}</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            update({
              ...spec,
              domain: {
                ...spec.domain,
                [section]: [
                  ...spec.domain[section],
                  {
                    id: newId(kind),
                    title: `新しい${title}`,
                    description: "",
                  },
                ],
              },
            })
          }
        >
          {title}を追加
        </Button>
      </div>
      {!spec.domain[section].length && <Empty>未定義</Empty>}
      {spec.domain[section].map((participant, index) => {
        const referenced = spec.flows.some((flow) =>
          flow.steps.some(
            (step) =>
              step.performer.kind === kind &&
              step.performer.id === participant.id,
          ),
        );
        return (
          <div className="spec-component" key={participant.id}>
            <div className="spec-form-grid">
              <Field label="ID">
                <Input
                  value={participant.id}
                  onChange={(event) =>
                    update(
                      renameParticipant(
                        spec,
                        kind,
                        participant.id,
                        event.target.value,
                      ),
                    )
                  }
                />
              </Field>
              <Field label="名称">
                <Input
                  value={participant.title}
                  onChange={(event) =>
                    patch(index, { title: event.target.value })
                  }
                />
              </Field>
              <Field label="役割・説明">
                <Input
                  value={participant.description}
                  onChange={(event) =>
                    patch(index, { description: event.target.value })
                  }
                />
              </Field>
            </div>
            <Button
              variant="ghost"
              size="sm"
              disabled={referenced}
              title={
                referenced
                  ? "手順の実行者を変更してから削除してください"
                  : undefined
              }
              onClick={() =>
                update({
                  ...spec,
                  domain: {
                    ...spec.domain,
                    [section]: spec.domain[section].filter(
                      (_, i) => i !== index,
                    ),
                  },
                })
              }
            >
              {referenced ? "手順で参照中" : "削除"}
            </Button>
          </div>
        );
      })}
      <Note value={spec.domain.notes} />
    </div>
  );
}

export function Diagram({ source }: { source: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <div className="spec-diagram">
      <div className="spec-diagram-toolbar">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setEditing(!editing)}
          aria-pressed={editing}
        >
          {editing ? "図を閲覧" : "Mermaidを試作"}
        </Button>
        {draft !== null && (
          <Button variant="ghost" size="sm" onClick={() => setDraft(null)}>
            仕様から再生成
          </Button>
        )}
      </div>
      {editing && (
        <>
          <p className="spec-muted">
            図だけの一時編集です。仕様に保存する場合は元の定義を編集してください。
          </p>
          <SourceEditor
            label="Mermaidソース"
            value={draft ?? source}
            onChange={setDraft}
          />
        </>
      )}
      <MermaidFlowPreview source={draft ?? source} />
    </div>
  );
}

function ScreenBuilder({
  stage,
  spec,
  update,
  selectedId,
  select,
  valid,
}: {
  stage: SpecStage;
  spec: UiSpec;
  update: (s: UiSpec) => void;
  selectedId: string;
  select: (id: string) => void;
  valid: boolean;
}) {
  const selected =
    spec.screens.find((s) => s.id === selectedId) ?? spec.screens[0];
  const [tab, setTab] = useState<
    "definition" | "wireframe" | "flow" | "states"
  >("definition");
  const addScreen = () => {
    const screen: UiSpec["screens"][number] = {
      id: newId("screen"),
      title: "新しい画面",
      entities: [],
      useCases: [],
      stateFlow: { initial: null, states: [], transitions: [] },
      components: [],
    };
    update({ ...spec, screens: [...spec.screens, screen] });
    select(screen.id);
  };
  if (!selected) {
    return (
      <Empty>
        画面はまだ定義されていません。
        <Button variant="outline" size="sm" onClick={addScreen}>
          画面を追加
        </Button>
      </Empty>
    );
  }
  const updateScreen = (patch: Partial<UiSpec["screens"][number]>) => {
    const next = {
      ...spec,
      screens: spec.screens.map((s) =>
        s.id === selected.id ? { ...s, ...patch, id: s.id } : s,
      ),
    };
    update(
      patch.id !== undefined ? renameScreen(next, selected.id, patch.id) : next,
    );
    if (patch.id !== undefined) select(patch.id);
  };
  const updateComponent = (index: number, patch: Partial<UiComponent>) =>
    updateScreen({
      components: selected.components.map((c, i) =>
        i === index ? { ...c, ...patch } : c,
      ),
    });
  return (
    <div className="spec-stage-layout">
      <aside className="spec-item-list" aria-label="画面一覧">
        {spec.screens.map((s) => (
          <Button
            variant="ghost"
            key={s.id}
            className={`spec-item ${s.id === selected.id ? "is-selected" : ""}`}
            onClick={() => select(s.id)}
          >
            <span>{s.title}</span>
            <code>{s.id}</code>
          </Button>
        ))}
        <Button variant="outline" size="sm" onClick={addScreen}>
          画面を追加
        </Button>
      </aside>
      <div className="spec-stage-detail">
        <div className="spec-detail-title">
          <h2>{selected.title}</h2>
          {stage === "screens" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                update({
                  ...spec,
                  screens: spec.screens.filter((s) => s.id !== selected.id),
                  transitions: spec.transitions.filter(
                    (t) => t.from !== selected.id && t.to !== selected.id,
                  ),
                });
                select(
                  spec.screens.find((s) => s.id !== selected.id)?.id ?? "",
                );
              }}
            >
              画面を削除
            </Button>
          )}
        </div>
        {stage === "screens" && (
          <div className="spec-view-tabs" aria-label="画面の表示切替">
            {(
              [
                ["definition", "定義"],
                ["wireframe", "ワイヤーフレーム"],
                ["flow", "画面遷移図"],
                ["states", "画面状態図"],
              ] as const
            ).map(([value, title]) => (
              <Button
                key={value}
                variant={tab === value ? "secondary" : "ghost"}
                size="sm"
                aria-pressed={tab === value}
                onClick={() => setTab(value)}
              >
                {title}
              </Button>
            ))}
          </div>
        )}
        {stage === "screens" && tab !== "definition" ? (
          valid ? (
            tab === "wireframe" ? (
              <div
                className="spec-wireframe-preview"
                dangerouslySetInnerHTML={{
                  __html: renderWireframe({ ...spec, screens: [selected] }),
                }}
              />
            ) : (
              <Diagram
                key={`${selected.id}-${tab}`}
                source={renderFlow(
                  spec,
                  tab === "flow" ? "screens" : "states",
                  selected.id,
                )}
              />
            )
          ) : (
            <Empty>検証エラーを修正するとプレビューを表示できます。</Empty>
          )
        ) : (
          <>
            {stage === "screens" && (
              <>
                <div className="spec-form-grid">
                  <Field label="画面ID">
                    <Input
                      value={selected.id}
                      onChange={(e) => updateScreen({ id: e.target.value })}
                    />
                  </Field>
                  <Field label="画面名">
                    <Input
                      value={selected.title}
                      onChange={(e) => updateScreen({ title: e.target.value })}
                    />
                  </Field>
                  <Field label="機能・役割">
                    <textarea
                      value={selected.description ?? ""}
                      onChange={(e) =>
                        updateScreen({ description: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="検討メモ">
                    <textarea
                      value={selected.notes ?? ""}
                      onChange={(e) => updateScreen({ notes: e.target.value })}
                    />
                  </Field>
                </div>
                <div className="spec-reference-line">
                  <span>
                    対象データ：{selected.entities?.join("、") || "未設定"}
                  </span>
                  <span>
                    ユースケース：{selected.useCases?.join("、") || "未設定"}
                  </span>
                </div>
              </>
            )}
            <div className="spec-section-heading">
              <h3>{stage === "actions" ? "操作とその結果" : "画面の部品"}</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  updateScreen({
                    components: [
                      ...selected.components,
                      {
                        id: newId("component"),
                        type: stage === "actions" ? "button" : "text",
                        label: "新しい部品",
                        ...(stage === "actions"
                          ? { action: "new-action" }
                          : {}),
                      },
                    ],
                  })
                }
              >
                部品を追加
              </Button>
            </div>
            {selected.components.map((c, index) => (
              <div className="spec-component" key={index}>
                <div className="spec-component-title">
                  <strong>{c.label ?? c.content ?? typeLabels[c.type]}</strong>
                  <code>{c.id}</code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      updateScreen({
                        components: selected.components.filter(
                          (_, i) => i !== index,
                        ),
                      })
                    }
                    aria-label={`${c.id}を削除`}
                  >
                    削除
                  </Button>
                </div>
                <div className="spec-form-grid">
                  {stage === "screens" ? (
                    <>
                      <Field label="種類">
                        <select
                          value={c.type}
                          onChange={(e) =>
                            updateComponent(index, {
                              type: e.target.value as UiComponent["type"],
                            })
                          }
                        >
                          {componentTypes.map((t) => (
                            <option key={t} value={t}>
                              {typeLabels[t]}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="ラベル">
                        <Input
                          value={c.label ?? ""}
                          onChange={(e) =>
                            updateComponent(index, { label: e.target.value })
                          }
                        />
                      </Field>
                      <Field label="本文">
                        <Input
                          value={c.content ?? ""}
                          onChange={(e) =>
                            updateComponent(index, { content: e.target.value })
                          }
                        />
                      </Field>
                      <Field label="アクション">
                        <Input
                          value={c.action ?? ""}
                          onChange={(e) =>
                            updateComponent(index, {
                              action: e.target.value || undefined,
                            })
                          }
                        />
                      </Field>
                    </>
                  ) : (
                    <>
                      <Field label="アクション名">
                        <Input
                          value={c.action ?? ""}
                          onChange={(e) =>
                            updateComponent(index, {
                              action: e.target.value || undefined,
                            })
                          }
                        />
                      </Field>
                      <Field label="実行条件">
                        <Input
                          value={c.precondition ?? ""}
                          onChange={(e) =>
                            updateComponent(index, {
                              precondition: e.target.value,
                            })
                          }
                        />
                      </Field>
                      <Field label="実行結果">
                        <Input
                          value={c.outcome ?? ""}
                          onChange={(e) =>
                            updateComponent(index, { outcome: e.target.value })
                          }
                        />
                      </Field>
                      <Field label="検討メモ">
                        <Input
                          value={c.notes ?? ""}
                          onChange={(e) =>
                            updateComponent(index, { notes: e.target.value })
                          }
                        />
                      </Field>
                    </>
                  )}
                </div>
              </div>
            ))}
            {stage === "screens" && (
              <>
                <div className="spec-section-heading">
                  <h3>画面間の遷移</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      update({
                        ...spec,
                        transitions: [
                          ...spec.transitions,
                          {
                            from: selected.id,
                            to:
                              spec.screens.find((s) => s.id !== selected.id)
                                ?.id ?? selected.id,
                            trigger: "操作",
                          },
                        ],
                      })
                    }
                  >
                    遷移を追加
                  </Button>
                </div>
                {spec.transitions.map((t, index) =>
                  t.from !== selected.id ? null : (
                    <div className="spec-transition" key={index}>
                      <span>→</span>
                      <select
                        aria-label="遷移先"
                        value={t.to}
                        onChange={(e) =>
                          update({
                            ...spec,
                            transitions: spec.transitions.map((v, i) =>
                              i === index ? { ...v, to: e.target.value } : v,
                            ),
                          })
                        }
                      >
                        {spec.screens.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.title}
                          </option>
                        ))}
                      </select>
                      <Input
                        aria-label="遷移のきっかけ"
                        value={t.trigger}
                        onChange={(e) =>
                          update({
                            ...spec,
                            transitions: spec.transitions.map((v, i) =>
                              i === index
                                ? { ...v, trigger: e.target.value }
                                : v,
                            ),
                          })
                        }
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          update({
                            ...spec,
                            transitions: spec.transitions.filter(
                              (_, i) => i !== index,
                            ),
                          })
                        }
                      >
                        削除
                      </Button>
                    </div>
                  ),
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
export function sectionValue(spec: UiSpec, stage: SpecStage) {
  return stringify(stage === "actions" ? spec.screens : spec[stage]);
}
