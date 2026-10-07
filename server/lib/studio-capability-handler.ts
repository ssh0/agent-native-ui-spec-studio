import { getSession, runWithRequestContext } from "@agent-native/core/server";
import { createError, defineEventHandler, getRequestURL } from "h3";

import { isDisabledStudioRoute } from "../../shared/studio-capabilities.js";
import { s3StorageAvailable } from "./studio-storage.js";

export const studioCapabilityGuard = defineEventHandler((event) => {
  let path: string;
  try {
    path = decodeURIComponent(getRequestURL(event).pathname).replace(
      /\/{2,}/g,
      "/",
    );
  } catch {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid request path",
    });
  }
  if (isDisabledStudioRoute(path))
    throw createError({
      statusCode: 404,
      statusMessage: "This capability is not available in UI Spec Studio",
    });
});

/** Truthful availability: never expose the routing policy as configured storage. */
export const studioUploadStatusHandler = defineEventHandler(async (event) => {
  const session = await getSession(event);
  if (!session?.email)
    throw createError({
      statusCode: 401,
      statusMessage: "Authentication required",
    });
  const configured = await runWithRequestContext(
    { userEmail: session.email, orgId: session.orgId },
    () => s3StorageAvailable(),
  );
  return {
    configured,
    activeProvider: configured
      ? { id: "s3", name: "S3-compatible object storage" }
      : null,
    providers: [{ id: "s3", name: "S3-compatible object storage", configured }],
    builderConfigured: false,
    builderUploadConfigured: false,
    builderReauthorizationRequired: false,
  };
});
