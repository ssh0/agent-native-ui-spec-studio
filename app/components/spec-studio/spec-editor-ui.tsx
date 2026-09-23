import { componentTypes, type ActorRef, type UiSpec } from "@shared/spec-schema";
import {
  formatReferenceLabel,
  resolveNamedReference,
  shortReferenceId,
} from "@shared/spec-utils";
import type { ReactNode } from "react";

export const newId = (prefix: string) =>
  `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
export const typeLabels: Record<(typeof componentTypes)[number], string> = {
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
export function ReferenceLabel({
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
export function ReferenceOptions({
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
export function ReferenceId({ id, ids }: { id: string; ids: readonly string[] }) {
  return (
    <code title={id} aria-label={`ID: ${id}`}>
      {shortReferenceId(id, ids)}
    </code>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return <div className="spec-empty">{children}</div>;
}
export function ActorRefsEditor({
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
