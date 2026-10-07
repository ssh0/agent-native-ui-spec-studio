import { useT } from "@agent-native/core/client/i18n";
import {
  getDefaultMcpIntegrations,
  isMcpIntegrationUrl,
} from "@agent-native/core/client/resources/mcp-integration-catalog";
import type { McpServer } from "@agent-native/core/client/resources/use-mcp-servers";
import {
  IntegrationGrid,
  McpServerRows,
  startMcpOAuthReconnect,
  useMcpIntegrationsController,
} from "@agent-native/toolkit/app/integrations";
import {
  McpIntegrationDialog,
  McpIntegrationLogo,
} from "@agent-native/toolkit/app/resources";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function studioIntegrationCatalog() {
  return getDefaultMcpIntegrations().filter(
    (entry) => entry.id !== "builder-cms",
  );
}

export function isStudioIntegrationServer(server: Pick<McpServer, "url">) {
  try {
    const hostname = new URL(server.url).hostname.toLowerCase();
    return hostname !== "builder.io" && !hostname.endsWith(".builder.io");
  } catch {
    // Keep custom transports; the shared controller validates their configuration.
    return true;
  }
}

/** Keep Core's connection controller/dialogs; only the product catalog differs. */
export function StudioIntegrationsSettings() {
  const t = useT();
  const catalog = useMemo(studioIntegrationCatalog, []);
  const mcp = useMcpIntegrationsController({ integrations: catalog });
  const [query, setQuery] = useState("");
  const servers = mcp.servers.filter(isStudioIntegrationServer);
  const visibleCatalog = catalog.filter((entry) =>
    `${entry.name} ${entry.description} ${entry.useCase}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          type="search"
          aria-label={t("settings.integrationSearch")}
          placeholder={t("settings.integrationSearch")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <Button onClick={() => mcp.openCatalog()}>
          {t("settings.integrationAdd")}
        </Button>
      </div>
      {mcp.serversQuery.isError ? (
        <div role="alert">
          <p>{t("settings.integrationLoadError")}</p>
          <Button
            variant="outline"
            onClick={() => void mcp.serversQuery.refetch()}
          >
            {t("settings.retry")}
          </Button>
        </div>
      ) : mcp.serversQuery.isLoading ? (
        <p role="status">{t("settings.integrationLoading")}</p>
      ) : servers.length > 0 ? (
        <McpServerRows
          servers={servers}
          role={mcp.serversQuery.data?.role}
          deleteTarget={mcp.deleteTarget}
          deletePending={mcp.deleteServer.isPending}
          reconnectingKey={mcp.reconnectingKey}
          reconnectError={mcp.reconnectError}
          onRemove={(server) => void mcp.removeServer(server)}
          onReconnect={(server) =>
            server.authMode === "oauth"
              ? startMcpOAuthReconnect(server)
              : void mcp.reconnect(server)
          }
        />
      ) : null}
      {mcp.deleteError ? <p role="alert">{mcp.deleteError}</p> : null}
      <IntegrationGrid
        variant="rows"
        emptyLabel={t("settings.integrationEmpty")}
        items={visibleCatalog.map((entry) => {
          const connected = servers.some(
            (server) =>
              server.status.state === "connected" &&
              isMcpIntegrationUrl(entry, server.url),
          );
          return {
            id: entry.id,
            name: entry.name,
            description: entry.description || entry.useCase,
            logo: (
              <McpIntegrationLogo
                name={entry.name}
                logoUrl={entry.logoUrl}
                integrationId={entry.id}
              />
            ),
            status: connected ? t("settings.integrationConnected") : undefined,
            actionKind: connected ? "manage" : "connect",
            actionLabel: connected
              ? t("settings.integrationManage")
              : t("settings.integrationConnect"),
            onAction: () => mcp.openConnection(entry.id, connected),
          };
        })}
      />
      <McpIntegrationDialog
        open={mcp.dialogOpen}
        onOpenChange={(open) => {
          mcp.setDialogOpen(open);
          if (!open) {
            mcp.setInitialIntegrationId(null);
            mcp.setConnectIntegrationId(null);
          }
        }}
        initialIntegrationId={mcp.initialIntegrationId}
        connectIntegrationId={mcp.connectIntegrationId}
        defaultScope="user"
        canCreateOrgMcp={mcp.canCreateOrgMcp}
        hasOrg={mcp.hasOrg}
        onCreateMcpServer={(args) => mcp.createServer.mutateAsync(args)}
        integrations={catalog}
      />
    </section>
  );
}
