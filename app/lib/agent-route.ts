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

function isLegacyAgentResourcesHash(hash: string): boolean {
  const normalizedHash = normalizedAgentHash(hash);
  return normalizedHash === "resources" || normalizedHash === "agent:resources";
}

export function buildAgentResourcesDestination(search = "") {
  return `${buildSettingsRoute("agent:resources")}${search}`;
}

export function buildAgentSettingsDestination(hash: string, search = "") {
  if (isLegacyAgentResourcesHash(hash)) {
    return buildAgentResourcesDestination(search);
  }
  return buildLegacyAgentSettingsRoute(hash, search);
}

export function getLegacyAgentResourcesDestination(
  pathname: string,
  hash: string,
  search = "",
): string | null {
  const pathParts = pathname.split("/").filter(Boolean);
  const isAgentSettingsRoot =
    pathParts[pathParts.length - 2] === "settings" &&
    pathParts[pathParts.length - 1] === "agent";
  return isAgentSettingsRoot && isLegacyAgentResourcesHash(hash)
    ? buildAgentResourcesDestination(search)
    : null;
}
