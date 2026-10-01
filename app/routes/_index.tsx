import { appPath } from "@agent-native/core/client/api-path";

import { Button } from "@/components/ui/button";
import { APP_TITLE } from "@/lib/app-config";

const SEO_TITLE = APP_TITLE + " - Open Source AI app starter with actions";
const SEO_DESCRIPTION =
  "Open Source starter for agent-native apps with durable chat, shared actions, UI state, tools, and a backend your agent can extend.";

export function meta() {
  return [
    { title: SEO_TITLE },
    { name: "description", content: SEO_DESCRIPTION },
    { property: "og:title", content: SEO_TITLE },
    { property: "og:description", content: SEO_DESCRIPTION },
    { name: "twitter:card", content: "summary" },
    { name: "twitter:title", content: SEO_TITLE },
    { name: "twitter:description", content: SEO_DESCRIPTION },
  ];
}

export default function MarketingHomeRoute() {
  return (
    <main
      className="min-h-screen bg-background text-foreground"
      data-agent-native-marketing-home
    >
      <section className="mx-auto flex min-h-screen max-w-7xl flex-col justify-center px-6 py-16 sm:px-10 lg:px-16">
        <p className="text-sm font-medium text-primary">{APP_TITLE}</p>
        <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">
          Start from a chat-first agent-native app and add actions, screens, and
          workflows as you grow.
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
          {SEO_DESCRIPTION}
        </p>
        <ul className="mt-10 grid gap-4 sm:grid-cols-2">
          {[
            "Full-page chat with durable threads and tool call history",
            "Use shared actions from chat, UI, HTTP, MCP, A2A, and CLI",
            "Plug in your own agent runtime or use the included app-agent loop",
          ].map((value) => (
            <li
              key={value}
              className="rounded-xl border border-border p-4 text-sm font-medium"
            >
              {value}
            </li>
          ))}
        </ul>
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Button asChild size="lg">
            <a href={appPath("/projects")}>Open {APP_TITLE}</a>
          </Button>
          <Button asChild size="lg" variant="outline">
            <a href={appPath("/sign-in")}>Sign in</a>
          </Button>
        </div>
      </section>
    </main>
  );
}
