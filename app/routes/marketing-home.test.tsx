import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import MarketingHomeRoute, { meta } from "./_index";

// MarketingHome was removed from Toolkit in the 0.198 upgrade.
describe("app-owned public landing page", () => {
  it("retains project/sign-in links and accessible content without authentication", () => {
    const html = renderToStaticMarkup(<MarketingHomeRoute />);
    expect(html).toContain("data-agent-native-marketing-home");
    expect(html).toContain('href="/projects"');
    expect(html).toContain('href="/sign-in"');
    expect(html).toContain("<h1");
    expect(html).toContain("Full-page chat with durable threads");
    expect(meta()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "description" }),
        expect.objectContaining({ property: "og:title" }),
      ]),
    );
  });
});
