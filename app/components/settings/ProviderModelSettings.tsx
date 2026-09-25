import { agentNativePath } from "@agent-native/core/client/api-path";
import { callAction } from "@agent-native/core/client/hooks";
import {
  AGENT_PROVIDER_CATALOG,
  AgentProviderPicker,
  providerIdForEngine,
  type AgentProviderId,
} from "@agent-native/core/client/settings";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProviderModelScope } from "./ProviderModelScope";
import { catalogProviders } from "../../../shared/provider-models";

type Engine = {
  name: string;
  packageInstalled?: boolean;
  configured?: boolean;
  supportedModels?: string[];
};
type EngineList = {
  engines: Engine[];
  current?: { engine: string; model: string } | null;
};
type KeyStatus = "set" | "unset" | "invalid" | "unknown";
type ModelDefault = { engine?: string; model?: string; canUpdate: boolean; orgId?: string | null };

const providers = AGENT_PROVIDER_CATALOG.filter((option) => option.key);

function asEngineList(value: unknown): EngineList {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as EngineList).engines)) {
    throw new Error("Provider availability could not be loaded.");
  }
  return parsed as EngineList;
}

function errorMessage(error: unknown): string {
  if (!(error instanceof Error)) return "The request failed. Try again.";
  // A Core fallback mentions its optional Builder connection on sign-in errors.
  if (error.message.includes("connect Builder")) return "Sign in to save an API key.";
  return error.message;
}

export function ProviderModelSettings() {
  const [provider, setProvider] = useState<AgentProviderId>("anthropic");
  const [engineList, setEngineList] = useState<EngineList | null>(null);
  const [modelDefault, setModelDefault] = useState<ModelDefault | null>(null);
  const [statuses, setStatuses] = useState<Record<string, KeyStatus>>({});
  const [keySources, setKeySources] = useState<Record<string, string>>({});
  const [key, setKey] = useState("");
  const [model, setModel] = useState("");
  const [customModel, setCustomModel] = useState("");
  const [busy, setBusy] = useState<"key" | "model" | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const initialProviderSet = useRef(false);
  const option = providers.find((item) => item.id === provider)!;
  const engine = engineList?.engines.find((item) => item.name === option.engine);
  const status = statuses[provider] ?? "unknown";
  const available = Boolean(engine && engine.packageInstalled !== false);
  const ready = available && status === "set" && engine?.configured !== false;
  const currentProvider = providerIdForEngine(engineList?.current?.engine ?? "");
  const configuredProviders = useMemo(
    () => new Set(providers.filter((item) => statuses[item.id] === "set").map((item) => item.id)),
    [statuses],
  );
  const models = engine?.supportedModels?.length ? engine.supportedModels : option.supportedModels;

  async function refresh() {
    const [list, secretsResponse, modelResponse] = await Promise.all([
      callAction("manage-agent-engine", { action: "list" }),
      fetch(agentNativePath("/_agent-native/secrets"), { credentials: "include" }),
      fetch(agentNativePath("/_agent-native/agent-model-defaults"), { credentials: "include" }),
    ]);
    if (!secretsResponse.ok) throw new Error("API key status could not be loaded.");
    if (!modelResponse.ok) throw new Error("Model settings could not be loaded.");
    const secrets: unknown = await secretsResponse.json();
    const modelSettings: ModelDefault = await modelResponse.json();
    if (!Array.isArray(secrets)) throw new Error("API key status could not be read.");
    if (!modelSettings || typeof modelSettings.canUpdate !== "boolean") throw new Error("Model settings could not be read.");
    const next: Record<string, KeyStatus> = {};
    const sources: Record<string, string> = {};
    for (const item of providers) {
      const secret = secrets.find((entry) => entry?.key === item.key);
      next[item.id] = ["set", "unset", "invalid"].includes(secret?.status)
        ? secret.status
        : "unknown";
      if (typeof secret?.effectiveScope === "string") sources[item.id] = secret.effectiveScope;
    }
    const engineData = asEngineList(list);
    const effectiveProvider = providerIdForEngine(engineData.current?.engine ?? "");
    if (!initialProviderSet.current) {
      initialProviderSet.current = true;
      if (effectiveProvider && providers.some((item) => item.id === effectiveProvider)) {
        setProvider(effectiveProvider);
      }
    }
    setStatuses(next);
    setKeySources(sources);
    setModelDefault(modelSettings);
    setEngineList(engineData);
    return { statuses: next, modelSettings };
  }

  useEffect(() => {
    let active = true;
    void refresh().catch((cause) => {
      if (active) setError(errorMessage(cause));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const selected = currentProvider === provider ? engineList?.current?.model : undefined;
    setModel(selected && models.includes(selected) ? selected : option.defaultModel);
    setCustomModel(selected && !models.includes(selected) ? selected : "");
  }, [provider, engineList]);

  async function retryStatus() {
    setLoading(true);
    setError("");
    try {
      await refresh();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }

  async function saveKey(event: FormEvent) {
    event.preventDefault();
    if (!key.trim() || busy) return;
    setBusy("key");
    setError("");
    setNotice("");
    try {
      const response = await fetch(agentNativePath("/_agent-native/agent-engine/api-key"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: option.key,
          value: key.trim(),
          scope: keySources[provider] === "user" || !modelDefault?.canUpdate || !modelDefault.orgId
            ? "user"
            : "org",
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        if (response.status === 401) throw new Error("Sign in to save an API key.");
        throw new Error(typeof payload?.error === "string"
          ? payload.error
          : `The ${option.label} key could not be saved (HTTP ${response.status}).`);
      }
      setKey("");
      window.dispatchEvent(new CustomEvent("agent-engine:configured-changed"));
      const verified = await refresh();
      if (verified.statuses[provider] !== "set") {
        throw new Error(`The ${option.label} key could not be verified. Check the key and try again.`);
      }
      setNotice(`${option.label} key saved.`);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(null);
    }
  }

  async function selectModel(event: FormEvent) {
    event.preventDefault();
    if (!ready || !modelDefault?.canUpdate || busy) return;
    setBusy("model");
    setError("");
    setNotice("");
    try {
      const selected = customModel.trim() || model;
      const response = await fetch(agentNativePath("/_agent-native/agent-model-defaults"), {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ engine: option.engine, model: selected }),
      });
      const saved = await response.json();
      if (!response.ok || !saved || saved.engine !== option.engine || saved.model !== selected) {
        throw new Error(saved?.error ?? `Could not select ${option.label}.`);
      }
      window.dispatchEvent(new CustomEvent("agent-engine:configured-changed"));
      const verified = await refresh();
      if (verified.modelSettings.engine !== option.engine || verified.modelSettings.model !== selected) {
        throw new Error("The model change could not be verified. Refresh and try again.");
      }
      setNotice(`${option.label} · ${saved.model} selected.`);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="space-y-5" aria-label="AI provider and model">
      <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
        <h2 className="text-lg font-semibold">AI provider</h2>
        {currentProvider && currentProvider !== "ollama" && (
          <span className="text-sm text-muted-foreground">
            Current: {providers.find((item) => item.id === currentProvider)?.label ?? "Unavailable"}
          </span>
        )}
      </div>

      <AgentProviderPicker
        value={provider}
        onChange={(next) => { setProvider(next); setKey(""); setError(""); setNotice(""); }}
        options={providers}
        configuredProviders={configuredProviders}
        disabled={loading || busy !== null}
        layout="page"
      />

      {loading ? <p className="text-sm text-muted-foreground">Checking providers…</p> : (
        <div className="space-y-4 rounded-lg border border-border p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="font-medium">{option.label}</span>
            <span className="text-sm text-muted-foreground">
              {!available ? "Unavailable" : status === "invalid" ? "Key invalid" : status === "unset" ? "Key needed" : status === "set" && engine?.configured === false ? "Provider not ready" : status === "set" ? "Key saved" : "Status unavailable"}
            </span>
          </div>
          {!available && <p className="text-sm text-muted-foreground">This provider is unavailable in this app. Choose another provider.</p>}
          {available && status === "invalid" && <p className="text-sm text-destructive">Update the API key to use this provider.</p>}
          {available && status === "set" && engine?.configured === false && <p className="text-sm text-muted-foreground">Update the key or choose another provider.</p>}
          {available && status === "unknown" && (
            <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
              <span>Key status is unavailable.</span>
              <Button type="button" variant="outline" onClick={() => void retryStatus()}>Retry</Button>
            </div>
          )}
          {available && (
            <form onSubmit={saveKey} className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <label className="min-w-0 flex-1 space-y-1 text-sm font-medium">
                <span>{option.label} API key</span>
                <Input type="password" value={key} onChange={(event) => setKey(event.target.value)} autoComplete="off" spellCheck={false} disabled={busy !== null} />
              </label>
              <Button type="submit" disabled={!key.trim() || busy !== null}>
                {busy === "key" ? "Saving…" : status === "set" ? "Update key" : "Save key"}
              </Button>
            </form>
          )}
          {option.docsUrl && <a className="text-sm text-muted-foreground underline" href={option.docsUrl} target="_blank" rel="noopener noreferrer">Get an API key</a>}
        </div>
      )}

      {catalogProviders.includes(provider as (typeof catalogProviders)[number]) && <ProviderModelScope
        key={`${provider}:${status}`}
        provider={provider as (typeof catalogProviders)[number]}
        fallbackModels={models}
        currentModel={currentProvider === provider ? engineList?.current?.model : undefined}
        ready={ready}
      />}

      <form onSubmit={selectModel} className="space-y-3">
        <label className="block space-y-1 text-sm font-medium">
          <span>Model</span>
          <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={model} onChange={(event) => setModel(event.target.value)} disabled={!ready || busy !== null}>
            {models.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        {ready && <label className="block space-y-1 text-sm font-medium">
          <span>Other model ID (optional)</span>
          <Input value={customModel} onChange={(event) => setCustomModel(event.target.value)} autoComplete="off" spellCheck={false} disabled={busy !== null} />
        </label>}
        {ready && modelDefault?.canUpdate === false && (
          <p className="text-sm text-muted-foreground">Ask an organization owner or admin to change this app’s model.</p>
        )}
        <Button type="submit" disabled={!ready || !modelDefault?.canUpdate || busy !== null}>{busy === "model" ? "Selecting…" : "Use this model"}</Button>
      </form>
      {error && <div role="alert" className="flex items-center justify-between gap-3 text-sm text-destructive">
        <span>{error}</span>
        {!engineList && <Button type="button" variant="outline" onClick={() => void retryStatus()}>Retry</Button>}
      </div>}
      {notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}
    </section>
  );
}
