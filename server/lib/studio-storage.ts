import { fail } from "@agent-native/core/action";
import {
  registerFileUploadProvider,
  s3FileUploadProvider,
  type FileUploadProvider,
} from "@agent-native/core/file-upload";
import type { FileStorageStatus } from "@agent-native/core/file-upload/storage-settings";

/**
 * The registry's final fallback is always Builder, even after unregistering it.
 * A configured routing policy under Core's supported s3 override seam prevents
 * that fallthrough. Actual storage availability is reported separately.
 */
export function s3OnlyUploadProvider(
  base: FileUploadProvider,
): FileUploadProvider {
  return {
    ...base,
    isConfigured: () => true,
    isConfiguredForRequest: async () => true,
    upload: async (input) => {
      if (!(await s3StorageAvailable(base)))
        fail(
          "Configure S3-compatible object storage in Settings → File uploads.",
          {
            statusCode: 503,
            errorCode: "storage_unavailable",
          },
        );
      return base.upload(input);
    },
  };
}

export async function s3StorageAvailable(
  base = s3FileUploadProvider,
): Promise<boolean> {
  return base.isConfigured() || !!(await base.isConfiguredForRequest?.());
}

export function installStudioStoragePolicy() {
  registerFileUploadProvider(s3OnlyUploadProvider(s3FileUploadProvider));
}

export function studioStorageStatus(
  status: FileStorageStatus,
): FileStorageStatus {
  return {
    ...status,
    builderUploadConfigured: false,
    activeProvider:
      status.configured || s3FileUploadProvider.isConfigured()
        ? { id: s3FileUploadProvider.id, name: s3FileUploadProvider.name }
        : null,
  };
}
