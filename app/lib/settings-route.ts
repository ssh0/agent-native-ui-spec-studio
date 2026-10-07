import { buildSettingsRoute } from "@agent-native/core/client/navigation";

/** Keep old connection URLs safe in both shared Settings layouts. */
export function studioSettingsDestination(
  pathname: string,
  hash: string,
  search: string,
) {
  const path = pathname.replace(/\/+$/, "");
  let section = hash.replace(/^#/, "");
  try {
    section = decodeURIComponent(section).toLowerCase();
  } catch {
    /* Keep malformed hashes harmless. */
  }
  if (path === "/settings" && section === "ai-provider") {
    return `${buildSettingsRoute("agent")}${search}#ai-provider`;
  }
  const legacyConnectionPath =
    path === "/settings/integrations" ||
    path.startsWith("/settings/integrations/");
  const legacyConnectionHash =
    path === "/settings" &&
    /^(integrations|connections|browser)(:|$)/.test(section);
  if (!legacyConnectionPath && !legacyConnectionHash) return null;
  return `${buildSettingsRoute("studio-integrations")}${search}`;
}
