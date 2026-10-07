import { H3 } from "h3";
import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  session: null as null | { email: string; orgId: string | null },
  available: false,
  read: vi.fn(),
  scope: vi.fn(),
}));
vi.mock("@agent-native/core/server", () => ({
  getSession: async () => state.session,
  runWithRequestContext: async (
    scope: unknown,
    read: () => Promise<unknown>,
  ) => {
    state.scope(scope);
    return read();
  },
}));
vi.mock("./studio-storage.js", () => ({
  s3StorageAvailable: async () => {
    state.read();
    return state.available;
  },
}));
import {
  studioCapabilityGuard,
  studioUploadStatusHandler,
} from "./studio-capability-handler";

describe("HTTP capability policy", () => {
  it.each([
    "/_agent-native/connection-status/builder",
    "/_agent-native/connection-status/%62uilder",
    "/_agent-native//builder/connect?provisionAccount=true",
    "/_agent-native/transcribe-voice",
    "/_agent-native/realtime-voice/session",
    "/_agent-native/actions/manage-builder-connection",
  ])("blocks %s before a downstream handler can execute", async (path) => {
    const downstream = vi.fn(() => "should not run");
    const app = new H3();
    app.use(studioCapabilityGuard);
    app.use(downstream);
    const response = await app.fetch(new Request("http://localhost" + path));
    expect(response.status).toBe(404);
    expect(downstream).not.toHaveBeenCalled();
  });
  it("rejects malformed encoding and preserves independent operations", async () => {
    const app = new H3();
    app.use(studioCapabilityGuard);
    app.use(() => ({ ok: true }));
    expect(
      (await app.fetch(new Request("http://localhost/_agent-native/%xx")))
        .status,
    ).toBe(400);
    const response = await app.fetch(
      new Request("http://localhost/_agent-native/actions/project-list"),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });
  it("never resolves storage credentials without an authenticated user", async () => {
    state.session = null;
    state.read.mockClear();
    const app = new H3();
    app.use(studioUploadStatusHandler);
    expect(
      (await app.fetch(new Request("http://localhost/status"))).status,
    ).toBe(401);
    expect(state.read).not.toHaveBeenCalled();
  });
  it.each([false, true])(
    "reports actual scoped S3 availability (%s), never the policy provider",
    async (available) => {
      state.session = { email: "test-user@example.com", orgId: "test-org" };
      state.available = available;
      state.scope.mockClear();
      const app = new H3();
      app.use(studioUploadStatusHandler);
      const response = await app.fetch(new Request("http://localhost/status"));
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        configured: available,
        activeProvider: available ? { id: "s3" } : null,
        builderUploadConfigured: false,
        builderConfigured: false,
      });
      expect(state.scope).toHaveBeenCalledWith({
        userEmail: state.session.email,
        orgId: state.session.orgId,
      });
    },
  );
});
