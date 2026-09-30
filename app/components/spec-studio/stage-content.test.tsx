import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DEFAULT_SPEC_YAML } from "../../../shared/default-spec";
import { parseSpecYaml } from "../../../shared/spec-utils";
import { StageContent } from "./stage-content";

const spec = parseSpecYaml(DEFAULT_SPEC_YAML).spec!;

describe("specification stage composition", () => {
  it("offers a BPMN diagram and addressable specification nodes for business flows", () => {
    const html = renderToStaticMarkup(
      <StageContent
        stage="flows"
        spec={spec}
        update={() => {}}
        selectedId={spec.flows[0].id}
        select={() => {}}
        domainSection="entities"
        selectDomainSection={() => {}}
        valid
      />,
    );
    expect(html).toContain('aria-label="作業の受付と登録のBPMN図"');
    expect(html).toContain('id="flow-node-task-intake-request"');
    expect(html).toContain('class="spec-bpmn-canvas"');
    expect(html).not.toContain("Mermaidを試作");
  });

  it("sizes use-case diagrams to their content without changing business-flow sizing", () => {
    const renderStage = (stage: "useCases" | "flows") =>
      renderToStaticMarkup(
        <StageContent
          stage={stage}
          spec={spec}
          update={() => {}}
          selectedId=""
          select={() => {}}
          domainSection="entities"
          selectDomainSection={() => {}}
          valid
        />,
      );
    expect(renderStage("useCases")).toContain("spec-diagram-fit-content");
    expect(renderStage("flows")).not.toContain("spec-diagram-fit-content");
  });

  it("shows the inferred end actor and an explicit override control", () => {
    const graph = structuredClone(spec);
    const flow = graph.flows[0];
    flow.steps.push({ id: "finish", kind: "end" });
    flow.edges = [{ from: flow.steps[flow.steps.length - 2].id, to: "finish" }];
    const html = renderToStaticMarkup(
      <StageContent
        stage="flows"
        spec={graph}
        update={() => {}}
        selectedId={flow.id}
        select={() => {}}
        domainSection="entities"
        selectDomainSection={() => {}}
        valid
      />,
    );
    expect(html).toContain("終了担当");
    expect(html).toContain("自動（最後の担当レーン）");
    expect(html).toContain("自動: アクター: 依頼者");
  });

  it.each([
    ["domain", "タスク"],
    ["flows", "作業の受付と登録"],
    ["useCases", "条件による分岐・例外"],
    ["screens", "画面の部品"],
    ["actions", "操作とその結果"],
  ] as const)("renders the %s stage", (stage, expected) => {
    const html = renderToStaticMarkup(
      <StageContent
        stage={stage}
        spec={spec}
        update={() => {}}
        selectedId=""
        select={() => {}}
        domainSection="entities"
        selectDomainSection={() => {}}
        valid={false}
      />,
    );
    expect(html).toContain(expected);
  });
});
