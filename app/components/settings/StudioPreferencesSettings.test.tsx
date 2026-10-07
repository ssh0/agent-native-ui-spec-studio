import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@agent-native/core/client/i18n", () => ({
  useT: () => (key: string) => key,
  useOptionalLocale: () => ({}),
}));
vi.mock("@agent-native/toolkit/app/settings", () => ({
  SettingsGroup: ({ children }: { children: React.ReactNode }) => (
    <section>{children}</section>
  ),
  SettingsRow: ({ id, control }: { id: string; control: React.ReactNode }) => (
    <div id={id}>{control}</div>
  ),
}));
vi.mock("@agent-native/toolkit/app/settings/SchedulingTimezoneField", () => ({
  SchedulingTimezoneField: () => <select aria-label="Timezone" />,
}));
vi.mock("@agent-native/toolkit/app/shared", () => ({
  LanguagePicker: () => <select aria-label="Language" />,
}));
import { StudioPreferencesSettings } from "./StudioPreferencesSettings";

describe("localization-only preferences", () => {
  it("retains both account preferences without voice setup", () => {
    const html = renderToStaticMarkup(<StudioPreferencesSettings />);
    expect(html).toContain('id="interface-language"');
    expect(html).toContain('id="timezone"');
    expect(html).not.toMatch(/voice|builder/i);
  });
});
