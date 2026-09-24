import path from "node:path";

import { matchRoutes, type RouteObject } from "react-router";
import { describe, expect, it, vi } from "vitest";

describe("project entry routes", () => {
  it.each([
    ["an existing project link", "existing-project"],
    ["a newly created project's chat start", "new-project"],
  ])("opens %s through the project opener", async (_trigger, projectId) => {
    vi.stubGlobal("__reactRouterAppDirectory", path.resolve("app"));
    const { default: routes } = await import("../routes");
    const routeConfig = await routes;
    const matches = matchRoutes(
      routeConfig as RouteObject[],
      `/projects/${projectId}`,
    );

    expect(matches?.map(({ route }) => route.id)).toEqual([
      "routes/projects_.$projectId",
    ]);
    expect(matches?.[0]?.params.projectId).toBe(projectId);
  });
});
