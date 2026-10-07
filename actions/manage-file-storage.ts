import coreAction from "@agent-native/core/file-upload/actions/manage-file-storage";

import { studioStorageStatus } from "../server/lib/studio-storage.js";

/** Retain Core's owner/admin checks, secret custody and audit behavior. */
export default {
  ...coreAction,
  tool: {
    ...coreAction.tool,
    description:
      "Save or clear S3-compatible file storage. Owners and admins only. Omitted fields retain saved keys. Clearing disables uploads unless storage is configured in the deployment environment; existing files are not deleted. Read get-file-storage first.",
  },
  run: async (...args: Parameters<typeof coreAction.run>) => {
    const result = await coreAction.run(...args);
    return { ...result, status: studioStorageStatus(result.status) };
  },
};
