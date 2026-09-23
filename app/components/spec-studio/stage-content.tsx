import {
  type DomainSection,
  type SpecStage,
  type UiSpec,
} from "@shared/spec-schema";
import { performerTitle, renderFlow } from "@shared/spec-utils";
import { stringify } from "yaml";

import { Button } from "@/components/ui/button";

import { Diagram } from "./diagram";
import { DomainContent } from "./domain-content";
import { ScreenBuilder } from "./screen-builder";
import {
  ActorRefsEditor,
  Empty,
  Field,
  Note,
  ReferenceId,
  ReferenceLabel,
  ReferenceOptions,
  typeLabels,
} from "./spec-editor-ui";

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

export function sectionValue(spec: UiSpec, stage: SpecStage) {
  return stringify(stage === "actions" ? spec.screens : spec[stage]);
}
