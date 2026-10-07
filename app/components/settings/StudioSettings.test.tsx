import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { StudioStorageSettings } from "./StudioStorageSettings";
import { providerCostCents, StudioUsageSettings } from "./StudioUsageSettings";

const state = vi.hoisted(() => ({
  query: {} as Record<string, unknown>,
  requests: [] as { name: string; input: unknown }[],
}));
vi.mock("@agent-native/core/client/hooks", () => ({
  useActionQuery: (name: string, input: unknown) => {
    state.requests.push({ name, input });
    return state.query;
  },
}));
vi.mock("@agent-native/core/client/i18n", () => ({
  useT: () => (key: string) => key,
}));
vi.mock("@agent-native/toolkit/app/settings", () => ({
  SettingsGroup: ({
    title,
    children,
  }: {
    title: string;
    children: React.ReactNode;
  }) => React.createElement("section", null, title, children),
  SettingsRow: ({
    label,
    control,
  }: {
    label: string;
    control: React.ReactNode;
  }) => React.createElement("div", null, label, control),
  StorageSettingsForm: () =>
    React.createElement("form", null, "S3 storage controls"),
}));

const totals = {
  costCents: 1234,
  calls: 9,
  inputTokens: 101,
  outputTokens: 202,
};

describe("studio usage and storage rendered states", () => {
  beforeEach(() => {
    state.query = {};
    state.requests = [];
  });

  it("uses app-scoped personal metrics without making a credit request", () => {
    state.query = { data: { billing: { unit: "usd" }, totals } };
    const html = renderToStaticMarkup(<StudioUsageSettings />);
    expect(html).toContain("$12.34");
    expect(html).toContain("101");
    expect(html).toContain("202");
    expect(state.requests).toEqual([
      {
        name: "get-usage-metrics",
        input: { sinceDays: 30, scope: "me", app: "current" },
      },
    ]);
    expect(html).not.toMatch(/builder|credits/i);
  });

  it("does not mislabel historic credit usage as USD", () => {
    expect(
      providerCostCents({
        billing: { unit: "mixed" },
        totals: { ...totals, otherCostCents: 456 },
      }),
    ).toBe(456);
    expect(
      providerCostCents({ billing: { unit: "builder-credits" }, totals }),
    ).toBeNull();
    state.query = { data: { billing: { unit: "builder-credits" }, totals } };
    const html = renderToStaticMarkup(<StudioUsageSettings />);
    expect(html).toContain("settings.usageUnavailable");
    expect(html).not.toContain("$12.34");
  });

  it.each([StudioUsageSettings, StudioStorageSettings])(
    "shows loading and actionable failure in %s",
    (Component) => {
      expect(renderToStaticMarkup(<Component />)).toContain('role="status"');
      state.query = { isError: true };
      const html = renderToStaticMarkup(<Component />);
      expect(html).toContain('role="alert"');
      expect(html).toContain("settings.retry");
    },
  );

  it("keeps generic storage controls when no managed fallback is configured", () => {
    state.query = { data: { builderUploadConfigured: false } };
    expect(renderToStaticMarkup(<StudioStorageSettings />)).toContain(
      "S3 storage controls",
    );
  });

  it("keeps S3 settings available even with a historical managed connection", () => {
    state.query = { data: { builderUploadConfigured: true } };
    expect(renderToStaticMarkup(<StudioStorageSettings />)).toContain(
      "S3 storage controls",
    );
    expect(state.requests).toEqual([
      { name: "get-file-storage", input: undefined },
    ]);
  });
});
