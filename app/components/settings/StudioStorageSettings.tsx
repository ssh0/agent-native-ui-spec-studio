import { useActionQuery } from "@agent-native/core/client/hooks";
import { useT } from "@agent-native/core/client/i18n";
import type { FileStorageStatus } from "@agent-native/core/file-upload/storage-settings";
import { StorageSettingsForm } from "@agent-native/toolkit/app/settings";

import { Button } from "@/components/ui/button";

/** Generic S3 settings; app actions and the upload policy disable managed fallback. */
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
  return <StorageSettingsForm />;
}
