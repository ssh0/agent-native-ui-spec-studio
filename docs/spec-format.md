# UI specification YAML format

UI Spec Studio stores one UI specification as YAML. The same document is read
and updated by the editor and by the `spec.*` agent actions, so an agent can
make a change and a person can review the rendered result immediately.

## Top-level document

```yaml
version: "1.0"
title: Product name
screens: []
transitions: []
```

- `version` (string, optional): format version. It defaults to `1.0`.
- `title` (string, required): name shown in the studio.
- `screens` (array, required): screen definitions. At least one screen is
  required.
- `transitions` (array, optional): links between screens. It defaults to an
  empty array.

## Screens

Each screen has a unique `id`, a `title`, optional `description`, and a
`components` array:

```yaml
screens:
  - id: dashboard
    title: Dashboard
    description: A quick overview of work.
    components:
      - type: text
        id: heading
        content: Welcome
```

The validator reports duplicate screen IDs and duplicate component IDs within
a screen. IDs should be stable kebab-case names because they are referenced by
transitions and actions.

## Components

Every component has a unique (within its screen) `id` and one of these `type`
values: `button`, `text`, `input`, `image`, `toggle`, `select`, `link`, `card`,
`list`, `divider`, or `navigation`.

Common fields:

| Field | Type | Meaning |
| --- | --- | --- |
| `label` | string | Human-facing label for controls, links, lists, and cards |
| `content` | string | Text content for text-like components |
| `action` | string | Stable action/event name, such as `save-task` |
| `placeholder` | string | Input hint |
| `src` | string | Image URL or design reference |
| `options` | string[] | Options for `select` components |
| `required` | boolean | Whether an input is required |
| `props` | map | Additional presentation metadata for the renderer |

Unknown component fields are preserved for forward-compatible metadata, while
`type` and `id` remain required.

## Transitions

Transitions connect existing screens and describe what causes navigation:

```yaml
transitions:
  - from: dashboard
    to: create-task
    trigger: new-task.click
```

`from` and `to` must match screen IDs. `trigger` is a human-readable event
name, normally `<component-id>.<event>`.

## Validation and rendering

`spec.validate` parses YAML, checks the Zod schema, and checks relationships
(screen IDs, component IDs, and transition endpoints). `spec.renderWireframe`
returns a self-contained HTML fragment suitable for the preview pane.
`spec.renderFlow` returns Mermaid `flowchart TD` text for a transition diagram.

The checked-in reference document is [`specs/example.yaml`](../specs/example.yaml).
The executable schema and relationship checks live in
[`shared/spec-schema.ts`](../shared/spec-schema.ts).
