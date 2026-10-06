import { useActionQuery } from "@agent-native/core/client/hooks";
import { useT } from "@agent-native/core/client/i18n";
import { SettingsGroup, SettingsRow } from "@agent-native/toolkit/app/settings";

import { Button } from "@/components/ui/button";

export interface StudioUsageMetrics {
  billing: { unit: "usd" | "builder-credits" | "mixed" };
  totals: {
    costCents: number;
    otherCostCents?: number;
    calls: number;
    inputTokens: number;
    outputTokens: number;
  };
}

/** Never relabel credit-backed costs as provider dollars. */
export function providerCostCents(data: StudioUsageMetrics): number | null {
  return data.billing.unit === "usd"
    ? data.totals.costCents
    : (data.totals.otherCostCents ?? null);
}

export function StudioUsageSettings() {
  const t = useT();
  const query = useActionQuery<StudioUsageMetrics>("get-usage-metrics", {
    sinceDays: 30,
    scope: "me",
    app: "current",
  });

  if (query.isError) {
    return (
      <div role="alert">
        <p>{t("settings.usageLoadError")}</p>
        <Button variant="outline" onClick={() => void query.refetch()}>
          {t("settings.retry")}
        </Button>
      </div>
    );
  }
  if (query.isLoading || !query.data)
    return <p role="status">{t("settings.usageLoading")}</p>;

  const cost = providerCostCents(query.data);
  return (
    <SettingsGroup title={t("settings.usageTitle")}>
      <SettingsRow
        label={t("settings.usageCost")}
        control={
          cost === null
            ? t("settings.usageUnavailable")
            : `$${(cost / 100).toFixed(2)}`
        }
      />
      <SettingsRow
        label={t("settings.usageCalls")}
        control={query.data.totals.calls.toLocaleString()}
      />
      <SettingsRow
        label={t("settings.usageInput")}
        control={query.data.totals.inputTokens.toLocaleString()}
      />
      <SettingsRow
        label={t("settings.usageOutput")}
        control={query.data.totals.outputTokens.toLocaleString()}
      />
    </SettingsGroup>
  );
}
