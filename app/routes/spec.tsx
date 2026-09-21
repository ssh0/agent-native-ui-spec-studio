import {
  useActionMutation,
  useActionQuery,
} from "@agent-native/core/client/hooks";
import { useSetPageTitle } from "@agent-native/toolkit/app-shell";
import { useEffect, useState } from "react";

import "../spec-studio.css";

const initialYaml = "# Loading UI specification…";

type Issue = { path: string; message: string };

type ValidationResult = {
  valid: boolean;
  issues: Issue[];
};

type WireframeResult = { format: "html"; html: string };
type FlowResult = { format: "mermaid"; mermaid: string };

export function meta() {
  return [{ title: "UI Spec Studio" }];
}

export default function SpecPage() {
  useSetPageTitle("UI Spec Studio");
  const loaded = useActionQuery("spec.load", {});
  const save = useActionMutation("spec.update");
  const validate = useActionMutation("spec.validate");
  const wireframe = useActionMutation("spec.renderWireframe");
  const flow = useActionMutation("spec.renderFlow");
  const review = useActionMutation("spec.review");
  const [yaml, setYaml] = useState(initialYaml);
  const [dirty, setDirty] = useState(false);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [wireframeHtml, setWireframeHtml] = useState("");
  const [mermaid, setMermaid] = useState("");
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (loaded.data?.yaml && !dirty) setYaml(loaded.data.yaml);
  }, [dirty, loaded.data?.yaml]);

  async function refreshPreviews(source: string) {
    const validation = (await validate.mutateAsync({
      yaml: source,
    })) as ValidationResult;
    setIssues(validation.issues ?? []);
    if (!validation.valid) {
      setWireframeHtml("");
      setMermaid("");
      return validation;
    }
    const [wireframeResult, flowResult] = await Promise.all([
      wireframe.mutateAsync({ yaml: source }) as Promise<WireframeResult>,
      flow.mutateAsync({ yaml: source }) as Promise<FlowResult>,
    ]);
    setWireframeHtml(wireframeResult.html);
    setMermaid(flowResult.mermaid);
    return validation;
  }

  async function saveSpec() {
    setMessage("");
    try {
      await save.mutateAsync({ yaml });
      const validation = await refreshPreviews(yaml);
      setDirty(false);
      setMessage(
        validation.valid
          ? "Saved and rendered."
          : "Saved, but validation found issues.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not save specification.",
      );
    }
  }

  async function approve(status: "approved" | "changes_requested") {
    try {
      await review.mutateAsync({ status, comment: comment || undefined });
      setMessage(
        status === "approved"
          ? "Specification approved."
          : "Changes requested.",
      );
      await loaded.refetch();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not update review.",
      );
    }
  }

  useEffect(() => {
    if (loaded.data?.yaml && !wireframeHtml && !dirty) {
      void refreshPreviews(loaded.data.yaml);
    }
    // Initial render only; preview refresh is explicit after edits/saves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded.data?.yaml]);

  const isBusy =
    save.isPending ||
    validate.isPending ||
    wireframe.isPending ||
    flow.isPending;
  const reviewStatus = loaded.data?.reviewStatus ?? "draft";

  return (
    <main className="spec-studio">
      <header className="spec-studio__header">
        <div>
          <p className="spec-studio__eyebrow">REQUIREMENTS WORKSPACE</p>
          <h1>UI Spec Studio</h1>
          <p>Define once in YAML, review the flow with people and agents.</p>
        </div>
        <a className="spec-studio__chat-link" href="/home">
          Open agent chat →
        </a>
      </header>

      <div className="spec-studio__grid">
        <section className="spec-panel spec-editor-panel">
          <div className="spec-panel__heading">
            <div>
              <span className="spec-panel__kicker">SOURCE</span>
              <h2>YAML specification</h2>
            </div>
            <span className={`spec-status spec-status--${reviewStatus}`}>
              {reviewStatus.replace("_", " ")}
            </span>
          </div>
          <textarea
            className="spec-editor"
            value={yaml}
            onChange={(event) => {
              setYaml(event.target.value);
              setDirty(true);
              setMessage("");
            }}
            spellCheck={false}
            aria-label="UI specification YAML"
          />
          <div className="spec-editor__footer">
            <button
              className="spec-button spec-button--primary"
              onClick={() => void saveSpec()}
              disabled={isBusy || !yaml.trim()}
            >
              {isBusy ? "Working…" : "Save & render"}
            </button>
            {message ? <span className="spec-message">{message}</span> : null}
          </div>
          {issues.length > 0 ? (
            <div className="spec-errors" role="alert">
              <strong>Validation issues</strong>
              {issues.map((issue) => (
                <div key={`${issue.path}-${issue.message}`}>
                  <code>{issue.path}</code> {issue.message}
                </div>
              ))}
            </div>
          ) : null}
        </section>

        <section className="spec-panel spec-preview-panel">
          <div className="spec-panel__heading">
            <div>
              <span className="spec-panel__kicker">RENDER</span>
              <h2>Wireframe preview</h2>
            </div>
            <span className="spec-live-dot">● live after save</span>
          </div>
          <div className="spec-wireframe-preview">
            {wireframeHtml ? (
              <div dangerouslySetInnerHTML={{ __html: wireframeHtml }} />
            ) : (
              <p className="spec-empty">
                Save a valid specification to render screens.
              </p>
            )}
          </div>
        </section>

        <section className="spec-panel spec-flow-panel">
          <div className="spec-panel__heading">
            <div>
              <span className="spec-panel__kicker">MERMAID</span>
              <h2>Screen flow</h2>
            </div>
          </div>
          <pre className="spec-flow-code">
            {mermaid ||
              "flowchart TD\n  Save a valid specification to render the flow"}
          </pre>
          <p className="spec-flow-note">
            Copy this Mermaid text into your documentation or diagram tool.
          </p>
        </section>

        <section className="spec-panel spec-review-panel">
          <div className="spec-panel__heading">
            <div>
              <span className="spec-panel__kicker">HUMAN REVIEW</span>
              <h2>Review decision</h2>
            </div>
            <span className={`spec-status spec-status--${reviewStatus}`}>
              {reviewStatus.replace("_", " ")}
            </span>
          </div>
          <textarea
            className="spec-comment"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Leave a note for the author or agent…"
            aria-label="Review comment"
          />
          <div className="spec-review-actions">
            <button
              className="spec-button spec-button--quiet"
              onClick={() => void approve("changes_requested")}
              disabled={review.isPending}
            >
              Request changes
            </button>
            <button
              className="spec-button spec-button--approve"
              onClick={() => void approve("approved")}
              disabled={review.isPending}
            >
              Approve spec
            </button>
          </div>
          {loaded.data?.reviewComment ? (
            <p className="spec-last-comment">
              Last note: {loaded.data.reviewComment}
            </p>
          ) : null}
        </section>
      </div>
    </main>
  );
}
