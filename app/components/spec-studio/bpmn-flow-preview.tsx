import {
  flowEdgeBpmnId,
  flowNodeBpmnId,
  flowToBpmnXml,
} from "@shared/bpmn-flow";
import type { UiSpec } from "@shared/spec-schema";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

type Flow = UiSpec["flows"][number];

/** The YAML flow is canonical; BPMN is a disposable, interactive projection. */
export function BpmnFlowPreview({
  spec,
  flow,
  update,
}: {
  spec: UiSpec;
  flow: Flow;
  update?: (spec: UiSpec) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<import("@bpmnkit/canvas").BpmnCanvas | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedEdgeIndex, setSelectedEdgeIndex] = useState<number | null>(
    null,
  );
  const [draftTitle, setDraftTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const xml = useMemo(() => flowToBpmnXml(spec, flow), [spec, flow]);

  useEffect(() => {
    if (!host.current || !flow.steps.length) return;
    let active = true;
    let cleanup = () => {};
    void import("@bpmnkit/canvas")
      .then(({ BpmnCanvas }) => {
        if (!active || !host.current) return;
        const instance = new BpmnCanvas({
          container: host.current,
          theme: "auto",
        });
        canvas.current = instance;
        try {
          instance.load(xml);
        } catch (error) {
          instance.destroy();
          canvas.current = null;
          throw error;
        }
        const off = instance.on("element:click", (id) => {
          const node = flow.steps.find(
            (step) => flowNodeBpmnId(flow.id, step.id) === id,
          );
          if (!node) {
            const index =
              flow.edges?.findIndex(
                (edge) => flowEdgeBpmnId(flow.id, edge) === id,
              ) ?? -1;
            if (index >= 0) {
              setSelectedId(null);
              setSelectedEdgeIndex(index);
              setDraftTitle(flow.edges![index].label ?? "");
            }
            return;
          }
          setSelectedEdgeIndex(null);
          setSelectedId(node.id);
          setDraftTitle("title" in node ? node.title : "");
          const item = document.getElementById(
            `flow-node-${flow.id}-${node.id}`,
          );
          item?.scrollIntoView({ block: "nearest", behavior: "smooth" });
        });
        cleanup = () => {
          off();
          instance.destroy();
          canvas.current = null;
        };
      })
      .catch(() => {
        if (active)
          setError(
            "BPMN図を表示できませんでした。仕様の内容を確認してください。",
          );
      });
    return () => {
      active = false;
      cleanup();
    };
  }, [xml, flow.id, flow.steps.length]);

  const selected = flow.steps.find((step) => step.id === selectedId);
  const selectedEdge =
    selectedEdgeIndex === null ? undefined : flow.edges?.[selectedEdgeIndex];
  const branchEdge = flow.steps.some(
    (node) => node.id === selectedEdge?.from && node.kind === "branch",
  );
  const duplicateBranchLabel =
    branchEdge &&
    flow.edges?.some(
      (edge, index) =>
        index !== selectedEdgeIndex &&
        edge.from === selectedEdge?.from &&
        edge.label === draftTitle.trim(),
    );
  return (
    <section className="spec-bpmn" aria-label={`${flow.title}のBPMN図`}>
      <div className="spec-bpmn-toolbar" role="group" aria-label="BPMN図の操作">
        <Button
          variant="outline"
          size="sm"
          onClick={() => canvas.current?.zoomOut()}
        >
          縮小
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => canvas.current?.zoomIn()}
        >
          拡大
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => canvas.current?.fitView()}
        >
          全体表示
        </Button>
      </div>
      <p className="spec-muted">
        ドラッグで移動、ホイールで拡大・縮小。ノードを選ぶと対応する仕様項目へ移動します。ノード名と接続条件は図の下で編集できます。
      </p>
      {error && <p role="alert">{error}</p>}
      {!flow.steps.length ? (
        <p>この業務フローには手順がありません。</p>
      ) : (
        <div ref={host} className="spec-bpmn-canvas" />
      )}
      {selectedEdge && (
        <div className="spec-bpmn-selection" aria-live="polite">
          <p>
            接続: {selectedEdge.from} → {selectedEdge.to}
          </p>
          {update && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const label = draftTitle.trim();
                if (
                  (branchEdge && !label) ||
                  duplicateBranchLabel ||
                  label === (selectedEdge.label ?? "")
                )
                  return;
                update({
                  ...spec,
                  flows: spec.flows.map((item) =>
                    item.id === flow.id
                      ? {
                          ...item,
                          edges: item.edges?.map((edge, index) =>
                            index === selectedEdgeIndex
                              ? { ...edge, label: label || undefined }
                              : edge,
                          ),
                        }
                      : item,
                  ),
                });
              }}
            >
              <label htmlFor={`bpmn-edge-${flow.id}`}>接続条件</label>
              <input
                id={`bpmn-edge-${flow.id}`}
                value={draftTitle}
                onChange={(event) => setDraftTitle(event.target.value)}
              />
              <Button
                type="submit"
                size="sm"
                disabled={
                  (branchEdge && !draftTitle.trim()) ||
                  !!duplicateBranchLabel ||
                  draftTitle.trim() === (selectedEdge.label ?? "")
                }
              >
                下書きに反映
              </Button>
            </form>
          )}
        </div>
      )}
      {selected && (
        <div className="spec-bpmn-selection" aria-live="polite">
          <p>
            選択中:{" "}
            {"title" in selected
              ? selected.title
              : selected.kind === "start"
                ? "開始"
                : "終了"}
            （{selected.id}）
          </p>
          {"title" in selected && update && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const title = draftTitle.trim();
                if (!title || title === selected.title) return;
                update({
                  ...spec,
                  flows: spec.flows.map((item) =>
                    item.id === flow.id
                      ? {
                          ...item,
                          steps: item.steps.map((node) =>
                            node.id === selected.id ? { ...node, title } : node,
                          ),
                        }
                      : item,
                  ),
                });
              }}
            >
              <label htmlFor={`bpmn-title-${flow.id}`}>ノード名</label>
              <input
                id={`bpmn-title-${flow.id}`}
                value={draftTitle}
                onChange={(event) => setDraftTitle(event.target.value)}
              />
              <Button
                type="submit"
                size="sm"
                disabled={
                  !draftTitle.trim() || draftTitle.trim() === selected.title
                }
              >
                下書きに反映
              </Button>
            </form>
          )}
        </div>
      )}
    </section>
  );
}
