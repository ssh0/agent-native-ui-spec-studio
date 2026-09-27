import { isFlowStep, type FlowStep, type UiSpec } from "@shared/spec-schema";
import {
  formatReferenceLabel,
  groupFlowStepsByPerformer,
  performerTitle,
  resolveNamedReference,
} from "@shared/spec-utils";
import { useId } from "react";

import { BusinessFlowGraphPreview } from "./business-flow-graph-preview";

const LANE_LABEL_WIDTH = 204;
const STEP_START_X = 24;
const STEP_WIDTH = 204;
const STEP_PITCH = 260;
const LANE_GAP = 10;
const TOP_PADDING = 12;
const BOTTOM_PADDING = 12;
const STEP_TEXT_LIMIT = 19;
const LANE_TEXT_LIMIT = 16;
const TITLE_LINE_HEIGHT = 15;
const USE_CASE_LINE_HEIGHT = 12;
const CARD_PADDING = 12;

type Flow = UiSpec["flows"][number];
type Step = FlowStep;
type StepCard = {
  step: Step;
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
  centerY: number;
  titleLines: string[];
  useCaseLines: string[];
};
type Lane = {
  label: string;
  labelLines: string[];
  top: number;
  height: number;
  cards: StepCard[];
};

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

function useCaseLabel(spec: UiSpec, step: Step): string | undefined {
  if (!step.useCase) return;
  return `UC: ${formatReferenceLabel(
    resolveNamedReference(spec.useCases, step.useCase),
    spec.useCases.map((item) => item.id),
  )}`;
}

function buildLanes(spec: UiSpec, flow: Flow): Lane[] {
  let nextTop = TOP_PADDING;
  return groupFlowStepsByPerformer(flow.steps).map(({ performer, steps }) => {
    const label = performerTitle(spec, performer);
    const labelLines = wrapText(label, LANE_TEXT_LIMIT);
    const measuredCards = steps.map(({ step, index }) => {
      const titleLines = wrapText(
        `${index + 1}. ${step.title}`,
        STEP_TEXT_LIMIT,
      );
      const linkedUseCase = useCaseLabel(spec, step);
      const useCaseLines = linkedUseCase
        ? wrapText(linkedUseCase, STEP_TEXT_LIMIT)
        : [];
      const contentHeight =
        titleLines.length * TITLE_LINE_HEIGHT +
        (useCaseLines.length
          ? 4 + useCaseLines.length * USE_CASE_LINE_HEIGHT
          : 0);
      const height = Math.max(60, contentHeight + CARD_PADDING * 2);
      return {
        step,
        index,
        x: STEP_START_X + index * STEP_PITCH,
        width: STEP_WIDTH,
        height,
        titleLines,
        useCaseLines,
      };
    });
    const height = Math.max(
      88,
      ...measuredCards.map((card) => card.height + 16),
      labelLines.length * 16 + 24,
    );
    const top = nextTop;
    nextTop += height + LANE_GAP;
    return {
      label,
      labelLines,
      top,
      height,
      cards: measuredCards.map((card) => ({
        ...card,
        y: top + (height - card.height) / 2,
        centerY: top + height / 2,
      })),
    };
  });
}

export function BusinessFlowPreview({
  spec,
  flow,
  zoom,
}: {
  spec: UiSpec;
  flow: Flow;
  zoom: number;
}) {
  const instance = useId().replace(/[^a-zA-Z0-9]/g, "");
  const arrowId = `business-flow-arrow-${instance}`;

  if (flow.edges !== undefined || flow.steps.some((node) => !isFlowStep(node)))
    return <BusinessFlowGraphPreview spec={spec} flow={flow} zoom={zoom} />;

  if (flow.steps.length === 0)
    return (
      <div className="spec-flow-render spec-flow-empty" role="region">
        この業務フローには手順がありません。
      </div>
    );

  const lanes = buildLanes(spec, flow);
  const cardsByIndex = new Map(
    lanes.flatMap((lane) =>
      lane.cards.map((card) => [card.index, card] as const),
    ),
  );
  const chartWidth =
    STEP_START_X + (flow.steps.length - 1) * STEP_PITCH + STEP_WIDTH + 24;
  const height =
    lanes[lanes.length - 1].top +
    lanes[lanes.length - 1].height +
    BOTTOM_PADDING;

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
            height={Math.round(height * zoom)}
            viewBox={`0 0 ${chartWidth} ${height}`}
            role="img"
            aria-label={`${flow.title}。手順は左から右へ進みます。`}
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
            {lanes.map((lane, laneIndex) => (
              <rect
                className="spec-business-flow-lane"
                key={laneIndex}
                x="0"
                y={lane.top}
                width={chartWidth}
                height={lane.height}
                rx="8"
              />
            ))}
            {flow.steps.slice(0, -1).map((step, index) => {
              const source = cardsByIndex.get(index);
              const target = cardsByIndex.get(index + 1);
              if (!source || !target) return null;
              const sourceX = source.x + source.width;
              const targetX = target.x - 2;
              const middleX = (sourceX + targetX) / 2;
              const path =
                source.centerY === target.centerY
                  ? `M ${sourceX} ${source.centerY} H ${targetX}`
                  : `M ${sourceX} ${source.centerY} H ${middleX} V ${target.centerY} H ${targetX}`;
              return (
                <path
                  className="spec-business-flow-connector"
                  d={path}
                  key={`${step.id}-${index}`}
                  markerEnd={`url(#${arrowId})`}
                />
              );
            })}
            {lanes.flatMap((lane) =>
              lane.cards.map((card) => {
                const linkedUseCase = useCaseLabel(spec, card.step);
                const titleBlockHeight =
                  card.titleLines.length * TITLE_LINE_HEIGHT;
                const useCaseBlockHeight = card.useCaseLines.length
                  ? 4 + card.useCaseLines.length * USE_CASE_LINE_HEIGHT
                  : 0;
                const textHeight = titleBlockHeight + useCaseBlockHeight;
                const firstBaseline =
                  card.y + (card.height - textHeight) / 2 + 11;
                const useCaseY = firstBaseline + titleBlockHeight + 2;
                return (
                  <g
                    className="spec-business-flow-step"
                    key={`${card.step.id}-${card.index}`}
                    role="group"
                    aria-label={`手順${card.index + 1}: ${card.step.title}`}
                  >
                    <title>{`${card.index + 1}. ${card.step.title}${linkedUseCase ? `。${linkedUseCase}` : ""}`}</title>
                    <rect
                      className="spec-business-flow-step-card"
                      x={card.x}
                      y={card.y}
                      width={card.width}
                      height={card.height}
                      rx="8"
                    />
                    <text
                      className="spec-business-flow-step-title"
                      textAnchor="middle"
                    >
                      {card.titleLines.map((line, lineIndex) => (
                        <tspan
                          key={lineIndex}
                          x={card.x + card.width / 2}
                          y={firstBaseline + lineIndex * TITLE_LINE_HEIGHT}
                        >
                          {line}
                        </tspan>
                      ))}
                    </text>
                    {card.useCaseLines.length > 0 && (
                      <text
                        className="spec-business-flow-step-use-case"
                        textAnchor="middle"
                      >
                        {card.useCaseLines.map((line, lineIndex) => (
                          <tspan
                            key={lineIndex}
                            x={card.x + card.width / 2}
                            y={useCaseY + lineIndex * USE_CASE_LINE_HEIGHT}
                          >
                            {line}
                          </tspan>
                        ))}
                      </text>
                    )}
                  </g>
                );
              }),
            )}
          </svg>
        </div>
        <svg
          className="spec-business-flow-lane-rail"
          width={Math.round(LANE_LABEL_WIDTH * zoom)}
          height={Math.round(height * zoom)}
          viewBox={`0 0 ${LANE_LABEL_WIDTH} ${height}`}
          role="img"
          aria-label={`担当レーン: ${lanes.map((lane) => lane.label).join("、")}`}
        >
          {lanes.map((lane, laneIndex) => (
            <g key={laneIndex}>
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
                {lane.labelLines.map((line, lineIndex) => (
                  <tspan
                    key={lineIndex}
                    x={LANE_LABEL_WIDTH / 2}
                    dy={lineIndex === 0 ? 0 : 15}
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
