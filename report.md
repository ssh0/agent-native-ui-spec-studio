# UI Spec Studio 品質評価と構成整理

## 評価の根拠

- 変更前の `app/components/spec-studio/stage-content.tsx` は約2,000行で、共通表示部品、domain 編集、flows/useCases 表示、screens/actions 編集、Mermaid の一時編集を同じモジュールに持っていた。たとえば domain の参照判定と screen の遷移編集が同じファイルにあり、段階ごとの変更でも広い範囲を読む必要があった。
- `app/routes/spec.tsx` は YAML 下書き、保存時の競合検出、レビュー、ナビゲーション、検証表示をまとめて管理している。今回は挙動を変えず、編集部品への import だけを明確にした。
- 仕様の解析・参照検証・図の生成は `shared/spec-schema.ts`、`shared/spec-utils.ts`、`shared/spec-edit.ts` に既に分かれていたため、これらには新しい抽象化を加えなかった。
- 既存のテストは共有仕様ロジックと agent provider を対象としており、編集 UI のモジュール構成を直接確認していなかった。

## 変更した責務境界

| ファイル | 責務 |
| --- | --- |
| `app/components/spec-studio/stage-content.tsx` | 段階の振り分けと flows/useCases の表示・編集。domain と screens/actions は各モジュールへ委譲する。 |
| `app/components/spec-studio/domain-content.tsx` | entities、terms、relations、actors、externalSystems の編集と domain 内参照の確認。集合式エディターも domain に置く。 |
| `app/components/spec-studio/screen-builder.tsx` | screens/actions の編集、画面遷移、ワイヤーフレーム・図の表示切替。 |
| `app/components/spec-studio/diagram.tsx` | Mermaid 図の表示と保存しない一時的なソース編集。 |
| `app/components/spec-studio/spec-editor-ui.tsx` | 段階間で共有するフィールド、参照表示、空状態、アクター選択、YAML 入力など。 |
| `app/routes/spec.tsx` | 共通入力部品を直接 import し、段階コンテンツのモジュールを画面全体の部品の窓口として使わない。 |
| `app/components/spec-studio/stage-content.test.tsx` | 5段階それぞれが分割後も仕様データから表示されることをサーバー描画で確認。 |

分割は既存の JSX と更新処理を移したもので、表示文言、YAML 形式、保存・レビューの action、データ構造は変更していない。共通部品は複数段階から使用されるものに限り、domain 専用の参照判定は domain 側に置いた。段階ごとの機能追加時に、主に該当モジュールを変更すればよい構成を選んだ。

## 実行した確認と結果

| コマンド | 結果 |
| --- | --- |
| `pnpm test` | この環境に `pnpm` コマンドがなく実行不可。以降は既存の npm scripts を使用。 |
| `npm test`（追加前） | 既存3ファイル、69テスト通過。 |
| `npm test -- app/components/spec-studio/stage-content.test.tsx` | 追加した5ケース通過。 |
| `npm test`（追加後） | 4ファイル、74テスト通過。 |
| `npm run agent-native:doctor` | 12個の guard を実行し、指摘なし。 |
| `npm run typecheck` | 本番用 `BETTER_AUTH_SECRET` と永続 DB URL がローカル環境にないため、framework の本番設定エラーを表示。資格情報をソースへ追加していない。 |
| `./node_modules/.bin/tsc --noEmit` | 終了コード0。TypeScript の検査は通過。 |

## 残る課題・リスク

- `domain-content.tsx` は約860行あり、domain の各編集処理はなお大きい。今回の分割で責務は domain 内に収まったが、domain に機能を追加する際は必要に応じて entity・term・relation 単位での分離を検討できる。
- `spec.tsx` は下書きと保存済み状態の同期、レビュー、URL 選択を一つの画面で扱う。状態遷移を変更する場合は、競合検出と未反映の段階 YAML を含めて確認が必要。
- 追加テストは静的な描画を確認する。入力イベント、保存、図の非同期描画はブラウザ操作では未確認であり、以下の手動受け入れが必要。
- 本番設定を必要とする framework typecheck はこのローカル環境では完了していない。デプロイ環境の設定値は別途確認する。

## 手動受け入れ手順

1. 既存プロジェクトの `/spec?project=<id>` を開き、domain、flows、useCases、screens、actions の各段階で一覧・詳細・参照ラベルが表示されることを確認する。
2. domain で entity、term、relation、actor、externalSystem を編集し、参照中の削除制限と ID 変更時の参照更新を確認する。
3. flows で担当者の種類と参照を変更する。useCases で利用アクター、基本系列、分岐・例外を確認する。
4. screens/actions で画面・部品・遷移を編集し、ワイヤーフレーム、画面遷移図、画面状態図、Mermaid の一時編集を確認する。
5. YAML 直接編集との切替、段階 YAML の反映・キャンセル、保存済みへ戻す操作を確認する。保存後に再読み込みし、レビュー履歴が従来どおり残ることを確認する。
