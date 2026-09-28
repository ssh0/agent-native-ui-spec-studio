import { Bpmn } from "@bpmnkit/core";
import { describe, expect, it } from "vitest";

import {
  flowEdgeBpmnId,
  flowNodeBpmnId,
  flowToBpmnDefinitions,
  flowToBpmnXml,
} from "./bpmn-flow";
import { DEFAULT_SPEC_YAML } from "./default-spec";
import { parseSpecYaml } from "./spec-utils";

const spec = parseSpecYaml(DEFAULT_SPEC_YAML).spec!;

describe("BPMN projection of canonical YAML", () => {
  it("round-trips a legacy linear process and assigns actor/system lanes", () => {
    const xml = flowToBpmnXml(spec, spec.flows[0]);
    const [process] = Bpmn.parse(xml).processes;
    expect(process.flowElements).toHaveLength(spec.flows[0].steps.length + 1);
    expect(
      process.flowElements.filter((node) => node.type === "startEvent"),
    ).toHaveLength(1);
    expect(process.sequenceFlows).toHaveLength(spec.flows[0].steps.length);
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
    expect(
      after.flowElements
        .filter((node) => node.id.startsWith("Node_"))
        .map((node) => node.id),
    ).toEqual(
      before.flowElements
        .filter((node) => node.id.startsWith("Node_"))
        .map((node) => node.id)
        .reverse(),
    );
    expect(
      after.flowElements
        .filter((node) => node.id.startsWith("Entry_"))
        .map((node) => node.id)
        .sort(),
    ).toEqual(
      before.flowElements
        .filter((node) => node.id.startsWith("Entry_"))
        .map((node) => node.id)
        .sort(),
    );
    expect(after.sequenceFlows[0].id).toBe(before.sequenceFlows[0].id);
  });

  it("stacks lane rails inside the participant even when BPMN Kit lays control events above y=0", () => {
    const draft = structuredClone(spec);
    const flow = draft.flows[0];
    flow.steps = [
      { id: "start", kind: "start" },
      {
        id: "request",
        title: "依頼",
        performer: {
          kind: "actors",
          refs: [{ kind: "actor", id: "requester" }],
        },
      },
      {
        id: "review",
        title: "確認",
        performer: { kind: "actors", refs: [{ kind: "actor", id: "member" }] },
      },
      { id: "end", kind: "end" },
    ];
    flow.edges = [
      { from: "start", to: "request" },
      { from: "request", to: "review" },
      { from: "review", to: "end" },
    ];
    const defs = flowToBpmnDefinitions(draft, flow);
    const plane = defs.diagrams[0].plane;
    const pool = plane.shapes.find((shape) =>
      shape.bpmnElement.startsWith("Participant_"),
    )!;
    const lanes = plane.shapes
      .filter((shape) => shape.bpmnElement.startsWith("Lane_"))
      .sort((a, b) => a.bounds.y - b.bounds.y);
    expect(lanes.length).toBeGreaterThan(1);
    expect(pool.bounds.y).toBe(lanes[0].bounds.y);
    expect(pool.bounds.height).toBe(
      lanes.reduce((sum, lane) => sum + lane.bounds.height, 0),
    );
    for (const lane of lanes) {
      expect(lane.bounds.x).toBe(lanes[0].bounds.x);
      expect(lane.bounds.width).toBe(lanes[0].bounds.width);
      expect(lane.bounds.y).toBeGreaterThanOrEqual(pool.bounds.y);
      expect(lane.bounds.y + lane.bounds.height).toBeLessThanOrEqual(
        pool.bounds.y + pool.bounds.height,
      );
    }
    for (let i = 1; i < lanes.length; i++)
      expect(lanes[i].bounds.y).toBe(
        lanes[i - 1].bounds.y + lanes[i - 1].bounds.height,
      );
  });

  it("adds a labeled entry event to the actual first decision lane without changing YAML", () => {
    const draft = structuredClone(spec);
    const flow = draft.flows[0];
    flow.steps = [
      {
        id: "decision",
        kind: "branch",
        title: "貸し出すか",
        performer: { kind: "actors", refs: [{ kind: "actor", id: "member" }] },
      },
      { id: "finish", kind: "end" },
    ];
    flow.edges = [{ from: "decision", to: "finish", label: "はい" }];
    const original = structuredClone(flow);
    const defs = flowToBpmnDefinitions(draft, flow);
    const process = defs.processes[0];
    const entry = process.flowElements.find(
      (node) => node.type === "startEvent",
    )!;
    expect(entry.name).toBe("開始");
    expect(
      process.sequenceFlows.some(
        (edge) =>
          edge.sourceRef === entry.id &&
          edge.targetRef === flowNodeBpmnId(flow.id, "decision"),
      ),
    ).toBe(true);
    const shapes = defs.diagrams[0].plane.shapes;
    const entryShape = shapes.find((shape) => shape.bpmnElement === entry.id)!;
    const decisionShape = shapes.find(
      (shape) => shape.bpmnElement === flowNodeBpmnId(flow.id, "decision"),
    )!;
    expect(entryShape.bounds.x).toBeLessThan(decisionShape.bounds.x);
    expect(
      process.laneSet?.lanes.find((lane) =>
        lane.name?.includes("チームメンバー"),
      )?.flowNodeRefs,
    ).toContain(entry.id);
    expect(flow).toEqual(original);
  });

  it("places the end event in the last reachable human actor lane, not the control lane", () => {
    const draft = structuredClone(spec);
    const flow = draft.flows[0];
    flow.steps = [
      {
        id: "submit",
        title: "依頼",
        performer: {
          kind: "actors",
          refs: [{ kind: "actor", id: "requester" }],
        },
      },
      {
        id: "review",
        title: "審査",
        performer: { kind: "actors", refs: [{ kind: "actor", id: "member" }] },
      },
      {
        id: "notify",
        title: "通知",
        performer: { kind: "externalSystem", id: "notification" },
      },
      { id: "finish", kind: "end" },
    ];
    flow.edges = [
      { from: "submit", to: "review" },
      { from: "review", to: "notify" },
      { from: "notify", to: "finish" },
    ];
    const original = structuredClone(flow);
    const process = flowToBpmnDefinitions(draft, flow).processes[0];
    const endId = flowNodeBpmnId(flow.id, "finish");
    expect(
      process.laneSet?.lanes.find((lane) =>
        lane.name?.includes("チームメンバー"),
      )?.flowNodeRefs,
    ).toContain(endId);
    expect(
      process.laneSet?.lanes.find((lane) => lane.name?.includes("通知サービス"))
        ?.flowNodeRefs,
    ).not.toContain(endId);
    expect(flow).toEqual(original);

    flow.steps[3] = {
      id: "finish",
      kind: "end",
      performer: { kind: "actors", refs: [{ kind: "actor", id: "requester" }] },
    };
    const overridden = flowToBpmnDefinitions(draft, flow).processes[0];
    expect(
      overridden.laneSet?.lanes.find((lane) => lane.name?.includes("依頼者"))
        ?.flowNodeRefs,
    ).toContain(endId);
  });

  it("uses the last reachable actor in step order when several paths merge", () => {
    const draft = structuredClone(spec);
    const flow = draft.flows[0];
    flow.steps = [
      { id: "choice", kind: "branch", title: "どちらか" },
      {
        id: "first",
        title: "申請者の作業",
        performer: {
          kind: "actors",
          refs: [{ kind: "actor", id: "requester" }],
        },
      },
      {
        id: "second",
        title: "管理者の作業",
        performer: { kind: "actors", refs: [{ kind: "actor", id: "member" }] },
      },
      { id: "finish", kind: "end" },
    ];
    flow.edges = [
      { from: "choice", to: "first", label: "A" },
      { from: "choice", to: "second", label: "B" },
      { from: "first", to: "finish" },
      { from: "second", to: "finish" },
    ];
    const endId = flowNodeBpmnId(flow.id, "finish");
    const lane = flowToBpmnDefinitions(
      draft,
      flow,
    ).processes[0].laneSet?.lanes.find((item) =>
      item.flowNodeRefs.includes(endId),
    );
    expect(lane?.name).toContain("チームメンバー");
  });

  it("does not assign an end event to an unrelated actor or external system", () => {
    const draft = structuredClone(spec);
    const flow = draft.flows[0];
    flow.steps = [
      {
        id: "unrelated",
        title: "別件",
        performer: { kind: "actors", refs: [{ kind: "actor", id: "member" }] },
      },
      {
        id: "notify",
        title: "通知",
        performer: { kind: "externalSystem", id: "notification" },
      },
      { id: "finish", kind: "end" },
    ];
    flow.edges = [{ from: "notify", to: "finish" }];
    const process = flowToBpmnDefinitions(draft, flow).processes[0];
    expect(
      process.laneSet?.lanes.find((lane) => lane.name === "フロー制御")
        ?.flowNodeRefs,
    ).toContain(flowNodeBpmnId(flow.id, "finish"));
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
