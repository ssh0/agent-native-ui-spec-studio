import { Bpmn } from "@bpmnkit/core";
import { describe, expect, it } from "vitest";

import { flowEdgeBpmnId, flowNodeBpmnId, flowToBpmnXml } from "./bpmn-flow";
import { DEFAULT_SPEC_YAML } from "./default-spec";
import { parseSpecYaml } from "./spec-utils";

const spec = parseSpecYaml(DEFAULT_SPEC_YAML).spec!;

describe("BPMN projection of canonical YAML", () => {
  it("round-trips a legacy linear process and assigns actor/system lanes", () => {
    const xml = flowToBpmnXml(spec, spec.flows[0]);
    const [process] = Bpmn.parse(xml).processes;
    expect(process.flowElements).toHaveLength(spec.flows[0].steps.length);
    expect(process.sequenceFlows).toHaveLength(spec.flows[0].steps.length - 1);
    expect(process.laneSet?.lanes.map((lane) => lane.name)).toEqual([
      expect.stringContaining("依頼者"),
      expect.stringContaining("チームメンバー"),
      expect.stringContaining("通知サービス"),
    ]);
    expect(Bpmn.parse(xml).diagrams[0].plane.shapes.length).toBeGreaterThan(0);
    expect(flowToBpmnXml(spec, spec.flows[0])).toBe(xml);
  });

  it("keeps BPMN node and edge IDs stable across title and ordering changes", () => {
    const draft = structuredClone(spec);
    const flow = draft.flows[0];
    flow.edges = [{ id: "stable-edge", from: "request", to: "discover" }];
    const before = Bpmn.parse(flowToBpmnXml(draft, flow)).processes[0];
    flow.steps.reverse();
    flow.steps = flow.steps.map((node) =>
      node.id === "request" && "title" in node
        ? { ...node, title: "変更後" }
        : node,
    );
    const after = Bpmn.parse(flowToBpmnXml(draft, flow)).processes[0];
    expect(after.flowElements.map((node) => node.id)).toEqual(
      before.flowElements.map((node) => node.id).reverse(),
    );
    expect(after.sequenceFlows[0].id).toBe(before.sequenceFlows[0].id);
  });

  it("represents unfinished empty flows without inventing tasks", () => {
    const draft = structuredClone(spec);
    draft.flows[0].steps = [];
    const process = Bpmn.parse(flowToBpmnXml(draft, draft.flows[0]))
      .processes[0];
    expect(process.flowElements).toEqual([]);
    expect(process.sequenceFlows).toEqual([]);
  });

  it("retains labeled branches, loops and branch ownership without altering the YAML", () => {
    const sample = structuredClone(spec);
    const flow = sample.flows[0];
    flow.steps = [
      { id: "start", kind: "start" },
      {
        id: "choose",
        kind: "branch",
        title: "判断",
        performer: { kind: "actors", refs: [{ kind: "actor", id: "member" }] },
      },
      {
        id: "work",
        title: "実施",
        performer: { kind: "actors", refs: [{ kind: "actor", id: "member" }] },
      },
      { id: "end", kind: "end" },
    ];
    flow.edges = [
      { from: "start", to: "choose" },
      { from: "choose", to: "work", label: "再試行" },
      { from: "choose", to: "end", label: "完了" },
      { from: "work", to: "choose" },
    ];
    const before = structuredClone(flow);
    const parsed = Bpmn.parse(flowToBpmnXml(sample, flow));
    const process = parsed.processes[0];
    expect(
      process.flowElements.find((node) => node.name === "判断")?.type,
    ).toBe("exclusiveGateway");
    expect(
      process.laneSet?.lanes.find((lane) =>
        lane.name?.includes("チームメンバー"),
      )?.flowNodeRefs,
    ).toContain(process.flowElements.find((node) => node.name === "判断")?.id);
    expect(
      process.sequenceFlows.map((edge) => edge.name).filter(Boolean),
    ).toEqual(["再試行", "完了"]);
    expect(process.flowElements.find((node) => node.name === "判断")?.id).toBe(
      flowNodeBpmnId(flow.id, "choose"),
    );
    expect(process.sequenceFlows[1]?.id).toBe(
      flowEdgeBpmnId(flow.id, flow.edges[1]),
    );
    expect(
      process.sequenceFlows[process.sequenceFlows.length - 1]?.targetRef,
    ).toBe(process.flowElements.find((node) => node.name === "判断")?.id);
    expect(flow).toEqual(before);
  });
});
