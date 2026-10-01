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

### プロジェクトの入口 `/projects`

- 新規作成と既存再開を明確に分ける。新規作成は名前を入力してチャットへ進み、既存は一覧から直接再開する。
- 左レールは現在のプロジェクトとその会話履歴を示す。プロジェクトの切替は一覧に戻って行い、仕様画面と会話画面では同じ選択を保つ。
- 参考資料は共有チャットの添付コントロールで扱う。ファイルの状態と失敗はチャット内に表示し、独立した資料ストアは作らない。

- Mode: `operate`。業務担当者・設計者が毎日仕様を検討し、人とエージェントが同じモデルを編集する。
- Direction: 「仕様検討デスク」。共有チャットの静かな配色・semantic tokensを維持し、仕様画面は整列した高密度の作業領域とする。
- 1920×1080では左208pxの段階ナビ、可変中央編集領域、右300pxの検証・レビュー・履歴。領域ごとにスクロールし、保存と現在段階は常に見える。
- 日本語サンセリフ、本文13px、見出し16px、行間1.6。小さな角丸と境界線。大型ヒーロー、装飾カード、重複サマリーは置かない。
- 選択案: 5段階を自由に行き来できるワークスペース。ウィザードは既存仕様の反復編集に不向き、一枚の長いフォームは画面外に重要操作が流れるため採用しない。
- 業務データはフォームと構造ビューで検討。複雑な入れ子は段階別YAML編集へ段階的に開示し、全文YAMLも残す。画面／アクションは専用Builder。
- 図はユースケースの分岐・例外、画面間遷移、画面内状態を同じモデルから生成。Mermaidの自由編集は試作扱いで保存仕様とは区別する。
- 過程は段階ごとのnotesと対象段階・文書ハッシュ付きレビュー履歴に限定する。全文の版管理は今後の別機能。
- アプリの左レールは仕様・会話画面でも常設する。狭い画面はアイコンレールと展開用Sheetを使い、仕様の段階ナビは横並び、検証欄は下段へ移す。
- プロジェクトのチャットは一つのAgentKit所有者を保ち、右ペインと拡大表示を切り替える。開閉は共通コントロール、拡大から戻る場合は元の作業画面へ戻す。フォーム・レビューはライト／ダーク共通のsemantic tokensと控えめな境界線を使う。
- 形式の正は `docs/spec-format.md`。サンプルと初期文書は同一内容をテストで保証。

### 必須構造と段階的な検討

- YAMLはversion 2.0に固定する。domain／flows／useCases／screens／transitionsを省略できない構造とし、旧形式の補完は行わない。
- 構造は必須、検討内容は空配列から始める。画面を先に作る制約はなく、全段階が空でも保存・検証できる。検証は形式と参照を確認し、検討の網羅性は人がレビューする。
- 各画面のstateFlowも明示し、未検討はinitial: nullと空のstates／transitionsで表す。状態を定義したら初期状態も指定する。
- 未定義キーはエラーにして、誤記による情報の欠落を防ぐ。拡張メタデータは部品のpropsに集約する。
- 実機確認の手順と観点は `docs/studio-review.md` を参照。

## テーマとモーション（#42）

- 既存のToolkit/shadcnアダプターを維持し、`app/design-system.ts` に「UI Spec Studio」として登録する。新しいUIライブラリや第二のデザインシステムは導入しない。
- テーマの一覧・モードは `app/lib/studio-themes.ts`、配色・境界・モーションの正は `app/studio-design.css`。ドメイン画面も共有チャットも同じsemantic tokensを使う。設定の「テーマ」とコマンドメニューから8配色を選ぶ。
- ライト／ダークは中立色、ハイコントラストは黒地・白文字・黄アクセント。Solarized、Flexoki、GitHubは各パレットに沿い、補助文字と境界は読みやすさを優先して調整する。Flexokiは今回ライト配色のみ。配色の再現より本文・補助文字・ボタン文字の4.5:1、境界の3:1を優先し、パレット値をテストする。
- テーマはブラウザー単位の表示設定として保存する（仕様データやSQLには書かない）。Core/next-themesがライト／ダークのモードを管理し、アプリは検証済みの配色IDだけを別キーで保持する。保存不可でもそのタブでは切替可能。保存された配色を初回描画前に復元し、OS・埋め込み元のモードが変わった場合は対応するライト／ダークへ戻す。
- ナビゲーションと本体、右チャットペインの境界に共通のエッジと控えめな影を使う。狭い画面のSheetと固定チャットペインの既存レイアウトは維持する。
- 押下は100ms、検討対象・画面の更新は160ms、ペイン開閉は220ms。CSS View Transition APIのスナップショットによる切替を用い、共有easing tokensを使う。通常のCSS transitionは押下のtransform・背景色に限定し、幅や高さを直接transitionしない。
- ペイン開閉は `transitionStudioView`、画面・検討対象の切替は既存のReact Router `viewTransition` が担当する。文字入力・チャットストリーム・通常のデータ同期ではアニメーションを開始しない。コマンドメニューには独自の開閉アニメーションを追加しない。
- `prefers-reduced-motion` ではスナップショットと押下の動きを無効化。API未対応では通常の即時更新に戻す。連続操作は古いアニメーションをスキップし、ネットワーク完了を待ってから描画する方式にはしない。
