import { useT } from "@agent-native/core/client/i18n";
import { HeaderActionsProvider } from "@agent-native/toolkit/app-shell/header-actions";
import { IconMenu2 } from "@tabler/icons-react";
import { lazy, Suspense, useEffect, useState } from "react";
import { useLocation } from "react-router";

import { ChatPaneContext } from "@/components/chat/ChatPaneControl";
import { PersistentProjectChat } from "@/components/chat/PersistentProjectChat";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { APP_TITLE } from "@/lib/app-config";

import { Sidebar } from "./Sidebar";

const Header = lazy(() =>
  import("./Header").then((module) => ({ default: module.Header })),
);

interface LayoutProps {
  children: React.ReactNode;
}

const SIDEBAR_COLLAPSE_KEY = "chat.sidebar.collapsed";

/**
 * Routes whose page renders its own toolbar. Layout still wraps these with the
 * left Sidebar and agent surfaces but skips the global Header so they don't
 * double-stack chrome.
 */
function routeOwnsToolbar(pathname: string): boolean {
  return (
    pathname === "/home" ||
    pathname.startsWith("/chat/") ||
    pathname === "/database" ||
    pathname === "/spec" ||
    pathname.startsWith("/extensions")
  );
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const t = useT();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const sync = () => setNarrow(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [paneOpen, setPaneOpen] = useState(false);
  const projectId = new URLSearchParams(location.search).get("project") ?? "";
  useEffect(() => setPaneOpen(false), [projectId]);
  const isSpecRoute = location.pathname === "/spec";
  const isChatRoute =
    location.pathname === "/home" || location.pathname.startsWith("/chat/");

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const closeMobileSidebar = () => setMobileSidebarOpen(false);
    window.addEventListener("agent-chat:open-thread", closeMobileSidebar);
    return () => {
      window.removeEventListener("agent-chat:open-thread", closeMobileSidebar);
    };
  }, []);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(SIDEBAR_COLLAPSE_KEY);
      if (stored !== null) setSidebarCollapsed(stored === "1");
    } catch {
      // Ignore storage access errors; the default collapsed state still works.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        SIDEBAR_COLLAPSE_KEY,
        sidebarCollapsed ? "1" : "0",
      );
    } catch {
      // Ignore storage access errors.
    }
  }, [sidebarCollapsed]);

  const ownsToolbar = routeOwnsToolbar(location.pathname);
  const contentFrame = (
    <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
      {isSpecRoute ? null : isChatRoute ? (
        <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-card px-3 md:hidden">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setMobileSidebarOpen(true)}
            aria-label={t("navigation.openNavigation")}
          >
            <IconMenu2 className="size-4" />
          </Button>
          <span className="truncate text-sm font-semibold">{APP_TITLE}</span>
        </div>
      ) : ownsToolbar ? (
        <div className="flex h-12 shrink-0 items-center border-b border-border px-4 md:hidden">
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(true)}
            aria-label={t("navigation.openNavigation")}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <IconMenu2 className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <Suspense fallback={<div className="h-12 shrink-0" />}>
          <Header onOpenMobileSidebar={() => setMobileSidebarOpen(true)} />
        </Suspense>
      )}
      <main className="agent-native-app-main min-w-0 flex-1 overflow-y-auto overscroll-contain">
        {children}
      </main>
    </div>
  );

  return (
    <ChatPaneContext.Provider
      value={{
        open: paneOpen,
        enabled: Boolean(projectId),
        toggle: () => {
          if (paneOpen) {
            document
              .querySelector<HTMLElement>(
                "[data-chat-pane-toggle]:not(#project-chat-pane *)",
              )
              ?.focus();
          }
          setPaneOpen((open) => !open);
        },
      }}
    >
      <HeaderActionsProvider>
        <div className="agent-layout-shell chat-layout-shell flex h-screen w-full overflow-hidden bg-background text-foreground">
          <div
            data-collapsed={narrow || sidebarCollapsed ? "true" : "false"}
            className="agent-layout-left-drawer block"
          >
            <Sidebar
              collapsed={narrow || sidebarCollapsed}
              onCollapsedChange={(collapsed) =>
                narrow
                  ? setMobileSidebarOpen(true)
                  : setSidebarCollapsed(collapsed)
              }
            />
          </div>
          <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
            <SheetContent
              side="left"
              className="w-[var(--chat-sidebar-width)] p-0"
            >
              <SheetTitle className="sr-only">
                {t("navigation.navigation")}
              </SheetTitle>
              <SheetDescription className="sr-only">
                {t("navigation.navigationDescription")}
              </SheetDescription>
              <Sidebar collapsed={false} collapsible={false} />
            </SheetContent>
          </Sheet>
          <div
            data-agent-chat-canvas={isChatRoute ? "true" : undefined}
            className="agent-layout-main-surface flex min-w-0 flex-1 overflow-hidden"
          >
            <div
              className={
                isChatRoute
                  ? "hidden"
                  : "flex min-w-0 flex-1 flex-col overflow-hidden"
              }
            >
              {contentFrame}
            </div>
            <PersistentProjectChat
              paneOpen={paneOpen}
              onPaneOpenChange={setPaneOpen}
              onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
            />
          </div>
        </div>
      </HeaderActionsProvider>
    </ChatPaneContext.Provider>
  );
}
