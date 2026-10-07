import { useOptionalLocale, useT } from "@agent-native/core/client/i18n";
import { SettingsGroup, SettingsRow } from "@agent-native/toolkit/app/settings";
import { SchedulingTimezoneField } from "@agent-native/toolkit/app/settings/SchedulingTimezoneField";
import { LanguagePicker } from "@agent-native/toolkit/app/shared";

/** App-owned composition: retain localization, never mount managed dictation. */
export function StudioPreferencesSettings() {
  const t = useT();
  const hasLocale = useOptionalLocale() !== null;
  const key = (name: string) => `agentChat.settingsShell.account.${name}`;
  const label = t("agentChat.settingsShell.interfaceLanguage");
  return (
    <SettingsGroup id="language-region" title={t(key("languageAndRegion"))}>
      {hasLocale && (
        <SettingsRow
          id="interface-language"
          label={label}
          description={t(key("languageDescription"))}
          control={
            <div className="w-full sm:w-56">
              <LanguagePicker label={label} size="sm" />
            </div>
          }
        />
      )}
      <SettingsRow
        id="timezone"
        label={t(key("timezone"))}
        description={t(key("timezoneDescription"))}
        control={<SchedulingTimezoneField compact />}
      />
    </SettingsGroup>
  );
}
