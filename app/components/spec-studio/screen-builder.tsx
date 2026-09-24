import { renameScreen } from "@shared/spec-edit";
import {
  componentTypes,
  type SpecStage,
  type UiComponent,
  type UiSpec,
} from "@shared/spec-schema";
import { renderFlow, renderWireframe, transitionRowKey } from "@shared/spec-utils";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { Diagram } from "./diagram";
import {
  Empty,
  Field,
  ReferenceId,
  ReferenceLabel,
  ReferenceOptions,
  newId,
  typeLabels,
} from "./spec-editor-ui";

export function ScreenBuilder({
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
                    disabled={spec.version === "2.0"}
                    onClick={() =>
                      update({
                        ...spec,
                        transitions: [
                          ...spec.transitions,
                          {
                            id: newId("transition"),
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
                {spec.version === "2.0" && <p className="spec-muted">遷移の編集には 2.1 への移行が必要です。</p>}
                {spec.transitions.map((t, index) =>
                  t.from !== selected.id ? null : (
                    <div className="spec-transition" key={transitionRowKey(t, index)}>
                      <span>→</span>
                      <select
                        aria-label="遷移先"
                        disabled={spec.version === "2.0"}
                        value={t.to}
                        onChange={(e) =>
                          update({
                            ...spec,
                            transitions: spec.transitions.map((v) =>
                              v.id === t.id ? { ...v, to: e.target.value } : v,
                            ),
                          })
                        }
                      >
                        <ReferenceOptions items={spec.screens} id={t.to} />
                      </select>
                      <Input
                        aria-label="遷移のきっかけ"
                        disabled={spec.version === "2.0"}
                        value={t.trigger}
                        onChange={(e) =>
                          update({
                            ...spec,
                            transitions: spec.transitions.map((v) =>
                              v.id === t.id
                                ? { ...v, trigger: e.target.value }
                                : v,
                            ),
                          })
                        }
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={spec.version === "2.0"}
                        onClick={() =>
                          update({
                            ...spec,
                            transitions: spec.transitions.filter((v) => v.id !== t.id),
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
