import {
  registerFileUploadProvider,
  unregisterFileUploadProvider,
  listFileUploadProviders,
  uploadFile,
  builderFileUploadProvider,
  type FileUploadProvider,
} from "@agent-native/core/file-upload";
import type { FileStorageStatus } from "@agent-native/core/file-upload/storage-settings";
import { describe, expect, it, vi } from "vitest";

import {
  s3OnlyUploadProvider,
  s3StorageAvailable,
  studioStorageStatus,
} from "./studio-storage";

function base(
  configured = false,
  requestConfigured = false,
): FileUploadProvider {
  return {
    id: "s3",
    name: "S3",
    isConfigured: () => configured,
    isConfiguredForRequest: async () => requestConfigured,
    upload: vi.fn().mockResolvedValue({
      url: "https://storage.example.com/test",
      provider: "s3",
    }),
  };
}
describe("S3-only routing", () => {
  it("selects the app policy even without storage, then fails closed", async () => {
    const storage = base();
    const policy = s3OnlyUploadProvider(storage);
    expect(policy.isConfigured()).toBe(true);
    expect(await s3StorageAvailable(storage)).toBe(false);
    await expect(
      policy.upload({ data: new Uint8Array() }),
    ).rejects.toMatchObject({
      statusCode: 503,
      errorCode: "storage_unavailable",
    });
    expect(storage.upload).not.toHaveBeenCalled();
  });
  it.each([
    [true, false],
    [false, true],
  ])(
    "preserves deploy/per-request S3 configuration (%s, %s)",
    async (configured, requestConfigured) => {
      const storage = base(configured, requestConfigured);
      const policy = s3OnlyUploadProvider(storage);
      const input = { data: new Uint8Array([1]), filename: "fixture.txt" };
      expect(await policy.upload(input)).toMatchObject({ provider: "s3" });
      expect(storage.upload).toHaveBeenCalledWith(input);
      expect(await s3StorageAvailable(storage)).toBe(true);
    },
  );
  it("does not retry a failing S3 upload through another provider", async () => {
    const storage = base(true);
    vi.mocked(storage.upload).mockRejectedValue(new Error("S3 failed"));
    await expect(
      s3OnlyUploadProvider(storage).upload({ data: new Uint8Array() }),
    ).rejects.toThrow("S3 failed");
    expect(storage.upload).toHaveBeenCalledOnce();
  });
  it("prevents Core's implicit Builder fallback, not just the app upload UI", async () => {
    const original = listFileUploadProviders();
    for (const provider of original) unregisterFileUploadProvider(provider.id);
    const storage = base();
    const builderUpload = vi.spyOn(builderFileUploadProvider, "upload");
    const builderConfigured = vi
      .spyOn(builderFileUploadProvider, "isConfigured")
      .mockReturnValue(true);
    try {
      registerFileUploadProvider(s3OnlyUploadProvider(storage));
      await expect(
        uploadFile({ data: new Uint8Array() }),
      ).rejects.toMatchObject({ statusCode: 503 });
      expect(builderUpload).not.toHaveBeenCalled();
      expect(builderConfigured).not.toHaveBeenCalled();
    } finally {
      unregisterFileUploadProvider("s3");
      for (const provider of original) registerFileUploadProvider(provider);
      builderUpload.mockRestore();
      builderConfigured.mockRestore();
    }
  });

  it("removes stale Builder fallback from status without changing saved settings", () => {
    const saved = {
      configured: false,
      builderUploadConfigured: true,
      activeProvider: { id: "builder", name: "Builder.io" },
      canManage: false,
      saved: { bucket: false },
      endpoint: null,
    } as unknown as FileStorageStatus;
    const result = studioStorageStatus(saved);
    expect(result.builderUploadConfigured).toBe(false);
    expect(result.activeProvider).toBeNull();
    expect(result.saved).toBe(saved.saved);
    expect(result.canManage).toBe(false);
    expect(saved.builderUploadConfigured).toBe(true);
    expect(
      studioStorageStatus({ ...saved, configured: true }).activeProvider?.id,
    ).toBe("s3");
  });
});
