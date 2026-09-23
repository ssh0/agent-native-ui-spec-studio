import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DEFAULT_SPEC_YAML } from "../../../shared/default-spec";
import { parseSpecYaml } from "../../../shared/spec-utils";

import { StageContent } from "./stage-content";

const spec = parseSpecYaml(DEFAULT_SPEC_YAML).spec!;

describe("specification stage composition", () => {
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
