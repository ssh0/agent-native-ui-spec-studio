type ScopedThread = {
  id: string;
  updatedAt: number;
  scope: { type: string; id: string } | null;
};

export async function selectProjectThread(
  projectId: string,
  rememberedId: string | null,
  threads: ScopedThread[],
  exists: (threadId: string, projectId: string) => Promise<boolean>,
): Promise<string | null> {
  if (rememberedId && (await exists(rememberedId, projectId)))
    return rememberedId;
  const latest = threads
    .filter((thread) =>
      projectId === "default"
        ? !thread.scope
        : thread.scope?.type === "ui-spec-project" &&
          thread.scope.id === projectId,
    )
    .sort((a, b) => b.updatedAt - a.updatedAt)[0];
  return latest?.id ?? null;
}
