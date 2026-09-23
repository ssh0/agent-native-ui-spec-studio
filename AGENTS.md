# Chat — Agent Guide

Chat is the minimal chat-first agent-native app. The public root is a marketing
surface; the authenticated chat app starts at `/home`. Actions carry the real
capabilities, and screens exist only where a workflow needs durable UI around
the conversation.

## Skills

The default app skill surface is intentionally small. Promotion, learning,
translation, changelog, provider, and release workflows are optional; enable
the matching skill only when this app actually uses that workflow. The
`docs-search` action reads the version-matched framework docs bundled with
`@agent-native/core`; `source-search` reads core and first-party template
implementations. Prefer both over memory when package APIs, actions, or agent
surfaces are involved.

## Core Rules

- UI feedback: target 100 ms, never exceed 400 ms; acknowledge before network work.
- Follow the root framework contract: data in SQL, actions first, application
  state for navigation/selection, and shared agent chat for AI work.
- Store large file/blob payloads in configured file/blob storage, not SQL: no
  base64, `data:` URLs, images, video/audio, PDFs, ZIPs, screenshots,
  thumbnails, or replay chunks in app tables, `application_state`, `settings`,
  or `resources`; persist URLs, ids, or handles instead.
- Never hardcode API keys, tokens, webhook URLs, signing secrets, private
  Builder/internal data, customer data, or credential-looking literals. Use
  secrets/OAuth/runtime configuration and obvious placeholders in examples.
- For external integrations, inspect the workspace/provider connection catalog
  first. Reuse an existing connection and its scoped credential resolver; only
  use app-local vault/OAuth/settings primitives when no reusable connection
  exists. Keep custom setup UI provider-specific and never duplicate storage.
- Keep actions deterministic and focused. Research, analysis, generation,
  recommendation, and synthesis start in the AgentSidebar and let the agent
  orchestrate its tools; follow-ups stay in the same thread rather than moving
  the user to a second freeform prompt box.
- Never fabricate. If an action fails or data is missing, say so and recover
  instead of inventing a result or claiming success.
- Verify a write before reporting it done — re-read the row or the screen.
- Use `view-screen` or application state when the active page/selection is
  unclear.

For a custom app, keep `server/plugins/config.ts` aligned with the product
brand. Its `app.name` is used in transactional emails, and its optional
`app.logoUrl` can point to an absolute HTTPS logo URL.

## UI Spec Studio

Projects are listed by `project-list` and created by `project-create` (`name`).
The UI starts at `/projects`; opening a project resumes its scoped chat. The
legacy `ui_specs/default` document is claimed by the first authenticated opener
as 「以前のプロジェクト」, with its existing unscoped chat history. New chat threads use
Core's `ui-spec-project` scope. A project's URL carries `?project=<id>` and
`navigation.projectId` exposes the selection to the agent. Pass that `projectId`
to every spec action; all spec actions verify ownership. Use the chat composer
`+` to attach reference files through Core's upload mechanism. Begin new
projects by discussing the product in chat, then save a valid rough 2.0 YAML
with `spec-update` before sending the user to the editor.

The `/spec` workspace follows data → flows → use cases (including branches and exceptions) → screens/state flows → component actions. Use the required version 2.0 structure in `docs/spec-format.md`; empty arrays represent unfinished stages, including screens. That document owns the reference rules and review-history semantics. Keep decisions in stage `notes`.

Use `spec-load`, `spec-update`, `spec-validate`, `spec-render-wireframe`, `spec-render-flow`, and `spec-review` for the shared workflow. `spec-edit` supports focused CRUD and `set_section` for domain/flows/useCases; `spec-render-flow` accepts flows/screens/useCases/states. Business steps use typed participant references from `domain.actors` / `domain.externalSystems`; see `docs/spec-format.md` for lane semantics. Navigation exposes stage, selected ID and editing mode. Preserve notes and existing stages during edits; review only saved, valid content.

## Application State

- `navigation` describes the current view and selected entity ids. The default
  chat view is `chat` at `/home`; `/` is the public SSR marketing page.
- `navigate` moves the UI when the app supports it.
- `view-screen` is the first tool to call when the user's visible context
  matters.
- `provider-api-request` calls Slack through the shared workspace connection.
  Use `provider: "slack"` and an exact Web API path such as `/auth.test`.
  Missing access pauses the run and opens the contextual connection card; do
  not ask the user to paste credentials or replace the request with prose.

## Source Changes

Before building common workspace or agent UI, read `agent-native-toolkit`; read
`customizing-agent-native` before adapting shared UI.

- Guarded verification: run `pnpm agent-native:doctor`; fix findings before done.
- `server/agent/provider-safe-engine.ts` keeps OpenAI-compatible tool names valid
  when replaying older thread history; retain it when action names change.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
