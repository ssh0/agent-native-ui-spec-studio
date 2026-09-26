import { Navigate, useLocation } from "react-router";

import { buildAgentSettingsDestination } from "@/lib/agent-route";

export function meta() {
  return [{ title: "Agent settings" }]; // i18n-ignore legacy meta fallback; the client title is localized
}

export default function AgentRoute() {
  const location = useLocation();
  return (
    <Navigate
      to={buildAgentSettingsDestination(location.hash, location.search)}
      replace
    />
  );
}
