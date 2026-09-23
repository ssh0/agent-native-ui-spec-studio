import { appBasePath, appPath } from "@agent-native/core/client/api-path";
import { useAgentRouteState } from "@agent-native/core/client/navigation";
import { domainSections, type DomainSection } from "@shared/spec-schema";

import { TAB_ID } from "@/lib/tab-id";

export interface NavigationState {
  view: string;
  path?: string;
  threadId?: string;
  projectId?: string;
  stage?: string;
  section?: string;
  selectedId?: string;
  mode?: string;
}

export function useNavigationState() {
  useAgentRouteState<NavigationState>({
    browserTabId: TAB_ID,
    requestSource: TAB_ID,
    getNavigationState: ({ pathname, searchParams }) => {
      const threadId = threadIdFromPath(pathname);
      const stage = searchParams.get("stage") ?? "domain";
      const section = searchParams.get("section");
      return {
        view: viewForPath(pathname),
        path: appPath(pathname),
        ...(searchParams.get("project")
          ? { projectId: searchParams.get("project")! }
          : {}),
        ...(pathname === "/spec"
          ? {
              stage,
              ...(stage === "domain"
                ? {
                    section: domainSections.includes(section as DomainSection)
                      ? section!
                      : "entities",
                  }
                : {}),
              selectedId: searchParams.get("selected") ?? "",
              mode: searchParams.get("mode") ?? "builder",
            }
          : {}),
        ...(threadId ? { threadId } : {}),
      };
    },
    getCommandPath: (command) =>
      routerPath(command.path || pathForCommand(command)),
  });
}

function threadIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/chat\/([^/]+)/);
  if (!match) return null;
  try {
    const value = decodeURIComponent(match[1]).trim();
    return value || null;
  } catch {
    return null;
  }
}

function viewForPath(pathname: string): string {
  if (pathname.startsWith("/projects")) return "projects";
  if (pathname === "/spec") return "spec";
  if (isChatPath(pathname)) return "chat";
  if (pathname.startsWith("/database")) return "database";
  if (pathname.startsWith("/extensions")) return "extensions";
  if (pathname.startsWith("/observability")) return "observability";
  if (pathname.startsWith("/settings/agent") || pathname.startsWith("/agent")) {
    return "agent";
  }
  if (pathname.startsWith("/settings")) return "settings";
  if (pathname.startsWith("/team")) return "settings";
  return "chat";
}

function pathForView(view?: string): string {
  switch (view) {
    case "projects":
      return "/projects";
    case "chat":
    case "home":
    case "ask":
      return "/home";
    case "spec":
      return "/spec";
    case "database":
      return "/database";
    case "extensions":
      return "/extensions";
    case "observability":
      return "/observability";
    case "agent":
      return "/settings/agent";
    case "settings":
      return "/settings";
    case "team":
      return "/settings/organization";
    default:
      return "/home";
  }
}

function pathForCommand(command: any): string {
  const path = pathForView(command?.view);
  const projectId =
    typeof command?.projectId === "string" ? command.projectId.trim() : "";
  if (path === "/spec" && projectId)
    return `/spec?project=${encodeURIComponent(projectId)}`;
  if (path === "/projects" && projectId)
    return `/projects/${encodeURIComponent(projectId)}`;
  if (path !== "/home") return path;
  const threadId =
    typeof command?.threadId === "string" ? command.threadId.trim() : "";
  return threadId
    ? `/chat/${encodeURIComponent(threadId)}${projectId ? `?project=${encodeURIComponent(projectId)}` : ""}`
    : path;
}

function routerPath(path: string): string {
  const basePath = appBasePath();
  if (!basePath) return path;
  if (path === basePath) return "/";
  if (path.startsWith(`${basePath}/`)) {
    return path.slice(basePath.length) || "/";
  }
  return path;
}

function isChatPath(pathname: string): boolean {
  return pathname === "/home" || pathname.startsWith("/chat/");
}
