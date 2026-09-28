import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DEFAULT_SPEC_YAML } from "../../../shared/default-spec";
import { parseSpecYaml } from "../../../shared/spec-utils";
import { StageContent } from "./stage-content";

const spec = parseSpecYaml(DEFAULT_SPEC_YAML).spec!;

describe("specification stage composition", () => {
  it("routes forward skip connections below the nodes", () => {
    const graph = structuredClone(spec);
    const flow = graph.flows[0];
    const performer = {
      kind: "actors" as const,
      refs: [{ kind: "actor" as const, id: "member" }],
    };
    flow.steps = [
      { id: "start", kind: "start" },
      { id: "decision", kind: "branch", title: "どちらへ進むか" },
      { id: "left", title: "左の経路", performer },
      { id: "right", title: "右の経路", performer },
      { id: "merge", title: "合流する", performer },
      { id: "end", kind: "end" },
    ];
    flow.edges = [
      { from: "start", to: "decision" },
      { from: "decision", to: "left", label: "左" },
      { from: "decision", to: "right", label: "右" },
      { from: "left", to: "merge" },
      { from: "right", to: "merge" },
      { from: "merge", to: "end" },
    ];
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
    const connectorPaths = Array.from(
      html.matchAll(/class="spec-business-flow-connector" d="([^"]+)"/g),
      ([, path]) => path,
    );
    expect(connectorPaths).toContainEqual(
      expect.stringMatching(/^M 748 \d+ V \d+ H 1046 V \d+ H 1064$/),
    );
  });

  it("renders graph control nodes, labeled loops, and action numbering", () => {
    const graph = structuredClone(spec);
    const flow = graph.flows[0];
    const performer = {
      kind: "actors" as const,
      refs: [{ kind: "actor" as const, id: "member" }],
    };
    flow.steps = [
      { id: "start", kind: "start" },
      { id: "submit", title: "申請を提出する", performer },
      { id: "decision", kind: "branch", title: "承認するか" },
      { id: "revise", title: "申請を修正する", performer },
      { id: "end", kind: "end" },
    ];
    flow.edges = [
      { from: "start", to: "submit" },
      { from: "submit", to: "decision" },
      { from: "decision", to: "revise", label: "差し戻し" },
      { from: "decision", to: "end", label: "承認" },
      { from: "revise", to: "submit" },
    ];
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

    expect(html).toContain('aria-label="分岐: 承認するか"');
    const diamond = html.match(
      /class="spec-business-flow-branch"[^>]*>.*?<path d="M ([\d.]+) ([\d.]+) L ([\d.]+) ([\d.]+) L ([\d.]+) ([\d.]+) L ([\d.]+) ([\d.]+) Z"/,
    );
    expect(diamond).not.toBeNull();
    const [, topX, topY, rightX, rightY, bottomX, bottomY, leftX, leftY] =
      diamond!.map(Number);
    expect(Number(topX)).toBe(Number(bottomX));
    expect(Number(rightY)).toBe(Number(leftY));
    expect(Number(rightX) - Number(leftX)).toBe(Number(bottomY) - Number(topY));
    expect(Number(leftX)).toBeLessThan(Number(topX));
    expect(html).toContain("ノード: 分岐: 承認するか");
    expect(html).toContain("差し戻し");
    expect(html).toContain("承認");
    expect(html).toContain("申請を修正する → 申請を提出する");
    expect(html).toContain('class="spec-step-number">1</span>');
    expect(html).toContain('class="spec-step-number">2</span>');
    expect(html.match(/class="spec-business-flow-connector"/g)).toHaveLength(5);
    expect(html).toContain('aria-label="担当レーン: フロー制御');
  });

  it("places assigned decisions in the actor lane and keeps unassigned branches in control", () => {
    const graph = structuredClone(spec);
    const flow = graph.flows[0];
    flow.steps = [
      { id: "start", kind: "start" },
      { id: "decision", kind: "branch", title: "判定する" },
      { id: "end", kind: "end" },
    ];
    flow.edges = [];
    const render = () =>
      renderToStaticMarkup(
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
    const branchTop = (html: string) =>
      Number(
        html.match(
          /class="spec-business-flow-branch"[^>]*>.*?<path d="M [\d.]+ ([\d.]+) L/,
        )?.[1],
      );
    const legacy = render();
    expect(legacy).toContain('aria-label="担当レーン: フロー制御"');
    expect(legacy).toContain(
      '<option value="" selected="">指定なし（制御レーン）</option>',
    );
    const legacyTop = branchTop(legacy);

    flow.steps[1] = {
      id: "decision",
      kind: "branch",
      title: "判定する",
      performer: { kind: "actors", refs: [{ kind: "actor", id: "member" }] },
    };
    const assigned = render();
    expect(assigned).toContain(
      'aria-label="担当レーン: フロー制御、アクター: チームメンバー',
    );
    expect(assigned).toContain(
      '<option value="actors" selected="">アクター</option>',
    );
    expect(assigned).toContain('class="spec-step-number">分岐</span>');
    expect(assigned).toContain('aria-label="分岐: 判定する"');
    expect(branchTop(assigned)).toBeGreaterThan(legacyTop);
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
