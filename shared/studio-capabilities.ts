/** Product capability policy, independent of the shared framework implementation. */
export const STUDIO_VOICE_ENABLED = false;

export const DISABLED_STUDIO_ACTIONS = [
  "connect-builder",
  "manage-builder-connection",
  "get-builder-credit-usage",
  "get-builder-credit-status",
  "get-builder-referral-info",
  "connect-file-storage", // Core renders a Builder connect card, not our S3 settings.
  "activate-browser", // Core provisions the Builder-hosted browser.
  "get-infrastructure-status", // Builder provisioning read, not app-owned infrastructure.
] as const;
const disabledActions = new Set<string>(DISABLED_STUDIO_ACTIONS);

export function isStudioActionEnabled(name: string): boolean {
  return (
    !disabledActions.has(name) &&
    !/^(?:(?:get|manage|connect|run)-builder(?:-|$)|builder(?:[-_]|$)|mcp[-_]+builder(?:[-_]|$))/i.test(
      name,
    )
  );
}

export function studioActionNames(names: readonly string[]): string[] {
  return names.filter(isStudioActionEnabled);
}

/** Call with the canonical, decoded framework path (query strings excluded). */
export function isDisabledStudioRoute(path: string): boolean {
  const suffix = path.replace(/^\/_agent-native(?=\/|$)/, "");
  if (suffix === path) return false;
  return (
    [
      "/builder",
      "/connection-status/builder",
      "/transcribe-voice",
      "/transcribe-stream",
      "/voice-providers",
      "/realtime-voice",
    ].some((prefix) => suffix === prefix || suffix.startsWith(`${prefix}/`)) ||
    (suffix.startsWith("/actions/") &&
      !isStudioActionEnabled(suffix.slice("/actions/".length).split("/")[0]))
  );
}
