# Provider model catalogs and personal scopes

`provider-model-catalog` discovers models through the same request-scoped
`resolveSecret` used by Core's engine registry. The installed workspace
connection catalog has no interchangeable LLM API-key connection (Anthropic
Managed Agents is a different service), so the existing shared secret resolver
is retained. No connection records or secrets are copied.

## Refresh and storage

Opening a connected provider in **Settings → AI & models** reads its catalog.
Successful responses are cached for one hour in Core's SQL-backed user settings,
partitioned by active organization and provider. There is no scheduler, manual
force-refresh control, or idle provider polling. Changing providers or reopening
settings after expiry triggers the next refresh. Provider requests have a
20-second total timeout, bounded pagination and no redirects.

`model-scope-list` reads saved scopes/catalogs without provider HTTP calls; chat
uses it via Core action queries and SSE/poll invalidation. `model-scope-update`
writes and re-reads personal scopes. `null` means all models, including later
discoveries; `[]` means none. A catalog refresh never rewrites a scope or a
conversation's selection. Missing scoped IDs stay in settings but are not offered
as available. The chat picker includes only checked IDs for a scoped provider; a
current selection outside the scope is not inserted as an option. Scopes are
picker preferences, not an API authorization boundary or shared model defaults.
Only Settings can write scopes; chat agents cannot invoke `model-scope-update`. Read-only catalog and scope-list actions may remain
available to the agent.

Before the first successful fetch, no unverified fallback models are offered;
settings show loading or not-yet-loaded state, and the chat picker withholds
provider models until a catalog is cached. An actual empty catalog remains empty.
Refresh failures retain the last successful catalog and saved scope and show a
retry message. While a scope read fails, chat offers no models rather than
accidentally showing excluded models. Core's model/runtime adapters and
AgentSidebar's host catalog prop are used; no framework packages are patched.

Custom OpenAI gateways are explicitly not queried: their credentials must never
be sent to the official OpenAI origin. They retain the existing custom-model
entry path, and Settings lets users add those IDs to a personal scope when no
catalog can be fetched. The scope editor can also restore `null` to allow current
and future models; clearing every checkbox saves `[]` instead. Ollama appears
separately in Settings and lists installed chat models from the configured
Ollama instance, not every model available to pull. Embedding-only model IDs are
excluded from fresh and cached catalogs. Local
loopback endpoints use Ollama's official `/api/tags` API; remote Ollama endpoints
must use HTTPS and pass Core's shared SSRF-safe fetch. API availability and tool
support can still vary by account; model-list membership does not guarantee a
successful agent run.

## Official sources and labels

Catalog APIs inspected for this implementation:

| Provider   | Source                                                         | Metadata used                                                                                                                                                                                                                                |
| ---------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Anthropic  | https://platform.claude.com/docs/en/api/models/list            | `id`, `display_name`, `created_at`; `after_id` pagination. API documents newest releases first.                                                                                                                                              |
| OpenAI     | https://platform.openai.com/docs/api-reference/models/object   | `id`, `created`; no general chat-capability flag. Known non-chat families are excluded, not silently presented as chat models.                                                                                                               |
| OpenRouter | https://openrouter.ai/docs/api/api-reference/models/get-models | `id`, `name`, `created`, output modalities; `sort=top-weekly` is documented as tokens processed in the last week. The first five API positions retain their provider ranks after non-chat models are filtered; no usage counts are invented. |
| Google     | https://ai.google.dev/api/models                               | `name`, `displayName`, `supportedGenerationMethods`; filter `generateContent`, follow `nextPageToken`. No release date or popularity rank is inferred from model IDs.                                                                        |
| Groq       | https://console.groq.com/docs/api-reference#models             | `id`, `created`, `active`; known audio-only families excluded.                                                                                                                                                                               |
| Mistral    | https://docs.mistral.ai/api/endpoint/models                    | `id`, `name`, `created`, `capabilities.completion_chat`.                                                                                                                                                                                     |
| Cohere     | https://docs.cohere.com/reference/list-models                  | `name`; request `endpoint=chat`, follow `next_page_token`.                                                                                                                                                                                   |
| Ollama     | https://docs.ollama.com/api/tags                               | Chat-compatible `models[].name` entries from the configured endpoint's installed local models. `modified_at` describes local model metadata time, not the model's release date; no popularity rank is inferred.                              |

“Newest catalog entry” means the largest actual creation/release timestamp in
the returned catalog, not a recommendation or a quality claim. OpenRouter's
weekly rank is traffic-based and attributed to OpenRouter. Other providers do
not supply comparable popularity ranking in the inspected catalog responses;
no “popular” or “featured” label is invented for them.

Run `pnpm test`, `pnpm typecheck`, and `pnpm agent-native:doctor`. Tests use
fabricated catalog responses and credentials only; live account availability
requires a configured provider and is not part of local deterministic checks.
