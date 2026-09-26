import {
  buildLegacyAgentSettingsRoute,
  buildSettingsRoute,
} from "@agent-native/core/client/navigation";

function normalizedAgentHash(hash: string): string {
  const value = hash.replace(/^#/, "");
  try {
    return decodeURIComponent(value).trim().toLowerCase();
  } catch {
    return value.trim().toLowerCase();
  }
}

export function buildAgentSettingsDestination(hash: string, search = "") {
  const normalizedHash = normalizedAgentHash(hash);
  if (normalizedHash === "resources" || normalizedHash === "agent:resources") {
    return `${buildSettingsRoute("agent:resources")}${search}`;
  }
  return buildLegacyAgentSettingsRoute(hash, search);
}

export function isLegacyAgentResourcesLocation(
  pathname: string,
  hash: string,
): boolean {
  const pathParts = pathname.split("/").filter(Boolean);
  const normalizedHash = normalizedAgentHash(hash);
  return (
    pathParts[pathParts.length - 2] === "settings" &&
    pathParts[pathParts.length - 1] === "agent" &&
    (normalizedHash === "resources" || normalizedHash === "agent:resources")
  );
}
