# Visual Design Contract

Chat is a quiet, full-canvas conversation workbench. AgentKit owns the
conversation primitives; the template owns the surrounding navigation and
workspace chrome.

## Product mode

- Mode: `operate`
- Audience and cadence: frequent users managing many ongoing agent threads.
- Primary workflow: begin, resume, pin, and organize conversations without
  leaving the chat canvas.

## Visual direction

- Direction name: Quiet conversation library
- Palette family: neutral ink and semantic surfaces; active rows use the
  existing sidebar accent rather than a separate branded color.
- Type treatment: dense sans-serif labels with regular-weight conversation
  titles and restrained section labels.
- Composition: a persistent conversation library beside a generous chat
  canvas. New chat is the primary rail action, followed by Pinned and Recents.
  Account, workspace, settings, and sign-out controls disclose from one footer
  row instead of competing in the rail.
- Shape language: borderless lists, soft selected rows, quiet corners, and
  compact icon controls.
- Anti-references: icon-only navigation as the default state, floating chips,
  duplicated settings links, timestamps competing with thread titles, and
  placeholder destinations that the app does not implement.

## Guardrails

- Preserve the scaffold's semantic tokens and shared component seams.
- Keep domain pages distinct from full-page chat and use the AgentSidebar for
  contextual AI.
- Compare sibling apps before reusing their palette or composition.
- Keep pinning, rename, archive, and routing wired to the shared chat thread
  model; the sidebar is a presentation layer, not a second history store.

## UI仕様スタジオ `/spec`

- Mode: `operate`。業務担当者・設計者が毎日仕様を検討し、人とエージェントが同じモデルを編集する。
- Direction: 「仕様検討デスク」。共有チャットの静かな配色・semantic tokensを維持し、仕様画面は整列した高密度の作業領域とする。
- 1920×1080では左208pxの段階ナビ、可変中央編集領域、右300pxの検証・レビュー・履歴。領域ごとにスクロールし、保存と現在段階は常に見える。
- 日本語サンセリフ、本文13px、見出し16px、行間1.6。小さな角丸と境界線。大型ヒーロー、装飾カード、重複サマリーは置かない。
- 選択案: 5段階を自由に行き来できるワークスペース。ウィザードは既存仕様の反復編集に不向き、一枚の長いフォームは画面外に重要操作が流れるため採用しない。
- 業務データはフォームと構造ビューで検討。複雑な入れ子は段階別YAML編集へ段階的に開示し、全文YAMLも残す。画面／アクションは専用Builder。
- 図はユースケースの分岐・例外、画面間遷移、画面内状態を同じモデルから生成。Mermaidの自由編集は試作扱いで保存仕様とは区別する。
- 過程は段階ごとのnotesと対象段階・文書ハッシュ付きレビュー履歴に限定する。全文の版管理は今後の別機能。
- 狭い画面ではナビを横並びにし、検証欄は下段へ移す。共有AgentSidebarは既存機能をそのまま利用。
- 形式の正は `docs/spec-format.md`。サンプルと初期文書は同一内容をテストで保証。
