import coreAction from "@agent-native/core/file-upload/actions/get-file-storage";

import { studioStorageStatus } from "../server/lib/studio-storage.js";

/** Retain Core's validation, scoped authorization and storage contract. */
export default {
  ...coreAction,
  run: async (...args: Parameters<typeof coreAction.run>) =>
    studioStorageStatus(await coreAction.run(...args)),
};
