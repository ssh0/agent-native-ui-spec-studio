import { describe, expect, it } from "vitest";

import { catalogEngine, catalogProviders } from "../../shared/provider-models";
import { appBuiltInEngines } from "./agent-engine-policy";

describe("app agent engine policy", () => {
  it("allows only the app's direct providers", () => {
    expect(appBuiltInEngines).toEqual(catalogProviders.map(catalogEngine));
    expect(appBuiltInEngines).not.toContain("builder");
    expect(new Set(appBuiltInEngines).size).toBe(appBuiltInEngines.length);
  });
});
