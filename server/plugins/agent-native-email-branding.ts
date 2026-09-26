import { defineAppConfig } from "@agent-native/core/server";

import { appBuiltInEngines } from "../lib/agent-engine-policy.js";

export default defineAppConfig({
  agent: {
    builtInEngines: [...appBuiltInEngines],
    preferBringYourOwnKey: true,
  },
  app: {
    // This name appears in transactional emails. Change it to your product name.
    name: "Ui Spec Studio",
    // The source template keeps a renamed app from inheriting first-party email branding.
    sourceTemplate: "chat",
    // Keep the template's authenticated entry explicit after renaming the app.
    homePath: "/projects",
    // Optional: use your own absolute HTTPS logo URL in transactional emails.
    // logoUrl: "https://example.com/logo.png",
  },
});
