import type { UiSpec } from "@shared/spec-schema";
import { IconMinus, IconPlus, IconZoomReset } from "@tabler/icons-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

import { BusinessFlowPreview } from "./business-flow-preview";
import { MermaidFlowPreview } from "./mermaid-preview";
import { SourceEditor } from "./spec-editor-ui";

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2;
const ZOOM_STEP = 0.25;

export function Diagram({
  source,
  businessFlow,
}: {
  source: string;
  businessFlow?: { spec: UiSpec; flow: UiSpec["flows"][number] };
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const diagramSource = draft ?? source;
  const usesBusinessFlowLayout = businessFlow !== undefined && draft === null;
  const hasDiagram = usesBusinessFlowLayout
    ? businessFlow.flow.steps.length > 0
    : diagramSource.trim().length > 0;
  return (
    <div className="spec-diagram">
      <div className="spec-diagram-toolbar">
        <div className="spec-diagram-actions">
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
        <div
          className="spec-diagram-zoom"
          role="group"
          aria-label="図の拡大縮小"
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="縮小"
            title="縮小"
            disabled={!hasDiagram || zoom <= MIN_ZOOM}
            onClick={() =>
              setZoom((current) => Math.max(MIN_ZOOM, current - ZOOM_STEP))
            }
          >
            <IconMinus aria-hidden="true" />
          </Button>
          <output aria-live="polite">{Math.round(zoom * 100)}%</output>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="拡大"
            title="拡大"
            disabled={!hasDiagram || zoom >= MAX_ZOOM}
            onClick={() =>
              setZoom((current) => Math.min(MAX_ZOOM, current + ZOOM_STEP))
            }
          >
            <IconPlus aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="倍率を100%に戻す"
            title="倍率を100%に戻す"
            disabled={zoom === 1}
            onClick={() => setZoom(1)}
          >
            <IconZoomReset aria-hidden="true" />
          </Button>
        </div>
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
      {usesBusinessFlowLayout ? (
        <BusinessFlowPreview
          spec={businessFlow.spec}
          flow={businessFlow.flow}
          zoom={zoom}
        />
      ) : (
        <MermaidFlowPreview source={diagramSource} zoom={zoom} />
      )}
    </div>
  );
}
