# UI Spec Studio

要件定義フェーズのUI仕様モデルをYAMLで管理し、画面遷移とワイヤーフレームを人間とAIエージェントが共同レビューできるAgent-Nativeアプリです。

## Quick start

```bash
pnpm install
AUTH_DISABLED=true pnpm dev
```

開発サーバーを起動したら `/spec` を開きます。`/home` の組み込みエージェントチャットからも、同じ共有アクションを呼び出せます。

## Shared actions

- `spec-load` — 共有YAMLとレビュー状態を読み込む
- `spec-update` — YAMLを保存する
- `spec-validate` — Zodスキーマ、ID重複、遷移先を検証する
- `spec-render-wireframe` — ワイヤーフレームHTMLを生成する
- `spec-render-flow` — Mermaidの画面遷移図を生成する
- `spec-review` — 承認または変更依頼とコメントを保存する

アクションの実装は `actions/`、YAML形式とサンプルは `docs/spec-format.md`、`specs/example.yaml` を参照してください。ローカル開発ではPGliteが `data/pglite` に共有データを保存します。
