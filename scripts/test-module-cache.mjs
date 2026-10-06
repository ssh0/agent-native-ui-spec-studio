// Cache compiled Node modules, never test results or mutable module instances.
// Preloaded separately in each isolated test worker; production is unaffected.
import { enableCompileCache, constants } from "node:module";

const result = enableCompileCache(".tmp/node-test-cache");
if (result.status === constants.compileCacheStatus.FAILED)
  throw new Error("Test module compile cache failed: " + result.message);
// Respect a host/CI decision to disable the Node compile cache.
