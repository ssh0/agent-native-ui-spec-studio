import { describe, expect, it } from "vitest";

import {
  isDisabledStudioRoute,
  isStudioActionEnabled,
  studioActionNames,
  STUDIO_VOICE_ENABLED,
} from "./studio-capabilities";

describe("app capability boundary", () => {
  it("disables managed dictation without changing the framework default", () => {
    expect(STUDIO_VOICE_ENABLED).toBe(false);
  });
  it.each([
    "/builder",
    "/builder/status",
    "/builder/connect",
    "/builder/callback",
    "/builder/relay",
    "/builder/run",
    "/builder/agents-run",
    "/builder/disconnect",
    "/connection-status/builder",
    "/transcribe-voice",
    "/transcribe-stream/session",
    "/voice-providers/status",
    "/realtime-voice/session",
    "/realtime-voice/tool",
    "/actions/connect-builder",
    "/actions/manage-builder-connection",
    "/actions/get-builder-credit-status",
    "/actions/get-builder-credit-usage",
    "/actions/get-builder-referral-info",
    "/actions/connect-file-storage",
    "/actions/activate-browser",
    "/actions/get-infrastructure-status",
  ])("blocks the former entry point %s", (suffix) => {
    expect(isDisabledStudioRoute("/_agent-native" + suffix)).toBe(true);
    expect(isDisabledStudioRoute("/_agent-native" + suffix + "/")).toBe(true);
  });
  it.each([
    "/settings/preferences",
    "/settings/model",
    "/spec?mode=builder",
    "/_agent-native/realtime-token",
    "/_agent-native/speak",
    "/_agent-native/file-upload",
    "/_agent-native/actions/get-file-storage",
    "/_agent-native/actions/manage-file-storage",
    "/_agent-native/actions/project-create",
    "/_agent-native/actions/manage-agent-loop-settings",
    "/_agent-native/actions/provider-api-request",
    "/_agent-native/connection-status/slack",
    "/_agent-native/builderish",
    "/_agent-native/actions/screen-builder-edit",
  ])("preserves the independent path %s", (path) => {
    expect(isDisabledStudioRoute(path)).toBe(false);
  });
  it("filters both static and late-bound Builder tools", () => {
    expect(
      studioActionNames([
        "spec-load",
        "connect-builder",
        "activate-browser",
        "get-builder-credit-status",
        "provider-api-request",
      ]),
    ).toEqual(["spec-load", "provider-api-request"]);
    expect(isStudioActionEnabled("mcp_builder_cms_read")).toBe(false);
    expect(isStudioActionEnabled("builder-future-feature")).toBe(false);
  });
});
