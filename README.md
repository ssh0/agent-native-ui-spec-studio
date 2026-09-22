# UI Spec Studio

要件定義フェーズのUI仕様モデルをYAMLで管理し、画面遷移とワイヤーフレームを人間とAIエージェントが共同レビューできるAgent-Nativeアプリです。

## 開発を始める

```bash
pnpm install
AUTH_DISABLED=true pnpm dev
```

開発サーバーを起動したら `/spec` を開きます。`/home` の組み込みエージェントチャットからも、同じ共有アクションを呼び出せます。

## 共有アクション

- `spec-load` — 共有YAMLとレビュー状態を読み込む
- `spec-update` — YAMLを保存する
- `spec-validate` — 必須構造、ID重複、段階間の参照を検証する
- `spec-render-wireframe` — ワイヤーフレームHTMLを生成する
- `spec-render-flow` — 画面遷移・ユースケースの分岐／例外・画面状態をMermaidで描画する
- `spec-edit` — 段階・画面・部品・遷移を編集する
- `spec-review` — 判断・コメント・対象段階と文書ハッシュを履歴に残す

アクションの実装は `actions/`、YAML形式とサンプルは `docs/spec-format.md`、`specs/example.yaml` を参照してください。ローカル開発ではPGliteが `data/pglite` に共有データを保存します。

仕様は `version: "2.0"` の必須構造を使用します。旧形式の自動変換はありません。1920×1080での確認手順は [スタジオ実機確認](docs/studio-review.md) を参照してください。
