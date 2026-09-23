import {
  renameEntity,
  renameParticipant,
  renameScreen,
  renameTerm,
} from "@shared/spec-edit";
import {
  componentTypes,
  ActorSetSchema,
  EntitySetSchema,
  domainSectionLabels,
  domainSections,
  type DomainSection,
  type UiComponent,
  type ActorRef,
  type UiSpec,
  type SpecStage,
} from "@shared/spec-schema";
import {
  formatReferenceLabel,
  performerTitle,
  resolveNamedReference,
  renderFlow,
  renderWireframe,
  shortReferenceId,
} from "@shared/spec-utils";
import { useEffect, useState, type ReactNode } from "react";
import { parse, stringify } from "yaml";

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
function ReferenceLabel({
  items,
  id,
}: {
  items: readonly { id: string; title: string }[];
  id: string;
}) {
  const reference = resolveNamedReference(items, id);
  return (
    <span className="spec-reference-label">
      {reference.title !== undefined ? (
        <span>{reference.title}</span>
      ) : (
        <span className="spec-reference-unresolved">未解決</span>
      )}
      <code title={id} aria-label={`ID: ${id}`}>
        {shortReferenceId(
          id,
          items.map((item) => item.id),
        )}
      </code>
    </span>
  );
}
function referenceText(
  items: readonly { id: string; title: string }[],
  id: string,
) {
  return formatReferenceLabel(
    resolveNamedReference(items, id),
    items.map((item) => item.id),
  );
}
function ReferenceOptions({
  items,
  id,
}: {
  items: readonly { id: string; title: string }[];
  id?: string;
}) {
  return (
    <>
      {id && !items.some((item) => item.id === id) && (
        <option value={id}>{referenceText(items, id)}</option>
      )}
      {items.map((item) => (
        <option key={item.id} value={item.id}>
          {referenceText(items, item.id)}
        </option>
      ))}
    </>
  );
}
function ReferenceId({ id, ids }: { id: string; ids: readonly string[] }) {
  return (
    <code title={id} aria-label={`ID: ${id}`}>
      {shortReferenceId(id, ids)}
    </code>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return <div className="spec-empty">{children}</div>;
}
function ActorRefsEditor({
  spec,
  value,
  onChange,
}: {
  spec: UiSpec;
  value: ActorRef[];
  onChange: (value: ActorRef[]) => void;
}) {
  const options: ActorRef[] = [
    ...spec.domain.actors.map((a) => ({ kind: "actor" as const, id: a.id })),
    ...spec.domain.terms
      .filter((t) => t.actorSet)
      .map((t) => ({ kind: "term" as const, id: t.id })),
  ];
  return (
    <div className="spec-form-grid">
      {options.map((option) => {
        const checked = value.some(
          (r) => r.kind === option.kind && r.id === option.id,
        );
        return (
          <label key={`${option.kind}:${option.id}`}>
            <input
              type="checkbox"
              checked={checked}
              onChange={() =>
                onChange(
                  checked
                    ? value.filter(
                        (r) => r.kind !== option.kind || r.id !== option.id,
                      )
                    : [...value, option],
                )
              }
            />{" "}
            <ReferenceLabel
              items={
                option.kind === "actor" ? spec.domain.actors : spec.domain.terms
              }
              id={option.id}
            />{" "}
            <small>({option.kind === "term" ? "用語" : "アクター"})</small>
          </label>
        );
      })}
      {value
        .filter(
          (ref) =>
            !options.some(
              (option) => option.kind === ref.kind && option.id === ref.id,
            ),
        )
        .map((ref) => (
          <label key={`${ref.kind}:${ref.id}`}>
            <input
              type="checkbox"
              checked
              onChange={() =>
                onChange(
                  value.filter(
                    (item) => item.kind !== ref.kind || item.id !== ref.id,
                  ),
                )
              }
            />{" "}
            <ReferenceLabel
              items={
                ref.kind === "actor" ? spec.domain.actors : spec.domain.terms
              }
              id={ref.id}
            />{" "}
            <small>({ref.kind === "term" ? "用語" : "アクター"})</small>
          </label>
        ))}
    </div>
  );
}
function setHasRef(value: unknown, kind: string, id: string): boolean {
  if (!value || typeof value !== "object") return false;
  if ("operands" in value && Array.isArray(value.operands))
    return value.operands.some((operand) => setHasRef(operand, kind, id));
  return (
    "kind" in value && "id" in value && value.kind === kind && value.id === id
  );
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
            <ReferenceId
              id={item.id}
              ids={items.map((candidate) => candidate.id)}
            />
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
              <ReferenceId
                id={selected.id}
                ids={items.map((item) => item.id)}
              />
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
                            <p>{performerTitle(spec, s.performer)}</p>
                            <Field label="担当者の種類">
                              <select
                                value={s.performer.kind}
                                onChange={(event) => {
                                  const performer =
                                    event.target.value === "actors"
                                      ? {
                                          kind: "actors" as const,
                                          refs: [
                                            {
                                              kind: "actor" as const,
                                              id:
                                                spec.domain.actors[0]?.id ?? "",
                                            },
                                          ],
                                        }
                                      : {
                                          kind: "externalSystem" as const,
                                          id:
                                            spec.domain.externalSystems[0]
                                              ?.id ?? "",
                                        };
                                  update({
                                    ...spec,
                                    flows: spec.flows.map((f) =>
                                      f.id === flow.id
                                        ? {
                                            ...f,
                                            steps: f.steps.map((step) =>
                                              step.id === s.id
                                                ? { ...step, performer }
                                                : step,
                                            ),
                                          }
                                        : f,
                                    ),
                                  });
                                }}
                              >
                                <option value="actors">アクター</option>
                                <option value="externalSystem">
                                  外部システム
                                </option>
                              </select>
                            </Field>
                            {s.performer.kind === "actors" ? (
                              <ActorRefsEditor
                                spec={spec}
                                value={s.performer.refs}
                                onChange={(refs) => {
                                  if (!refs.length) return;
                                  update({
                                    ...spec,
                                    flows: spec.flows.map((f) =>
                                      f.id === flow.id
                                        ? {
                                            ...f,
                                            steps: f.steps.map((step) =>
                                              step.id === s.id
                                                ? {
                                                    ...step,
                                                    performer: {
                                                      kind: "actors",
                                                      refs,
                                                    },
                                                  }
                                                : step,
                                            ),
                                          }
                                        : f,
                                    ),
                                  });
                                }}
                              />
                            ) : (
                              <Field label="外部システム">
                                <select
                                  value={s.performer.id}
                                  onChange={(event) =>
                                    update({
                                      ...spec,
                                      flows: spec.flows.map((f) =>
                                        f.id === flow.id
                                          ? {
                                              ...f,
                                              steps: f.steps.map((step) =>
                                                step.id === s.id
                                                  ? {
                                                      ...step,
                                                      performer: {
                                                        kind: "externalSystem",
                                                        id: event.target.value,
                                                      },
                                                    }
                                                  : step,
                                              ),
                                            }
                                          : f,
                                      ),
                                    })
                                  }
                                >
                                  <ReferenceOptions
                                    items={spec.domain.externalSystems}
                                    id={s.performer.id}
                                  />
                                </select>
                              </Field>
                            )}
                            {s.useCase && (
                              <p>
                                ユースケース：
                                <ReferenceLabel
                                  items={spec.useCases}
                                  id={s.useCase}
                                />
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
                        <dd>
                          {u.actors.length ? (
                            <span className="spec-reference-list">
                              {u.actors.map((ref) => (
                                <span key={`${ref.kind}:${ref.id}`}>
                                  <ReferenceLabel
                                    items={
                                      ref.kind === "actor"
                                        ? spec.domain.actors
                                        : spec.domain.terms
                                    }
                                    id={ref.id}
                                  />{" "}
                                  <small>
                                    {ref.kind === "term" ? "用語" : "アクター"}
                                  </small>
                                </span>
                              ))}
                            </span>
                          ) : (
                            "—"
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>利用アクターを選択</dt>
                        <dd>
                          <ActorRefsEditor
                            spec={spec}
                            value={u.actors}
                            onChange={(actors) =>
                              update({
                                ...spec,
                                useCases: spec.useCases.map((item) =>
                                  item.id === u.id ? { ...item, actors } : item,
                                ),
                              })
                            }
                          />
                        </dd>
                      </div>
                      <div>
                        <dt>対象データ</dt>
                        <dd>
                          {u.entities.length ? (
                            <span className="spec-reference-list">
                              {u.entities.map((id) => (
                                <ReferenceLabel
                                  key={id}
                                  items={spec.domain.entities}
                                  id={id}
                                />
                              ))}
                            </span>
                          ) : (
                            "—"
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>対象画面</dt>
                        <dd>
                          {u.screens.length ? (
                            <span className="spec-reference-list">
                              {u.screens.map((id) => (
                                <ReferenceLabel
                                  key={id}
                                  items={spec.screens}
                                  id={id}
                                />
                              ))}
                            </span>
                          ) : (
                            "—"
                          )}
                        </dd>
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
                            <td>
                              {[
                                ...new Set(
                                  [s.screen, s.action?.screen].filter(
                                    (id): id is string => id !== undefined,
                                  ),
                                ),
                              ].length ? (
                                <span className="spec-reference-list">
                                  {[
                                    ...new Set(
                                      [s.screen, s.action?.screen].filter(
                                        (id): id is string => id !== undefined,
                                      ),
                                    ),
                                  ].map((id) => (
                                    <ReferenceLabel
                                      key={id}
                                      items={spec.screens}
                                      id={id}
                                    />
                                  ))}
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td>
                              {s.action ? (
                                <ReferenceLabel
                                  items={
                                    spec.screens
                                      .find(
                                        (screen) =>
                                          screen.id === s.action?.screen,
                                      )
                                      ?.components.map((component) => ({
                                        id: component.id,
                                        title:
                                          component.label ??
                                          component.content ??
                                          typeLabels[component.type],
                                      })) ?? []
                                  }
                                  id={s.action.component}
                                />
                              ) : (
                                "—"
                              )}
                            </td>
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
                                {b.screen && (
                                  <span className="spec-reference-list">
                                    画面：
                                    <ReferenceLabel
                                      items={spec.screens}
                                      id={b.screen}
                                    />
                                  </span>
                                )}
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
      : domainSection === "relations"
        ? spec.domain.relations
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
            <Button
              variant="outline"
              size="sm"
              disabled={
                domainSection === "relations" && !spec.domain.entities.length
              }
              title={
                domainSection === "relations" && !spec.domain.entities.length
                  ? "先にエンティティを定義してください"
                  : undefined
              }
              onClick={() => {
                const id = newId(domainSection.slice(0, -1));
                const value =
                  domainSection === "entities"
                    ? {
                        id,
                        title: "新しいエンティティ",
                        extends: [],
                        fields: [],
                      }
                    : domainSection === "relations"
                      ? {
                          id,
                          title: "新しい関連",
                          from: {
                            entity: {
                              kind: "entity",
                              id: spec.domain.entities[0]?.id ?? "",
                            },
                            role: "元",
                            min: 0,
                            max: 1,
                          },
                          to: {
                            entity: {
                              kind: "entity",
                              id: spec.domain.entities[0]?.id ?? "",
                            },
                            role: "先",
                            min: 0,
                            max: 1,
                          },
                        }
                      : { id, title: "新しい用語", definition: "定義を入力" };
                update({
                  ...spec,
                  domain: {
                    ...spec.domain,
                    [domainSection]: [...spec.domain[domainSection], value],
                  },
                });
                select(id);
              }}
            >
              {domainSectionLabels[domainSection]}を追加
            </Button>
            {sectionItems.map((item) => (
              <Button
                key={item.id}
                variant="ghost"
                className={`spec-item ${item.id === selected?.id ? "is-selected" : ""}`}
                onClick={() => select(item.id)}
              >
                <span>{item.title}</span>
                <ReferenceId
                  id={item.id}
                  ids={sectionItems.map((candidate) => candidate.id)}
                />
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
                spec={spec}
                update={update}
                select={select}
                entity={
                  spec.domain.entities.find(
                    (entity) => entity.id === selected.id,
                  )!
                }
                domainNotes={spec.domain.notes}
              />
            ) : domainSection === "relations" ? (
              <RelationDetail
                spec={spec}
                update={update}
                select={select}
                relation={
                  spec.domain.relations.find(
                    (relation) => relation.id === selected.id,
                  )!
                }
              />
            ) : (
              <TermDetail
                spec={spec}
                update={update}
                select={select}
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
  spec,
  update,
  select,
  entity,
  domainNotes,
}: {
  spec: UiSpec;
  update: (spec: UiSpec) => void;
  select: (id: string) => void;
  entity: UiSpec["domain"]["entities"][number];
  domainNotes?: string;
}) {
  const patch = (value: Partial<typeof entity>) =>
    update({
      ...spec,
      domain: {
        ...spec.domain,
        entities: spec.domain.entities.map((item) =>
          item.id === entity.id ? { ...item, ...value } : item,
        ),
      },
    });
  const referenced =
    spec.domain.entities.some((e) => e.extends.includes(entity.id)) ||
    spec.domain.relations.some(
      (r) => r.from.entity.id === entity.id || r.to.entity.id === entity.id,
    ) ||
    spec.domain.terms.some(
      (t) =>
        t.entity === entity.id || setHasRef(t.entitySet, "entity", entity.id),
    ) ||
    spec.useCases.some((u) => u.entities.includes(entity.id)) ||
    spec.screens.some((s) => s.entities.includes(entity.id));
  return (
    <>
      <div className="spec-detail-title">
        <h2>{entity.title}</h2>
        <ReferenceId
          id={entity.id}
          ids={spec.domain.entities.map((item) => item.id)}
        />
      </div>
      {entity.description && <p>{entity.description}</p>}
      <div className="spec-form-grid">
        <Field label="ID">
          <Input
            value={entity.id}
            onChange={(event) => {
              update(renameEntity(spec, entity.id, event.target.value));
              select(event.target.value);
            }}
          />
        </Field>
        <Field label="名称">
          <Input
            value={entity.title}
            onChange={(event) => patch({ title: event.target.value })}
          />
        </Field>
        <Field label="説明">
          <Input
            value={entity.description ?? ""}
            onChange={(event) =>
              patch({ description: event.target.value || undefined })
            }
          />
        </Field>
      </div>
      <h3>上位エンティティ (is-a)</h3>
      <div className="spec-form-grid">
        {spec.domain.entities
          .filter((other) => other.id !== entity.id)
          .map((other) => (
            <label key={other.id}>
              <input
                type="checkbox"
                checked={entity.extends.includes(other.id)}
                onChange={() =>
                  patch({
                    extends: entity.extends.includes(other.id)
                      ? entity.extends.filter((id) => id !== other.id)
                      : [...entity.extends, other.id],
                  })
                }
              />{" "}
              <ReferenceLabel items={spec.domain.entities} id={other.id} />
            </label>
          ))}
      </div>
      <Button
        variant="ghost"
        size="sm"
        disabled={referenced}
        title={referenced ? "参照を置換してから削除してください" : undefined}
        onClick={() =>
          update({
            ...spec,
            domain: {
              ...spec.domain,
              entities: spec.domain.entities.filter(
                (item) => item.id !== entity.id,
              ),
            },
          })
        }
      >
        {referenced ? "参照中のため削除不可" : "削除"}
      </Button>
      <table className="spec-table">
        <thead>
          <tr>
            <th>項目</th>
            <th>型・構造</th>
            <th>必須</th>
            <th>メモ</th>
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
              <td>{field.notes ?? "—"}</td>
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
  spec,
  update,
  select,
  term,
  domainNotes,
}: {
  spec: UiSpec;
  update: (spec: UiSpec) => void;
  select: (id: string) => void;
  term: UiSpec["domain"]["terms"][number];
  domainNotes?: string;
}) {
  const patch = (value: Partial<typeof term>) =>
    update({
      ...spec,
      domain: {
        ...spec.domain,
        terms: spec.domain.terms.map((item) =>
          item.id === term.id ? { ...item, ...value } : item,
        ),
      },
    });
  const referenced =
    spec.useCases.some((u) =>
      u.actors.some((r) => r.kind === "term" && r.id === term.id),
    ) ||
    spec.flows.some((f) =>
      f.steps.some(
        (s) =>
          s.performer.kind === "actors" &&
          s.performer.refs.some((r) => r.kind === "term" && r.id === term.id),
      ),
    ) ||
    spec.domain.terms.some(
      (t) =>
        t.id !== term.id &&
        (setHasRef(t.actorSet, "term", term.id) ||
          setHasRef(t.entitySet, "term", term.id)),
    );
  return (
    <>
      <div className="spec-detail-title">
        <h2>{term.title}</h2>
        <ReferenceId
          id={term.id}
          ids={spec.domain.terms.map((item) => item.id)}
        />
      </div>
      <p>{term.definition}</p>
      <div className="spec-form-grid">
        <Field label="ID">
          <Input
            value={term.id}
            onChange={(event) => {
              update(renameTerm(spec, term.id, event.target.value));
              select(event.target.value);
            }}
          />
        </Field>
        <Field label="名称">
          <Input
            value={term.title}
            onChange={(event) => patch({ title: event.target.value })}
          />
        </Field>
        <Field label="定義">
          <Input
            value={term.definition}
            onChange={(event) => patch({ definition: event.target.value })}
          />
        </Field>
      </div>
      <Field label="集合の種類">
        <select
          value={term.actorSet ? "actor" : term.entitySet ? "entity" : "none"}
          onChange={(event) =>
            patch({
              actorSet:
                event.target.value === "actor"
                  ? { kind: "actor", id: spec.domain.actors[0]?.id ?? "" }
                  : undefined,
              entitySet:
                event.target.value === "entity"
                  ? { kind: "entity", id: spec.domain.entities[0]?.id ?? "" }
                  : undefined,
            })
          }
        >
          <option value="none">なし</option>
          <option value="actor">アクター集合</option>
          <option value="entity">エンティティ集合</option>
        </select>
      </Field>
      {term.actorSet && (
        <SetEditor
          key={`${term.id}:actor`}
          value={term.actorSet}
          schema={ActorSetSchema}
          choices={[
            ...spec.domain.actors.map((a) => ({
              kind: "actor",
              id: a.id,
              title: a.title,
            })),
            ...spec.domain.terms
              .filter((t) => t.id !== term.id && t.actorSet)
              .map((t) => ({ kind: "term", id: t.id, title: t.title })),
          ]}
          onChange={(actorSet) =>
            patch({ actorSet: actorSet as typeof term.actorSet })
          }
        />
      )}
      {term.entitySet && (
        <SetEditor
          key={`${term.id}:entity`}
          value={term.entitySet}
          schema={EntitySetSchema}
          choices={[
            ...spec.domain.entities.map((e) => ({
              kind: "entity",
              id: e.id,
              title: e.title,
            })),
            ...spec.domain.terms
              .filter((t) => t.id !== term.id && t.entitySet)
              .map((t) => ({ kind: "term", id: t.id, title: t.title })),
          ]}
          onChange={(entitySet) =>
            patch({ entitySet: entitySet as typeof term.entitySet })
          }
        />
      )}
      <Button
        variant="ghost"
        size="sm"
        disabled={referenced}
        title={referenced ? "参照を置換してから削除してください" : undefined}
        onClick={() =>
          update({
            ...spec,
            domain: {
              ...spec.domain,
              terms: spec.domain.terms.filter((item) => item.id !== term.id),
            },
          })
        }
      >
        {referenced ? "参照中のため削除不可" : "削除"}
      </Button>
      <dl className="spec-facts">
        <div>
          <dt>関連エンティティ</dt>
          <dd>
            {term.entity ? (
              <ReferenceLabel items={spec.domain.entities} id={term.entity} />
            ) : (
              "—"
            )}
          </dd>
        </div>
      </dl>
      <Field label="説明対象のエンティティ">
        <select
          value={term.entity ?? ""}
          onChange={(event) =>
            patch({ entity: event.target.value || undefined })
          }
        >
          <option value="">なし</option>
          <ReferenceOptions items={spec.domain.entities} id={term.entity} />
        </select>
      </Field>
      <Note value={term.notes} />
      <Note value={domainNotes} />
    </>
  );
}

function SetEditor({
  value,
  schema,
  choices,
  onChange,
}: {
  value: unknown;
  schema: typeof ActorSetSchema | typeof EntitySetSchema;
  choices: { kind: string; id: string; title: string }[];
  onChange: (value: unknown) => void;
}) {
  const [draft, setDraft] = useState(stringify(value));
  const [error, setError] = useState("");
  useEffect(() => setDraft(stringify(value)), [value]);
  return (
    <div className="spec-section-editor">
      <p>
        集合式: 定義済み参照、または union / intersection / difference と
        operands（差集合は2件）
      </p>
      <p>
        参照先:{" "}
        {choices
          .map(
            (choice) =>
              `${choice.kind}: ${formatReferenceLabel(
                { id: choice.id, title: choice.title },
                choices.map((candidate) => candidate.id),
              )}`,
          )
          .join("、")}
      </p>
      <textarea
        rows={8}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        aria-label="集合式のYAML"
        spellCheck={false}
      />
      <Button
        size="sm"
        onClick={() => {
          try {
            const result = schema.safeParse(parse(draft));
            if (!result.success) {
              setError("集合式の参照種別と演算子を確認してください。");
              return;
            }
            onChange(result.data);
            setError("");
          } catch {
            setError("集合式のYAMLを確認してください。");
          }
        }}
      >
        集合式を反映
      </Button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

function RelationDetail({
  spec,
  update,
  select,
  relation,
}: {
  spec: UiSpec;
  update: (spec: UiSpec) => void;
  select: (id: string) => void;
  relation: UiSpec["domain"]["relations"][number];
}) {
  const patch = (value: Partial<typeof relation>) =>
    update({
      ...spec,
      domain: {
        ...spec.domain,
        relations: spec.domain.relations.map((item) =>
          item.id === relation.id ? { ...item, ...value } : item,
        ),
      },
    });
  const endEditor = (side: "from" | "to") => {
    const end = relation[side];
    const patchEnd = (value: Partial<typeof end>) =>
      patch({ [side]: { ...end, ...value } });
    return (
      <div className="spec-component">
        <h3>{side === "from" ? "起点" : "終点"}</h3>
        <div className="spec-form-grid">
          <Field label="エンティティ">
            <select
              value={end.entity.id}
              onChange={(event) =>
                patchEnd({ entity: { kind: "entity", id: event.target.value } })
              }
            >
              <ReferenceOptions
                items={spec.domain.entities}
                id={end.entity.id}
              />
            </select>
          </Field>
          <Field label="役割名">
            <Input
              value={end.role}
              onChange={(event) => patchEnd({ role: event.target.value })}
            />
          </Field>
          <Field label="最小数">
            <Input
              type="number"
              min={0}
              value={end.min}
              onChange={(event) =>
                patchEnd({ min: Number(event.target.value) })
              }
            />
          </Field>
          <Field label="最大数（空欄 = 無制限）">
            <Input
              type="number"
              min={1}
              value={end.max ?? ""}
              onChange={(event) =>
                patchEnd({
                  max:
                    event.target.value === ""
                      ? null
                      : Number(event.target.value),
                })
              }
            />
          </Field>
        </div>
      </div>
    );
  };
  return (
    <>
      <div className="spec-detail-title">
        <h2>{relation.title}</h2>
        <ReferenceId
          id={relation.id}
          ids={spec.domain.relations.map((item) => item.id)}
        />
      </div>
      <div className="spec-form-grid">
        <Field label="ID">
          <Input
            value={relation.id}
            onChange={(event) => {
              patch({ id: event.target.value });
              select(event.target.value);
            }}
          />
        </Field>
        <Field label="名称">
          <Input
            value={relation.title}
            onChange={(event) => patch({ title: event.target.value })}
          />
        </Field>
      </div>
      {endEditor("from")}
      {endEditor("to")}
      <Button
        variant="ghost"
        size="sm"
        onClick={() =>
          update({
            ...spec,
            domain: {
              ...spec.domain,
              relations: spec.domain.relations.filter(
                (item) => item.id !== relation.id,
              ),
            },
          })
        }
      >
        関連を削除
      </Button>
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
        const referenced =
          spec.flows.some((flow) =>
            flow.steps.some((step) =>
              kind === "actor"
                ? step.performer.kind === "actors" &&
                  step.performer.refs.some(
                    (ref) => ref.kind === "actor" && ref.id === participant.id,
                  )
                : step.performer.kind === "externalSystem" &&
                  step.performer.id === participant.id,
            ),
          ) ||
          (kind === "actor" &&
            (spec.useCases.some((useCase) =>
              useCase.actors.some(
                (ref) => ref.kind === "actor" && ref.id === participant.id,
              ),
            ) ||
              spec.domain.terms.some((term) =>
                setHasRef(term.actorSet, "actor", participant.id),
              )));
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
                referenced ? "参照先を置換してから削除してください" : undefined
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
              {referenced ? "参照中のため削除不可" : "削除"}
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
            <ReferenceId
              id={s.id}
              ids={spec.screens.map((screen) => screen.id)}
            />
          </Button>
        ))}
        <Button variant="outline" size="sm" onClick={addScreen}>
          画面を追加
        </Button>
      </aside>
      <div className="spec-stage-detail">
        <div className="spec-detail-title">
          <h2>{selected.title}</h2>
          <ReferenceId
            id={selected.id}
            ids={spec.screens.map((screen) => screen.id)}
          />
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
                  __html: renderWireframe(
                    { ...spec, screens: [selected] },
                    spec.screens.map((screen) => screen.id),
                  ),
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
                    対象データ：{" "}
                    {selected.entities.length ? (
                      <span className="spec-reference-list">
                        {selected.entities.map((id) => (
                          <ReferenceLabel
                            key={id}
                            items={spec.domain.entities}
                            id={id}
                          />
                        ))}
                      </span>
                    ) : (
                      "未設定"
                    )}
                  </span>
                  <span>
                    ユースケース：{" "}
                    {selected.useCases.length ? (
                      <span className="spec-reference-list">
                        {selected.useCases.map((id) => (
                          <ReferenceLabel
                            key={id}
                            items={spec.useCases}
                            id={id}
                          />
                        ))}
                      </span>
                    ) : (
                      "未設定"
                    )}
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
                        <ReferenceOptions items={spec.screens} id={t.to} />
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
