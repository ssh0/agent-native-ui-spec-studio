import {
  applyAutoLayout,
  Bpmn,
  createFlowElement,
  type BpmnDefinitions,
  type BpmnFlowElement,
  type BpmnLane,
  type BpmnSequenceFlow,
} from "@bpmnkit/core";

import {
  flowNodePerformer,
  isFlowStep,
  type FlowEdge,
  type FlowNode,
  type UiSpec,
} from "./spec-schema.js";
import { flowPerformerKey, performerTitle } from "./spec-utils.js";

type BusinessFlow = UiSpec["flows"][number];

// UiSpec IDs can contain any nonempty text, including XML-unsafe characters.
// Encoding UTF-16 code units is injective even for arbitrary JavaScript strings;
// the prefixes and scope keep every BPMN id unique without depending on array order.
function token(value: string): string {
  let result = "";
  for (let i = 0; i < value.length; i++)
    result += value.charCodeAt(i).toString(16).padStart(4, "0");
  return result;
}

export function flowNodeBpmnId(flowId: string, id: string): string {
  return `Node_${token(flowId)}_${token(id)}`;
}
const nodeId = flowNodeBpmnId;

export function flowEdgeBpmnId(flowId: string, edge: FlowEdge): string {
  // 2.1 uses the saved edge ID. In 2.0 (and for implicit linear edges),
  // endpoint + label is unique by the UiSpec relation validator.
  const key =
    edge.id !== undefined
      ? `id:${edge.id}`
      : `endpoints:${JSON.stringify([edge.from, edge.to, edge.label ?? null])}`;
  return `Sequence_${token(flowId)}_${token(key)}`;
}
const sequenceId = flowEdgeBpmnId;

function documentation(...parts: (string | undefined)[]): string | undefined {
  return (
    parts.filter((part): part is string => Boolean(part)).join("\n") ||
    undefined
  );
}

function bpmnNode(flowId: string, node: FlowNode): BpmnFlowElement {
  const id = nodeId(flowId, node.id);
  if (isFlowStep(node))
    return createFlowElement(
      id,
      node.performer.kind === "actors" ? "userTask" : "serviceTask",
      {
        name: node.title,
        documentation: documentation(
          node.notes,
          node.useCase && `useCase: ${node.useCase}`,
        ),
      },
    );
  if (node.kind === "branch")
    return createFlowElement(id, "exclusiveGateway", {
      name: node.title,
      documentation: node.notes,
    });
  return createFlowElement(
    id,
    node.kind === "start" ? "startEvent" : "endEvent",
    {
      name: node.kind === "start" ? "開始" : "終了",
      documentation: node.notes,
    },
  );
}

/** A read-only projection of a validated UiSpec flow; never changes the project spec. */
export function flowToBpmnDefinitions(
  spec: UiSpec,
  flow: BusinessFlow,
): BpmnDefinitions {
  const scope = token(flow.id);
  const processId = `Process_${scope}`;
  const participantId = `Participant_${scope}`;
  const collaborationId = `Collaboration_${scope}`;
  const elements = flow.steps.map((node) => bpmnNode(flow.id, node));
  // An omitted edges array means the legacy linear format; an explicit [] is
  // intentionally disconnected, even when all nodes are ordinary steps.
  const edges: FlowEdge[] =
    flow.edges ??
    flow.steps.slice(1).map((node, index) => ({
      from: flow.steps[index].id,
      to: node.id,
    }));
  const sequenceFlows: BpmnSequenceFlow[] = edges.map((edge) => {
    const id = sequenceId(flow.id, edge);
    const source = elements.find(
      (node) => node.id === nodeId(flow.id, edge.from),
    )!;
    const target = elements.find(
      (node) => node.id === nodeId(flow.id, edge.to),
    )!;
    source.outgoing.push(id);
    target.incoming.push(id);
    return {
      id,
      name: edge.label,
      sourceRef: source.id,
      targetRef: target.id,
      documentation: edge.notes,
      extensionElements: [],
      unknownAttributes: {},
    };
  });

  const lanes: BpmnLane[] = [];
  const byPerformer = new Map<string, BpmnLane>();
  const controls: string[] = [];
  for (const node of flow.steps) {
    const performer = flowNodePerformer(node);
    const id = nodeId(flow.id, node.id);
    if (!performer) {
      controls.push(id);
      continue;
    }
    const key = flowPerformerKey(performer); // order-independent actor sets
    let lane = byPerformer.get(key);
    if (!lane) {
      lane = {
        id: `Lane_${scope}_${token(key)}`,
        name: performerTitle(spec, performer),
        flowNodeRefs: [],
        extensionElements: [],
        unknownAttributes: {},
      };
      byPerformer.set(key, lane);
      lanes.push(lane);
    }
    lane.flowNodeRefs.push(id);
  }
  // Explicitly keep events/unassigned decisions in a control lane rather than
  // letting layout attribute them to an actor or place them outside the pool.
  if (controls.length && lanes.length)
    lanes.unshift({
      id: `Lane_${scope}_control`,
      name: "フロー制御",
      flowNodeRefs: controls,
      extensionElements: [],
      unknownAttributes: {},
    });

  const definitions: BpmnDefinitions = {
    id: `Definitions_${scope}`,
    targetNamespace: "http://bpmn.io/schema/bpmn",
    namespaces: {
      bpmn: "http://www.omg.org/spec/BPMN/20100524/MODEL",
      bpmndi: "http://www.omg.org/spec/BPMN/20100524/DI",
      dc: "http://www.omg.org/spec/DD/20100524/DC",
      di: "http://www.omg.org/spec/DD/20100524/DI",
    },
    unknownAttributes: {},
    errors: [],
    escalations: [],
    messages: [],
    signals: [],
    collaborations: [
      {
        id: collaborationId,
        participants: [
          {
            id: participantId,
            name: flow.title,
            processRef: processId,
            extensionElements: [],
            unknownAttributes: {},
          },
        ],
        messageFlows: [],
        textAnnotations: [],
        associations: [],
        groups: [],
        extensionElements: [],
        unknownAttributes: {},
      },
    ],
    processes: [
      {
        id: processId,
        name: flow.title,
        isExecutable: false,
        documentation: documentation(flow.goal, flow.notes),
        extensionElements: [],
        flowElements: elements,
        sequenceFlows,
        textAnnotations: [],
        associations: [],
        groups: [],
        ...(lanes.length ? { laneSet: { id: `LaneSet_${scope}`, lanes } } : {}),
        unknownAttributes: {},
      },
    ],
    diagrams: [
      {
        id: `Diagram_${scope}`,
        plane: {
          id: `Plane_${scope}`,
          bpmnElement: collaborationId,
          shapes: [],
          edges: [],
        },
      },
    ],
  };
  return applyAutoLayout(definitions);
}

/** BPMN XML for viewing/export only; UiSpec YAML remains the canonical document. */
export function flowToBpmnXml(
  spec: UiSpec,
  flow: UiSpec["flows"][number],
): string {
  return Bpmn.export(flowToBpmnDefinitions(spec, flow));
}
