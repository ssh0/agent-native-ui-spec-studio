import {
  fetchAgentLoopSettings,
  type AgentLoopSettingsStatus,
} from "@agent-native/core/client/agent-loop-settings";
import { useT } from "@agent-native/core/client/i18n";
import { SettingsGroup, SettingsRow } from "@agent-native/toolkit/app/settings";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateAgentLimit, validAgentLimit } from "@/lib/agent-limits";

/** Do not mount AgentSettingsContent: even its limits-only view polls Builder. */
export function StudioAgentLimits() {
  const t = useT();
  const [status, setStatus] = useState<AgentLoopSettingsStatus | null>(null);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setError(false);
    void fetchAgentLoopSettings()
      .then((next) => {
        if (!active) return;
        setStatus(next);
        setValue(String(next.maxIterations));
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [loadAttempt]);

  const write = async (reset = false) => {
    if (
      !status?.canUpdate ||
      busy ||
      (!reset && !validAgentLimit(value, status))
    )
      return;
    setBusy(true);
    setError(false);
    setSaved(false);
    try {
      const next = await updateAgentLimit(reset ? "reset" : Number(value));
      setStatus(next);
      setValue(String(next.maxIterations));
      setSaved(true);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <SettingsGroup
      id="settings-section-limits"
      title={t("settings.limitsTitle")}
    >
      {!status && !error && <p role="status">{t("settings.limitsLoading")}</p>}
      {error && (
        <div role="alert">
          <p>{t("settings.limitsError")}</p>
          {!status && (
            <Button
              variant="outline"
              onClick={() => setLoadAttempt((n) => n + 1)}
            >
              {t("settings.retry")}
            </Button>
          )}
        </div>
      )}
      {status && (
        <SettingsRow
          id="limits"
          label={t("settings.limitsIterations")}
          description={t("settings.limitsDescription", {
            default: status.defaultMaxIterations,
            scope: status.scope,
          })}
          control={
            <form
              className="flex flex-wrap items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void write();
              }}
            >
              <Input
                className="w-24"
                aria-label={t("settings.limitsIterations")}
                type="number"
                min={status.minMaxIterations}
                max={status.maxMaxIterations}
                step={1}
                value={value}
                disabled={!status.canUpdate || busy}
                onChange={(event) => {
                  setValue(event.target.value);
                  setSaved(false);
                  setError(false);
                }}
              />
              <Button
                type="submit"
                disabled={
                  !status.canUpdate ||
                  busy ||
                  !validAgentLimit(value, status) ||
                  Number(value) === status.maxIterations
                }
              >
                {t(busy ? "settings.limitsSaving" : "settings.limitsSave")}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={
                  !status.canUpdate ||
                  busy ||
                  !["org", "user"].includes(status.source)
                }
                onClick={() => void write(true)}
              >
                {t("settings.limitsReset")}
              </Button>
              {saved && <span role="status">{t("settings.limitsSaved")}</span>}
            </form>
          }
        />
      )}
    </SettingsGroup>
  );
}
