import {
  useActionMutation,
  useActionQuery,
} from "@agent-native/core/client/hooks";
import { useSetPageTitle } from "@agent-native/toolkit/app-shell";
import { parse, stringify } from "yaml";
import { useEffect, useMemo, useState } from "react";

import { componentTypes, type UiComponent, type UiSpec } from "@shared/spec-schema";
import "../spec-studio.css";

type Issue = { path: string; message: string };
type ValidationResult = { valid: boolean; issues: Issue[] };
type WireframeResult = { format: "html"; html: string };
type FlowResult = { format: "mermaid"; mermaid: string };

const emptySpec: UiSpec = { version: "1.0", title: "", screens: [], transitions: [] };
const newId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 7)}`;

export function meta() { return [{ title: "UI Spec Studio" }]; }

export default function SpecPage() {
  useSetPageTitle("UI Spec Studio");
  const loaded = useActionQuery("spec-load", {});
  const save = useActionMutation("spec-update");
  const validate = useActionMutation("spec-validate");
  const wireframe = useActionMutation("spec-render-wireframe");
  const flow = useActionMutation("spec-render-flow");
  const review = useActionMutation("spec-review");
  const [yaml, setYaml] = useState("");
  const [spec, setSpec] = useState<UiSpec>(emptySpec);
  const [selectedId, setSelectedId] = useState("");
  const [mode, setMode] = useState<"builder" | "yaml">("builder");
  const [dirty, setDirty] = useState(false);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [wireframeHtml, setWireframeHtml] = useState("");
  const [mermaid, setMermaid] = useState("");
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (loaded.data?.yaml && !dirty) {
      setYaml(loaded.data.yaml);
      try {
        const parsed = parse(loaded.data.yaml) as UiSpec;
        setSpec({ ...emptySpec, ...parsed, transitions: parsed.transitions ?? [] });
        setSelectedId((current) => current || parsed.screens?.[0]?.id || "");
      } catch { /* validation action owns malformed YAML feedback */ }
    }
  }, [dirty, loaded.data?.yaml]);

  const selected = useMemo(() => spec.screens.find((screen) => screen.id === selectedId) ?? spec.screens[0], [spec, selectedId]);
  const reviewStatus = loaded.data?.reviewStatus ?? "draft";
  const updateSpec = (next: UiSpec) => { setSpec(next); setYaml(stringify(next)); setDirty(true); setMessage(""); };
  const updateScreen = (patch: Partial<UiSpec["screens"][number]>) => {
    if (!selected) return;
    const nextId = patch.id ?? selected.id;
    updateSpec({
      ...spec,
      screens: spec.screens.map((screen) => screen.id === selected.id ? { ...screen, ...patch } : screen),
      transitions: spec.transitions.map((transition) => ({
        ...transition,
        from: transition.from === selected.id ? nextId : transition.from,
        to: transition.to === selected.id ? nextId : transition.to,
      })),
    });
    if (patch.id) setSelectedId(patch.id);
  };
  const updateComponent = (id: string, patch: Partial<UiComponent>) => {
    if (!selected) return;
    updateScreen({ components: selected.components.map((component) => component.id === id ? { ...component, ...patch } : component) });
  };

  async function refreshPreviews(source: string) {
    const validation = (await validate.mutateAsync({ yaml: source })) as ValidationResult;
    setIssues(validation.issues ?? []);
    if (!validation.valid) { setWireframeHtml(""); setMermaid(""); return validation; }
    const [wireframeResult, flowResult] = await Promise.all([
      wireframe.mutateAsync({ yaml: source }) as Promise<WireframeResult>,
      flow.mutateAsync({ yaml: source }) as Promise<FlowResult>,
    ]);
    setWireframeHtml(wireframeResult.html); setMermaid(flowResult.mermaid); return validation;
  }
  async function saveSpec() {
    setMessage("");
    try {
      const source = mode === "yaml" ? yaml : stringify(spec);
      await save.mutateAsync({ yaml: source });
      const validation = await refreshPreviews(source);
      setDirty(false); setYaml(source);
      setMessage(validation.valid ? "Saved and rendered." : "Saved, but validation found issues.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save specification."); }
  }
  async function approve(status: "approved" | "changes_requested") {
    try { await review.mutateAsync({ status, comment: comment || undefined }); setMessage(status === "approved" ? "Specification approved." : "Changes requested."); await loaded.refetch(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not update review."); }
  }
  const isBusy = save.isPending || validate.isPending || wireframe.isPending || flow.isPending;

  return <main className="spec-studio">
    <header className="spec-studio__header">
      <div><p className="spec-studio__eyebrow">REQUIREMENTS WORKSPACE</p><h1>UI Spec Studio</h1><p>Shape screens, transitions, and components together.</p></div>
      <a className="spec-studio__chat-link" href="/home">Open agent chat →</a>
    </header>
    <div className="spec-toolbar"><div className="spec-tabs"><button className={mode === "builder" ? "is-active" : ""} onClick={() => setMode("builder")}>Builder</button><button className={mode === "yaml" ? "is-active" : ""} onClick={() => setMode("yaml")}>YAML</button></div><button className="spec-button spec-button--primary" onClick={() => void saveSpec()} disabled={isBusy || !yaml.trim()}>{isBusy ? "Working…" : "Save changes"}</button>{message && <span className="spec-message">{message}</span>}</div>
    {mode === "yaml" ? <section className="spec-panel spec-yaml-panel"><div className="spec-panel__heading"><div><span className="spec-panel__kicker">SOURCE</span><h2>YAML specification</h2></div><span className={`spec-status spec-status--${reviewStatus}`}>{reviewStatus.replace("_", " ")}</span></div><textarea className="spec-editor spec-editor--short" value={yaml} onChange={(event) => { setYaml(event.target.value); setDirty(true); }} spellCheck={false} aria-label="UI specification YAML" />{issues.length > 0 && <ValidationIssues issues={issues} />}</section> : <Builder spec={spec} selected={selected} selectedId={selectedId} setSelectedId={setSelectedId} updateSpec={updateSpec} updateScreen={updateScreen} updateComponent={updateComponent} />}
    <div className="spec-preview-grid">
      <section className="spec-panel"><div className="spec-panel__heading"><div><span className="spec-panel__kicker">RENDER</span><h2>Wireframe preview</h2></div><span className="spec-live-dot">● live after save</span></div><div className="spec-wireframe-preview">{wireframeHtml ? <div dangerouslySetInnerHTML={{ __html: wireframeHtml }} /> : <p className="spec-empty">Save a valid specification to render screens.</p>}</div></section>
      <section className="spec-panel"><div className="spec-panel__heading"><div><span className="spec-panel__kicker">FLOW</span><h2>Screen flow</h2></div></div><pre className="spec-flow-code">{mermaid || "flowchart TD\n  Save a valid specification to render the flow"}</pre></section>
    </div>
    <section className="spec-panel spec-review-panel"><div className="spec-panel__heading"><div><span className="spec-panel__kicker">HUMAN REVIEW</span><h2>Review decision</h2></div><span className={`spec-status spec-status--${reviewStatus}`}>{reviewStatus.replace("_", " ")}</span></div><textarea className="spec-comment" value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Leave a note for the author or agent…" aria-label="Review comment" /><div className="spec-review-actions"><button className="spec-button spec-button--quiet" onClick={() => void approve("changes_requested")} disabled={review.isPending}>Request changes</button><button className="spec-button spec-button--approve" onClick={() => void approve("approved")} disabled={review.isPending}>Approve spec</button></div>{loaded.data?.reviewComment && <p className="spec-last-comment">Last note: {loaded.data.reviewComment}</p>}</section>
  </main>;
}

function ValidationIssues({ issues }: { issues: Issue[] }) { return <div className="spec-errors" role="alert"><strong>Validation issues</strong>{issues.map((issue) => <div key={`${issue.path}-${issue.message}`}><code>{issue.path}</code> {issue.message}</div>)}</div>; }

type BuilderProps = { spec: UiSpec; selected?: UiSpec["screens"][number]; selectedId: string; setSelectedId: (id: string) => void; updateSpec: (spec: UiSpec) => void; updateScreen: (patch: Partial<UiSpec["screens"][number]>) => void; updateComponent: (id: string, patch: Partial<UiComponent>) => void };
function Builder({ spec, selected, selectedId, setSelectedId, updateSpec, updateScreen, updateComponent }: BuilderProps) {
  const addScreen = () => { const screen = { id: newId("screen"), title: "New screen", components: [] }; updateSpec({ ...spec, screens: [...spec.screens, screen] }); setSelectedId(screen.id); };
  const removeScreen = () => { if (!selected || spec.screens.length < 2) return; const screens = spec.screens.filter((screen) => screen.id !== selected.id); updateSpec({ ...spec, screens, transitions: spec.transitions.filter((t) => t.from !== selected.id && t.to !== selected.id) }); setSelectedId(screens[0].id); };
  const addComponent = () => { if (!selected) return; updateScreen({ components: [...selected.components, { type: "text", id: newId("component"), content: "New content" }] }); };
  const removeComponent = (id: string) => updateScreen({ components: selected?.components.filter((component) => component.id !== id) ?? [] });
  const addTransition = () => { if (spec.screens.length < 2) return; updateSpec({ ...spec, transitions: [...spec.transitions, { from: selected?.id ?? spec.screens[0].id, to: spec.screens.find((screen) => screen.id !== (selected?.id ?? spec.screens[0].id))?.id ?? spec.screens[0].id, trigger: "action.click" }] }); };
  return <div className="builder-grid"><aside className="spec-panel screen-list"><div className="spec-panel__heading"><div><span className="spec-panel__kicker">SCREENS</span><h2>Specification map</h2></div><button className="icon-button" onClick={addScreen} aria-label="Add screen">+</button></div>{spec.screens.map((screen) => <button key={screen.id} className={`screen-list__item ${screen.id === selectedId ? "is-selected" : ""}`} onClick={() => setSelectedId(screen.id)}><span>{screen.title}</span><code>{screen.id}</code></button>)}<button className="text-button" onClick={addTransition}>+ Add transition</button></aside><section className="spec-panel builder-detail">{selected ? <><div className="spec-panel__heading"><div><span className="spec-panel__kicker">SCREEN DETAIL</span><h2>{selected.title}</h2></div><button className="text-button text-button--danger" onClick={removeScreen} disabled={spec.screens.length < 2}>Delete screen</button></div><div className="form-grid"><label>Screen id<input value={selected.id} onChange={(e) => updateScreen({ id: e.target.value })} /></label><label>Title<input value={selected.title} onChange={(e) => updateScreen({ title: e.target.value })} /></label><label className="form-grid__wide">Description<textarea value={selected.description ?? ""} onChange={(e) => updateScreen({ description: e.target.value })} /></label></div><div className="component-heading"><h3>Components <span>{selected.components.length}</span></h3><button className="text-button" onClick={addComponent}>+ Add component</button></div>{selected.components.map((component) => <ComponentEditor key={component.id} component={component} onChange={(patch) => updateComponent(component.id, patch)} onDelete={() => removeComponent(component.id)} />)}</> : <p className="spec-empty">Add a screen to start building.</p>}<div className="transition-list"><h3>Transitions</h3>{spec.transitions.map((transition, index) => <div className="transition-row" key={`${transition.from}-${transition.to}-${index}`}><select value={transition.from} onChange={(e) => updateSpec({ ...spec, transitions: spec.transitions.map((t, i) => i === index ? { ...t, from: e.target.value } : t) })}>{spec.screens.map((s) => <option key={s.id}>{s.id}</option>)}</select><span>→</span><select value={transition.to} onChange={(e) => updateSpec({ ...spec, transitions: spec.transitions.map((t, i) => i === index ? { ...t, to: e.target.value } : t) })}>{spec.screens.map((s) => <option key={s.id}>{s.id}</option>)}</select><input value={transition.trigger} onChange={(e) => updateSpec({ ...spec, transitions: spec.transitions.map((t, i) => i === index ? { ...t, trigger: e.target.value } : t) })} /><button className="text-button text-button--danger" onClick={() => updateSpec({ ...spec, transitions: spec.transitions.filter((_, i) => i !== index) })}>Remove</button></div>)}</div></section></div>;
}

function ComponentEditor({ component, onChange, onDelete }: { component: UiComponent; onChange: (patch: Partial<UiComponent>) => void; onDelete: () => void }) { return <div className="component-row"><div className="component-row__top"><code>{component.id}</code><button className="text-button text-button--danger" onClick={onDelete}>Remove</button></div><div className="form-grid"><label>Type<select value={component.type} onChange={(e) => onChange({ type: e.target.value as typeof componentTypes[number] })}>{componentTypes.map((type) => <option key={type}>{type}</option>)}</select></label><label>Label<input value={component.label ?? ""} onChange={(e) => onChange({ label: e.target.value })} /></label><label className="form-grid__wide">Content / action<input value={component.content ?? component.action ?? ""} onChange={(e) => onChange({ content: e.target.value })} /></label></div></div>; }
