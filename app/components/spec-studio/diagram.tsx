import { useState } from "react";

import { Button } from "@/components/ui/button";

import { MermaidFlowPreview } from "./mermaid-preview";
import { SourceEditor } from "./spec-editor-ui";

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

