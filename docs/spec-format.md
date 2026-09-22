# UI仕様モデル（YAML）

この文書を仕様形式の正とする。実行時のスキーマ・参照検証は
[`shared/spec-schema.ts`](../shared/spec-schema.ts)、動作する一式の例は
[`specs/example.yaml`](../specs/example.yaml) を参照。
UIとエージェントは同じSQL上のYAMLを共有アクションで読み書きする。

## 検討する順序

1. `domain`: 管理対象データの構造・関係・用語を明らかにする。
2. `flows`: ユーザー／業務の流れを整理し、手順をユースケースへ結び付ける。
3. `useCases`: 事前／事後条件、基本系列、状態による分岐・例外を検討する。
4. `screens`: ユースケースを支える画面単位の機能と画面内状態遷移を定義する。
5. `screens[].components`: 画面内の操作、前提条件、結果を定義する。

これは編集の推奨順であり、段階を強制的にロックしない。未検討の段階は未定義のままにできる。
各段階の `notes` は決定理由・代替案・未決事項を残す自由記述。機能説明は `description`、
検討理由は `notes` と使い分ける。トップレベル `notes` は全体方針。

## バージョンと互換性

```yaml
version: "1.1"
title: タスク管理
notes: 任意の全体方針
domain: { entities: [], terms: [] }
flows: []
useCases: []
screens:
  - { id: home, title: ホーム, components: [] }
transitions: []
```

- `title` と1件以上の `screens` が必要。`version` 省略時は `"1.0"`。
- 対応形式は `"1.0"` / `"1.1"`。新規例は1.1、既存1.0も同じ追加項目を段階導入できる。
- 新しい `domain` / `flows` / `useCases` / `stateFlow` はすべて任意。
- `transitions` と `components` は省略時 `[]`。既存の画面／部品／遷移はそのまま読める。
- コンポーネントの未知フィールドのみ既存どおり保持。その他の拡張はこの文書とスキーマに追加する。
- IDは空でない安定した文字列。英小文字とハイフンを推奨するが日本語も使用可。

## データ・用語 `domain`

| フィールド | 形式・意味 |
| --- | --- |
| `notes` | 任意の検討メモ |
| `entities[]` | `id`, `title`, 任意 `description`, `notes`, `fields[]` |
| `entities[].fields[]` | `id`, `title`, `type`（文字列）, 任意 `required`（真偽値）, `entity`（関連エンティティID）, `notes` |
| `terms[]` | `id`, `title`, `definition`, 任意 `entity`（エンティティID）, `notes` |

`entities`, `terms`, `fields` は省略時 `[]`。`type` は業務上の型の記述であり、実行可能なSQL型ではない。

## 業務フロー `flows[]`

`id`, `title`, 任意 `actor`, `goal`, `notes`, `steps[]`。
各手順は `id`, `title`, 任意 `useCase`（ユースケースID）, `notes`。
配列順が業務の順序。ユースケース化前の手順は `useCase` を省略できる。

## ユースケース `useCases[]`

| フィールド | 形式・意味 |
| --- | --- |
| `id`, `title` | 必須の識別子と名称 |
| `actor`, `notes` | 任意の利用者・検討メモ |
| `entities`, `screens` | 任意のエンティティID配列・画面ID配列 |
| `preconditions`, `postconditions` | 任意の文字列配列 |
| `steps[]` | `id`, `title`, 任意 `screen`, `action: { screen, component }`, `notes` |
| `branches[]` | `id`, `kind: alternate \| exception`, `from`, `condition`, `outcome`, 任意 `resumeAt`, `screen`, `notes` |

`steps` と `branches` は省略時 `[]`。基本系列は `steps` の配列順。
`from` と `resumeAt` は同一ユースケース内の手順ID。`resumeAt` 省略時はその分岐で終了。
`alternate` は条件別の代替系列、`exception` は失敗・異常系。
`screen` は画面ID、`action` はその画面内で空でない `action` を持つ部品への参照。
画面検討前はこれらの参照を省略できる。

## 画面 `screens[]`

`id`, `title`, 任意 `description`, `notes`, `entities`（エンティティID配列）, `useCases`（ユースケースID配列）, `components[]`, `stateFlow`。
画面全体の機能は `description`、画面間の移動はトップレベル `transitions`、画面内状態は `stateFlow` で表す。

```yaml
stateFlow:
  initial: editing
  notes: 失敗時も入力を保持する
  states:
    - { id: editing, title: 入力中 }
    - { id: saving, title: 保存中 }
  transitions:
    - { from: editing, to: saving, trigger: 保存, component: save-button }
```

`stateFlow` がある場合 `initial` と1件以上の `states` が必要。
状態は `id`, `title`, 任意 `notes`。遷移は `from`, `to`, `trigger`, 任意 `component`, `notes`。
状態IDは画面内スコープ、`component` はその画面内の部品ID。遷移配列は省略時 `[]`。

## 部品・アクション `screens[].components[]`

`id`, `type` が必須。種類は `button`, `text`, `input`, `image`, `toggle`, `select`, `link`, `card`, `list`, `divider`, `navigation`。

| フィールド | 形式・意味 |
| --- | --- |
| `label`, `content` | 任意の表示ラベル・本文 |
| `action` | 任意の安定した操作名／イベント名（例 `save-task`） |
| `useCases` | 任意の関連ユースケースID配列 |
| `precondition`, `outcome`, `notes` | 任意の実行条件・結果・検討メモ |
| `placeholder`, `src` | 任意の入力ヒント・画像URLや参照 |
| `options`, `required`, `props` | 任意の選択肢配列・必須真偽値・表示メタデータマップ |

画面内アクションの正は部品の `action`。別のアクション一覧を複製保存しない。

## 画面間遷移 `transitions[]`

`from`, `to` は画面ID、`trigger` は空でないイベント名、`notes` は任意。
既存互換のため `trigger` は自由記述（部品参照の強制はしない）。

## 検証・共有アクション

- `spec-load`: YAML・最新レビュー・レビュー履歴を取得。
- `spec-update`: 全YAMLを保存。構文エラーを含む下書きも保存可。承認状態は下書きに戻るが履歴は保持。
  任意 `expectedUpdatedAt` を指定すると別編集の上書きを拒否。
- `spec-validate`: YAML構文・型、各スコープのID重複、全明示参照の整合を検査。
- `spec-edit`: 画面／部品／遷移のCRUD。`set_section` + `section: domain | flows | useCases` + `value` で段階を置換。
  `update_screen` の `screen` パッチで `stateFlow` などを変更可能。保存前に全参照検証。
  画面の改名は参照を追従。参照を壊す削除は拒否（画面間遷移は画面削除時に除去）。複数段階同時編集には `spec-update`。
- `spec-render-wireframe`: 文字をエスケープしたHTMLフラグメント。
- `spec-render-flow`: 既定 `kind: screens`、追加 `useCases` / `states`。任意 `selectedId` でユースケース／画面を選ぶ。
  Mermaid文字列の `format` / `mermaid` 戻り値は維持。対象が空なら空文字。
- `spec-review`: `approved` / `changes_requested` と任意コメント、`stage`（既定 `screens`）、任意 `expectedUpdatedAt`。
  承認は保存済み文書全体に対する決定。`stage` は検討の焦点。無効な仕様は承認不可。

ID重複はエンティティ・用語・フロー・ユースケース・画面、およびそれぞれのフィールド／手順／分岐／部品／状態スコープで検出する。
参照の存在を検証し、網羅性（例: 全例外の検討済み）を推定したり承認したりはしない。

## 検討過程・レビュー履歴

`notes` はYAMLとともに編集・保持する。レビュー履歴は同じSQLレコードの `review_history` に追記し、
`id`, `stage`, `status`, `comment`, `createdAt`, `documentHash`（保存YAMLのSHA-256）を保持する。
保存し直しても履歴は消さない。従来の `reviewStatus` / `reviewComment` も維持。
レビューは追記専用だが、仕様の全版復元・差分監査・レビュー者の証明までは提供しない。

スタジオのMermaidソース編集は一時的な描画確認。YAMLへの逆変換・保存は行わない。
図を永続変更するには、対応するフロー／画面状態／遷移を編集する。
