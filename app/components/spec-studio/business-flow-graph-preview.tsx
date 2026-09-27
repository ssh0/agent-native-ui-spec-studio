import type { FlowEdge, FlowNode, UiSpec } from "@shared/spec-schema";
import { isFlowStep } from "@shared/spec-schema";
import {
  formatReferenceLabel,
  groupFlowStepsByPerformer,
  performerTitle,
  resolveNamedReference,
} from "@shared/spec-utils";
import { useId } from "react";

type Flow = UiSpec["flows"][number];
type Lane = {
  key: string;
  label: string;
  labelLines: string[];
  indexes: number[];
  top: number;
  height: number;
};
type PositionedNode = {
  node: FlowNode;
  order: number;
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  titleLines: string[];
  useCaseLines: string[];
  actionNumber?: number;
};

type NodeMeasure = Omit<PositionedNode, "y" | "centerX" | "centerY">;

const LANE_LABEL_WIDTH = 204;
const NODE_START_X = 24;
const NODE_WIDTH = 204;
const NODE_PITCH = 260;
const CONTROL_WIDTH = 148;
const TERMINAL_WIDTH = 120;
const LANE_GAP = 10;
const TOP_PADDING = 12;
const BOTTOM_PADDING = 16;
const ACTION_TEXT_LIMIT = 19;
const CONTROL_TEXT_LIMIT = 14;
const LANE_TEXT_LIMIT = 16;
const TITLE_LINE_HEIGHT = 15;
const USE_CASE_LINE_HEIGHT = 12;
const CARD_PADDING = 12;
const LOOP_GAP = 24;

function wrapText(value: string, maxCharacters: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of value.split(/\s+/).filter(Boolean)) {
    const characters = Array.from(word);
    if (characters.length > maxCharacters) {
      if (line) lines.push(line);
      line = "";
      for (let offset = 0; offset < characters.length; offset += maxCharacters)
        lines.push(characters.slice(offset, offset + maxCharacters).join(""));
      continue;
    }
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length <= maxCharacters) {
      line = candidate;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length > 0 ? lines : [""];
}

function useCaseLabel(
  spec: UiSpec,
  node: Extract<FlowNode, { performer: unknown }>,
) {
  if (!node.useCase) return;
  return `UC: ${formatReferenceLabel(
    resolveNamedReference(spec.useCases, node.useCase),
    spec.useCases.map((item) => item.id),
  )}`;
}

function flowNodeLabel(node: FlowNode): string {
  if (isFlowStep(node)) return node.title;
  if (node.kind === "branch") return `分岐: ${node.title}`;
  return node.kind === "start" ? "開始" : "終了";
}

function measureNodes(spec: UiSpec, flow: Flow): NodeMeasure[] {
  let actionNumber = 0;
  return flow.steps.map((node, order) => {
    let width: number;
    let titleLines: string[];
    let useCaseLines: string[] = [];
    let height: number;
    let currentActionNumber: number | undefined;
    if (isFlowStep(node)) {
      actionNumber += 1;
      currentActionNumber = actionNumber;
      titleLines = wrapText(
        `${actionNumber}. ${node.title}`,
        ACTION_TEXT_LIMIT,
      );
      const linkedUseCase = useCaseLabel(spec, node);
      useCaseLines = linkedUseCase
        ? wrapText(linkedUseCase, ACTION_TEXT_LIMIT)
        : [];
      width = NODE_WIDTH;
      const textHeight =
        titleLines.length * TITLE_LINE_HEIGHT +
        (useCaseLines.length
          ? 4 + useCaseLines.length * USE_CASE_LINE_HEIGHT
          : 0);
      height = Math.max(60, textHeight + CARD_PADDING * 2);
    } else if (node.kind === "branch") {
      titleLines = wrapText(node.title, CONTROL_TEXT_LIMIT);
      width = CONTROL_WIDTH;
      height = Math.max(78, titleLines.length * TITLE_LINE_HEIGHT + 28);
    } else {
      titleLines = [node.kind === "start" ? "開始" : "終了"];
      width = TERMINAL_WIDTH;
      height = 52;
    }
    return {
      node,
      order,
      x: NODE_START_X + order * NODE_PITCH,
      width,
      height,
      titleLines,
      useCaseLines,
      actionNumber: currentActionNumber,
    };
  });
}

function buildLanes(
  spec: UiSpec,
  flow: Flow,
  measures: NodeMeasure[],
): {
  lanes: Lane[];
  nodes: PositionedNode[];
  chartHeight: number;
  routeBaseY: number;
} {
  const rowDefinitions: Omit<Lane, "top" | "height" | "labelLines">[] = [];
  const controlIndexes = flow.steps.flatMap((node, index) =>
    isFlowStep(node) ? [] : [index],
  );
  if (controlIndexes.length)
    rowDefinitions.push({
      key: "control",
      label: "フロー制御",
      indexes: controlIndexes,
    });

  for (const lane of groupFlowStepsByPerformer(flow.steps)) {
    const indexes = lane.steps.map(({ index }) => index);
    rowDefinitions.push({
      key: JSON.stringify(["performer", lane.performer]),
      label: performerTitle(spec, lane.performer),
      indexes,
    });
  }

  let nextTop = TOP_PADDING;
  const lanes: Lane[] = rowDefinitions.map((row) => {
    const labelLines = wrapText(row.label, LANE_TEXT_LIMIT);
    const height = Math.max(
      88,
      ...row.indexes.map((index) => measures[index].height + 16),
      labelLines.length * 16 + 24,
    );
    const lane = { ...row, labelLines, top: nextTop, height };
    nextTop += height + LANE_GAP;
    return lane;
  });
  const laneByNodeIndex = new Map<number, Lane>();
  lanes.forEach((lane) =>
    lane.indexes.forEach((index) => laneByNodeIndex.set(index, lane)),
  );
  const nodes = measures.map((measure) => {
    const lane = laneByNodeIndex.get(measure.order)!;
    const y = lane.top + (lane.height - measure.height) / 2;
    return {
      ...measure,
      y,
      centerX: measure.x + measure.width / 2,
      centerY: y + measure.height / 2,
    };
  });
  const lastLane = lanes[lanes.length - 1];
  const baseHeight = lastLane
    ? lastLane.top + lastLane.height + BOTTOM_PADDING
    : TOP_PADDING + BOTTOM_PADDING;
  const routedEdgeCount =
    flow.edges?.filter((edge) => {
      const source = nodes.find((node) => node.node.id === edge.from);
      const target = nodes.find((node) => node.node.id === edge.to);
      return (
        source &&
        target &&
        (target.order <= source.order || target.order > source.order + 1)
      );
    }).length ?? 0;
  return {
    lanes,
    nodes,
    chartHeight: baseHeight + routedEdgeCount * LOOP_GAP,
    routeBaseY: baseHeight - BOTTOM_PADDING + 8,
  };
}

function edgePath(
  edge: FlowEdge,
  source: PositionedNode,
  target: PositionedNode,
  edgeIndex: number,
  outgoing: FlowEdge[],
  routeIndex: number,
  routeBaseY: number,
): { path: string; label?: { x: number; y: number } } {
  const isBackward = target.order <= source.order;
  const isForwardJump = target.order > source.order + 1;
  if (isBackward || isForwardJump) {
    const startX = isBackward ? source.centerX : source.x + source.width;
    const startY = isBackward ? source.y + source.height : source.centerY;
    const targetApproachX = target.x - 18;
    const routeY = routeBaseY + routeIndex * LOOP_GAP;
    return {
      path: `M ${startX} ${startY} V ${routeY} H ${targetApproachX} V ${target.centerY} H ${isBackward ? target.x - 2 : target.x}`,
      label: edge.label
        ? {
            x: (startX + targetApproachX) / 2,
            y: routeY - 5,
          }
        : undefined,
    };
  }

  const sourceX = source.x + source.width;
  const targetX = target.x;
  const middleX = (sourceX + targetX) / 2;
  const approachX = targetX - 18;
  const isBranch = source.node.kind === "branch";
  const branchOffset = isBranch
    ? (edgeIndex - (outgoing.length - 1) / 2) * 18
    : 0;
  const trackY = source.centerY + branchOffset;
  const path =
    trackY === source.centerY && source.centerY === target.centerY
      ? `M ${sourceX} ${source.centerY} H ${targetX}`
      : `M ${sourceX} ${source.centerY} H ${middleX} V ${trackY} H ${approachX} V ${target.centerY} H ${targetX}`;
  return {
    path,
    label: edge.label ? { x: middleX, y: trackY - 7 } : undefined,
  };
}

export function BusinessFlowGraphPreview({
  spec,
  flow,
  zoom,
}: {
  spec: UiSpec;
  flow: Flow;
  zoom: number;
}) {
  const instance = useId().replace(/[^a-zA-Z0-9]/g, "");
  const arrowId = `business-flow-graph-arrow-${instance}`;
  const descriptionId = `${arrowId}-connections`;
  const measures = measureNodes(spec, flow);
  const { lanes, nodes, chartHeight, routeBaseY } = buildLanes(
    spec,
    flow,
    measures,
  );
  const chartWidth =
    NODE_START_X +
    Math.max(0, flow.steps.length - 1) * NODE_PITCH +
    Math.max(NODE_WIDTH, CONTROL_WIDTH) +
    24;
  const nodesById = new Map(nodes.map((node) => [node.node.id, node]));
  const edges = flow.edges ?? [];
  const outgoingByNode = new Map<string, FlowEdge[]>();
  edges.forEach((edge) =>
    outgoingByNode.set(edge.from, [
      ...(outgoingByNode.get(edge.from) ?? []),
      edge,
    ]),
  );
  let routeIndex = 0;

  if (flow.steps.length === 0)
    return (
      <div className="spec-flow-render spec-flow-empty" role="region">
        この業務フローにはノードがありません。
      </div>
    );

  return (
    <div
      className="spec-flow-render spec-business-flow-render"
      role="region"
      aria-label={`${flow.title} 業務フロー図`}
      tabIndex={0}
    >
      <div className="spec-business-flow-canvas">
        <div
          className="spec-business-flow-chart-scroll"
          role="region"
          aria-label={`${flow.title}の手順。横スクロールできます。`}
          tabIndex={0}
        >
          <svg
            className="spec-business-flow-svg"
            width={Math.round(chartWidth * zoom)}
            height={Math.round(chartHeight * zoom)}
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            role="img"
            aria-label={`${flow.title} 業務フロー図`}
            aria-describedby={descriptionId}
          >
            <title>{flow.title}</title>
            <defs>
              <marker
                id={arrowId}
                markerWidth="8"
                markerHeight="8"
                refX="7"
                refY="4"
                viewBox="0 0 8 8"
                orient="auto"
                markerUnits="userSpaceOnUse"
              >
                <path
                  d="M 0 0 L 8 4 L 0 8 z"
                  className="spec-business-flow-arrow"
                />
              </marker>
            </defs>
            {lanes.map((lane) => (
              <rect
                className="spec-business-flow-lane"
                key={lane.key}
                x="0"
                y={lane.top}
                width={chartWidth}
                height={lane.height}
                rx="8"
              />
            ))}
            {edges.map((edge, index) => {
              const source = nodesById.get(edge.from);
              const target = nodesById.get(edge.to);
              if (!source || !target) return null;
              const needsOuterRoute =
                target.order <= source.order ||
                target.order > source.order + 1;
              const path = edgePath(
                edge,
                source,
                target,
                (outgoingByNode.get(edge.from) ?? []).indexOf(edge),
                outgoingByNode.get(edge.from) ?? [],
                needsOuterRoute ? routeIndex++ : -1,
                routeBaseY,
              );
              return (
                <g key={edge.id ?? `${edge.from}-${edge.to}-${index}`}>
                  <path
                    className="spec-business-flow-connector"
                    d={path.path}
                    markerEnd={`url(#${arrowId})`}
                  />
                  {edge.label && path.label && (
                    <text
                      className="spec-business-flow-edge-label"
                      textAnchor="middle"
                      x={path.label.x}
                      y={path.label.y}
                    >
                      {edge.label}
                    </text>
                  )}
                </g>
              );
            })}
            {nodes.map((positioned) => {
              const {
                node,
                x,
                y,
                width,
                height,
                centerX,
                centerY,
                titleLines,
              } = positioned;
              if (!isFlowStep(node)) {
                if (node.kind === "branch") {
                  const left = x + width / 2;
                  const centerTextHeight =
                    titleLines.length * TITLE_LINE_HEIGHT;
                  const baseline = centerY - centerTextHeight / 2 + 11;
                  return (
                    <g
                      className="spec-business-flow-branch"
                      key={node.id}
                      role="group"
                      aria-label={`分岐: ${node.title}`}
                    >
                      <title>{node.title}</title>
                      <path
                        d={`M ${centerX} ${y} L ${x + width} ${centerY} L ${centerX} ${y + height} L ${left} ${centerY} Z`}
                      />
                      <text
                        className="spec-business-flow-branch-title"
                        textAnchor="middle"
                      >
                        {titleLines.map((line, index) => (
                          <tspan
                            key={index}
                            x={centerX}
                            y={baseline + index * TITLE_LINE_HEIGHT}
                          >
                            {line}
                          </tspan>
                        ))}
                      </text>
                    </g>
                  );
                }
                const label = node.kind === "start" ? "開始" : "終了";
                return (
                  <g
                    className="spec-business-flow-terminal"
                    key={node.id}
                    role="group"
                    aria-label={label}
                  >
                    <title>{label}</title>
                    <rect
                      x={x}
                      y={y}
                      width={width}
                      height={height}
                      rx={height / 2}
                    />
                    <text
                      className="spec-business-flow-terminal-label"
                      textAnchor="middle"
                      x={centerX}
                      y={centerY + 4}
                    >
                      {label}
                    </text>
                  </g>
                );
              }
              const linkedUseCase = useCaseLabel(spec, node);
              const titleBlockHeight = titleLines.length * TITLE_LINE_HEIGHT;
              const useCaseBlockHeight = positioned.useCaseLines.length
                ? 4 + positioned.useCaseLines.length * USE_CASE_LINE_HEIGHT
                : 0;
              const textHeight = titleBlockHeight + useCaseBlockHeight;
              const firstBaseline = y + (height - textHeight) / 2 + 11;
              const useCaseY = firstBaseline + titleBlockHeight + 2;
              return (
                <g
                  className="spec-business-flow-step"
                  key={node.id}
                  role="group"
                  aria-label={`手順${positioned.actionNumber}: ${node.title}`}
                >
                  <title>{`${positioned.actionNumber}. ${node.title}${linkedUseCase ? `。${linkedUseCase}` : ""}`}</title>
                  <rect
                    className="spec-business-flow-step-card"
                    x={x}
                    y={y}
                    width={width}
                    height={height}
                    rx="8"
                  />
                  <text
                    className="spec-business-flow-step-title"
                    textAnchor="middle"
                  >
                    {titleLines.map((line, index) => (
                      <tspan
                        key={index}
                        x={centerX}
                        y={firstBaseline + index * TITLE_LINE_HEIGHT}
                      >
                        {line}
                      </tspan>
                    ))}
                  </text>
                  {positioned.useCaseLines.length > 0 && (
                    <text
                      className="spec-business-flow-step-use-case"
                      textAnchor="middle"
                    >
                      {positioned.useCaseLines.map((line, index) => (
                        <tspan
                          key={index}
                          x={centerX}
                          y={useCaseY + index * USE_CASE_LINE_HEIGHT}
                        >
                          {line}
                        </tspan>
                      ))}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
          <ol id={descriptionId} className="sr-only">
            {nodes.map(({ node }) => (
              <li key={`node-${node.id}`}>ノード: {flowNodeLabel(node)}</li>
            ))}
            {edges.map((edge, index) => {
              const source = nodesById.get(edge.from)?.node;
              const target = nodesById.get(edge.to)?.node;
              if (!source || !target) return null;
              return (
                <li key={edge.id ?? `${edge.from}-${edge.to}-${index}`}>
                  {flowNodeLabel(source)}
                  {edge.label ? `（${edge.label}）` : ""} →{" "}
                  {flowNodeLabel(target)}
                </li>
              );
            })}
          </ol>
        </div>
        <svg
          className="spec-business-flow-lane-rail"
          width={Math.round(LANE_LABEL_WIDTH * zoom)}
          height={Math.round(chartHeight * zoom)}
          viewBox={`0 0 ${LANE_LABEL_WIDTH} ${chartHeight}`}
          role="img"
          aria-label={`担当レーン: ${lanes.map((lane) => lane.label).join("、")}`}
        >
          {lanes.map((lane) => (
            <g key={lane.key}>
              <rect
                className="spec-business-flow-lane"
                x="0"
                y={lane.top}
                width={LANE_LABEL_WIDTH}
                height={lane.height}
                rx="8"
              />
              <line
                className="spec-business-flow-lane-divider"
                x1={LANE_LABEL_WIDTH}
                x2={LANE_LABEL_WIDTH}
                y1={lane.top + 8}
                y2={lane.top + lane.height - 8}
              />
              <text
                className="spec-business-flow-lane-label"
                textAnchor="middle"
                x={LANE_LABEL_WIDTH / 2}
                y={
                  lane.top +
                  lane.height / 2 -
                  ((lane.labelLines.length - 1) * 15) / 2
                }
              >
                <title>{lane.label}</title>
                {lane.labelLines.map((line, index) => (
                  <tspan
                    key={index}
                    x={LANE_LABEL_WIDTH / 2}
                    dy={index === 0 ? 0 : 15}
                  >
                    {line}
                  </tspan>
                ))}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}
