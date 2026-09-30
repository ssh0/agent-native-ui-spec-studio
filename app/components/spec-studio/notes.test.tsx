import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DEFAULT_SPEC_YAML } from "../../../shared/default-spec";
import { domainSections } from "../../../shared/spec-schema";
import { parseSpecYaml } from "../../../shared/spec-utils";
import { DomainContent } from "./domain-content";
import { Note } from "./spec-editor-ui";

describe("notes hierarchy", () => {
  it("renders an escaped, initially collapsed note and preserves line breaks", () => {
    const html = renderToStaticMarkup(
      <Note value={"<script>example</script>\nsecond line"} label="全体方針" />,
    );
    expect(html).toContain('<details class="spec-note">');
    expect(html).toContain("<summary>全体方針</summary>");
    expect(html).not.toContain(" open");
    expect(html).toContain("&lt;script&gt;example&lt;/script&gt;\nsecond line");
  });

  it.each([undefined, "", " \n "])("omits empty notes: %s", (value) => {
    expect(renderToStaticMarkup(<Note value={value} />)).toBe("");
  });

  it.each(domainSections)(
    "keeps domain notes outside %s details",
    (section) => {
      const spec = structuredClone(parseSpecYaml(DEFAULT_SPEC_YAML).spec!);
      spec.domain.notes = "DOMAIN_NOTE_EXAMPLE";
      for (const item of spec.domain[section]) item.notes = "ITEM_NOTE_EXAMPLE";
      const render = () =>
        renderToStaticMarkup(
          <DomainContent
            spec={spec}
            update={() => {}}
            selectedId=""
            select={() => {}}
            domainSection={section}
            selectDomainSection={() => {}}
          />,
        );
      const html = render();
      expect(html.split("DOMAIN_NOTE_EXAMPLE")).toHaveLength(2);
      expect(html.indexOf("DOMAIN_NOTE_EXAMPLE")).toBeLessThan(
        html.indexOf("<nav"),
      );
      expect(html).toContain("データ・用語全体の検討メモ");
      if (spec.domain[section].length)
        expect(html).toContain("ITEM_NOTE_EXAMPLE");
      spec.domain[section] = [];
      expect(render().split("DOMAIN_NOTE_EXAMPLE")).toHaveLength(2);
    },
  );
});
