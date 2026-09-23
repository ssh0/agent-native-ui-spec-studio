import {
  renameEntity,
  renameParticipant,
  renameTerm,
} from "@shared/spec-edit";
import {
  ActorSetSchema,
  EntitySetSchema,
  domainSectionLabels,
  domainSections,
  type DomainSection,
  type UiSpec,
} from "@shared/spec-schema";
import { formatReferenceLabel } from "@shared/spec-utils";
import { useEffect, useState } from "react";
import { parse, stringify } from "yaml";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  Empty,
  Field,
  Note,
  ReferenceId,
  ReferenceLabel,
  ReferenceOptions,
  newId,
} from "./spec-editor-ui";

function setHasRef(value: unknown, kind: string, id: string): boolean {
  if (!value || typeof value !== "object") return false;
  if ("operands" in value && Array.isArray(value.operands))
    return value.operands.some((operand) => setHasRef(operand, kind, id));
  return (
    "kind" in value && "id" in value && value.kind === kind && value.id === id
  );
}

export function DomainContent({
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
