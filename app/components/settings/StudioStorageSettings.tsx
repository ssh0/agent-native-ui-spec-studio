import { useActionQuery } from "@agent-native/core/client/hooks";
import { useT } from "@agent-native/core/client/i18n";
import type { FileStorageStatus } from "@agent-native/core/file-upload/storage-settings";
import { StorageSettingsForm } from "@agent-native/toolkit/app/settings";

import { Button } from "@/components/ui/button";

/** Generic S3 configuration only; externally managed storage is not reconfigured here. */
export function StudioStorageSettings() {
  const t = useT();
  const query = useActionQuery<FileStorageStatus>("get-file-storage");
  if (query.isError) {
    return (
      <div role="alert">
        <p>{t("settings.storageLoadError")}</p>
        <Button variant="outline" onClick={() => void query.refetch()}>
          {t("settings.retry")}
        </Button>
      </div>
    );
  }
  if (!query.data) return <p role="status">{t("settings.storageLoading")}</p>;
  if (query.data.builderUploadConfigured === null) {
    return (
      <div role="alert">
        <p>{t("settings.storageLoadError")}</p>
        <Button variant="outline" onClick={() => void query.refetch()}>
          {t("settings.retry")}
        </Button>
      </div>
    );
  }
  if (query.data.builderUploadConfigured) {
    return <p>{t("settings.storageManagedExternally")}</p>;
  }
  return <StorageSettingsForm />;
}
