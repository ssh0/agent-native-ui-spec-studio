import { defineNitroPlugin, getH3App } from "@agent-native/core/server";

import {
  studioCapabilityGuard,
  studioUploadStatusHandler,
} from "../lib/studio-capability-handler.js";
import { installStudioStoragePolicy } from "../lib/studio-storage.js";

/** Register synchronously before Core routes in both dev and deployed Nitro. */
export default defineNitroPlugin((nitro) => {
  installStudioStoragePolicy();
  const app = getH3App(nitro);
  app.use(studioCapabilityGuard);
  app.use("/_agent-native/file-upload/status", studioUploadStatusHandler);
});
