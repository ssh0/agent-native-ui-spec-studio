# UI仕様モデル（YAML）

この文書を仕様形式の正とする。実行時のスキーマ・参照検証は
[`shared/spec-schema.ts`](../shared/spec-schema.ts)、動作する一式の例は
[`specs/example.yaml`](../specs/example.yaml) を参照。
UIとエージェントは同じSQL上のYAMLを共有アクションで読み書きする。

## 検討する順序

1. `domain`: アクター・外部システムと管理対象データの構造・関係・用語を明らかにする。
2. `flows`: 業務全体の流れと関係者間の引き継ぎを整理し、システム利用の手順をユースケースへ結び付ける。
3. `useCases`: 事前／事後条件、基本系列、状態による分岐・例外を検討する。
4. `screens`: ユースケースを支える画面単位の機能と画面内状態遷移を定義する。
5. `screens[].components`: 画面内の操作、前提条件、結果を定義する。

これは編集の推奨順であり、段階を強制的にロックしない。未検討の段階は未定義のままにできる。
各段階の `notes` は決定理由・代替案・未決事項を残す自由記述。機能説明は `description`、
検討理由は `notes` と使い分ける。トップレベル `notes` は全体方針。

## 必須構造（version 2.0）

```yaml
version: "2.0"
title: 検討中の仕様
notes: データの整理から着手する
domain:
  actors: []
  externalSystems: []
  entities: []
  terms: []
flows: []
useCases: []
screens: []
transitions: []
```

- `version: "2.0"`, `title`, `domain`, `flows`, `useCases`, `screens`, `transitions` はすべて必須。
- 文書構造はこの1形式に固定し、省略時の旧version補完や旧形式の自動変換は行わない。
- 各段階の未検討内容は空配列で明示する。画面を1件も作らずデータやユースケースの検討を開始できる。
- 以下で配列として定義する構造（エンティティの `fields`、フローの `steps`、ユースケースの条件・系列・分岐、画面の参照・部品・状態遷移）は省略せず、未定義なら `[]` を書く。
- `notes`、単一の参照、説明など「任意」と示す値は省略できる。
- 未定義フィールドは検証エラー。部品の追加表示メタデータは `props` に置く。誤記した項目を黙って削除しない。
- IDは空でない安定した文字列。英小文字とハイフンを推奨するが日本語も使用可。

## データ・用語 `domain`

| フィールド            | 形式・意味                                                                                          |
| --------------------- | --------------------------------------------------------------------------------------------------- |
| `notes`               | 任意の検討メモ                                                                                      |
| `actors[]`, `externalSystems[]` | 必須配列。各項目は `id`, `title`, `description`（空でない説明）、任意 `notes` |
| `entities[]`          | `id`, `title`, 必須 `fields[]`、任意 `description`, `notes`                                         |
| `entities[].fields[]` | `id`, `title`, `type`（文字列）, 任意 `required`（真偽値）, `entity`（関連エンティティID）, `notes` |
| `terms[]`             | `id`, `title`, `definition`, 任意 `entity`（エンティティID）, `notes`                               |

`actors`, `externalSystems`, `entities`, `terms`, `fields` は必須の配列。`type` は業務上の型の記述であり、実行可能なSQL型ではない。

## 業務フロー `flows[]`

業務フローは「業務全体の流れ・関係者間のやり取り」、ユースケースは「1つのシステム利用目的の機能単位」。
人間の手作業や外部サービスの処理をユースケースに無理に置き換えない。

`id`, `title`, `steps[]` が必須。`goal`, `notes` は任意。従来のフロー全体の自由文字列 `actor` は使用しない。
各手順は `id`, `title`, `performer` が必須、`useCase`（ユースケースID）, `notes` は任意。
`performer` は `{ kind: actor, id: <domain.actorsのID> }` または
`{ kind: externalSystem, id: <domain.externalSystemsのID> }`。種類に対応する参照先が必要。
アクターと外部システムは別のIDスコープで、同名IDでも種類で区別する。

```yaml
flows:
  - id: intake
    title: 依頼受付
    goal: 依頼を登録し受付を通知する
    notes: 通知連携の詳細は次段階で検討する
    steps:
      - id: request
        title: 作業を依頼する
        performer: { kind: actor, id: requester }
      - id: register
        title: タスクを登録する
        performer: { kind: actor, id: member }
        useCase: create-task
      - id: notify
        title: 受付通知を送る
        performer: { kind: externalSystem, id: notification }
```

配列順が業務の順序。隣り合う手順の実行者が変わると引き継ぎ／外部呼び出しを表す。
これは直列の業務系列で、並列・条件分岐・同期応答の意味を推定しない。
手作業・外部処理・ユースケース未検討の手順は `useCase` を省略できる。
空の `steps: []` は未検討を表す。参照先の定義と合わせた完全な例は `specs/example.yaml` を参照。

描画は `spec-render-flow kind: flows`。Mermaid `flowchart` の参加者別 `subgraph` をレーン相当として使い、
手順番号・順序の矢印・任意のユースケース名を表示する。図の配置はMermaidに委ねるため厳密な等幅スイムレーンではない。
sequenceDiagramではなくflowchartを選んだ理由は、メッセージ送受信のない手作業も手順ノードとして表現できるため。
生Mermaidは保存せず、この構造化YAMLから再生成する。
スタジオのデータ・用語段階では、エンティティ・用語・アクター・外部システムを独立した選択セクションとして表示する。アクターと外部システムの追加・編集は各セクションで行い、ID変更時は業務手順の参照を追従し、参照中の削除は不可。業務フロー段階では参加者を参照先として表示し、「この段階を編集」で手順を編集する。

## ユースケース `useCases[]`

| フィールド                        | 形式・意味                                                                                               |
| --------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `id`, `title`                     | 必須の識別子と名称                                                                                       |
| `actor`, `notes`                  | 任意の利用者（自由記述）・検討メモ                                                                                   |
| `entities`, `screens`             | 必須のエンティティID配列・画面ID配列（未定義は `[]`）                                                    |
| `preconditions`, `postconditions` | 必須の文字列配列（未検討は `[]`）                                                                        |
| `steps[]`                         | `id`, `title`, 任意 `screen`, `action: { screen, component }`, `notes`                                   |
| `branches[]`                      | `id`, `kind: alternate \| exception`, `from`, `condition`, `outcome`, 任意 `resumeAt`, `screen`, `notes` |

`steps` と `branches` は必須の配列。基本系列は `steps` の配列順。
`from` と `resumeAt` は同一ユースケース内の手順ID。`resumeAt` 省略時はその分岐で終了。
`alternate` は条件別の代替系列、`exception` は失敗・異常系。
`screen` は画面ID、`action` はその画面内で空でない `action` を持つ部品への参照。
画面検討前はこれらの参照を省略できる。

## 画面 `screens[]`

`id`, `title`, `entities`（エンティティID配列）, `useCases`（ユースケースID配列）, `components[]`, `stateFlow` が必須。`description`, `notes` は任意。
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

`stateFlow` は `initial`, `states`, `transitions` を必ず持つ。未検討時は `{ initial: null, states: [], transitions: [] }`。
状態を1件以上定義した場合、`initial` にはその中の状態IDを指定する。
状態は `id`, `title`, 任意 `notes`。遷移は `from`, `to`, `trigger`, 任意 `component`, `notes`。
状態IDは画面内スコープ、`component` はその画面内の部品ID。状態・遷移配列の省略は不可。

## 部品・アクション `screens[].components[]`

`id`, `type` が必須。種類は `button`, `text`, `input`, `image`, `toggle`, `select`, `link`, `card`, `list`, `divider`, `navigation`。

| フィールド                         | 形式・意味                                         |
| ---------------------------------- | -------------------------------------------------- |
| `label`, `content`                 | 任意の表示ラベル・本文                             |
| `action`                           | 任意の安定した操作名／イベント名（例 `save-task`） |
| `useCases`                         | 任意の関連ユースケースID配列                       |
| `precondition`, `outcome`, `notes` | 任意の実行条件・結果・検討メモ                     |
| `placeholder`, `src`               | 任意の入力ヒント・画像URLや参照                    |
| `options`, `required`, `props`     | 任意の選択肢配列・必須真偽値・表示メタデータマップ |

画面内アクションの正は部品の `action`。別のアクション一覧を複製保存しない。

## 画面間遷移 `transitions[]`

`from`, `to` は画面ID、`trigger` は空でないイベント名、`notes` は任意。
`trigger` はユーザー操作・外部イベントを表す自由記述。部品との対応はユースケースの `action` や画面内状態遷移の `component` で結び付ける。

## 検証・共有アクション

- `spec-load`: YAML・最新レビュー・レビュー履歴を取得。
- `spec-update`: 全YAMLを保存。構文エラーを含む下書きも保存可。承認状態は下書きに戻るが履歴は保持。
  任意 `expectedUpdatedAt` を指定すると別編集の上書きを拒否。
- `spec-validate`: YAML構文・型、各スコープのID重複、全明示参照の整合を検査。
- `spec-edit`: 画面／部品／遷移のCRUD。`set_section` + `section: domain | flows | useCases` + `value` で段階を置換。
  `update_screen` の `screen` パッチで `stateFlow` などを変更可能。保存前に全参照検証。
  画面の改名は参照を追従。参照を壊す削除は拒否（画面間遷移は画面削除時に除去）。複数段階同時編集には `spec-update`。
- `spec-render-wireframe`: 文字をエスケープしたHTMLフラグメント。
- `spec-render-flow`: 既定 `kind: screens`、追加 `flows` / `useCases` / `states`。任意 `selectedId` で業務フロー／ユースケース／画面を選ぶ。
  Mermaid文字列の `format` / `mermaid` 戻り値は維持。対象が空なら空文字。
- `spec-review`: `approved` / `changes_requested` と任意コメント、`stage`（既定 `screens`）、任意 `expectedUpdatedAt`。
  承認は保存済み文書全体に対する決定。`stage` は検討の焦点。形式・参照が無効な仕様はレビュー不可。

ID重複はアクター・外部システム・エンティティ・用語・フロー・ユースケース・画面、およびそれぞれのフィールド／手順／分岐／部品／状態スコープで検出する。
参照の存在を検証し、網羅性（例: 全例外の検討済み）を推定したり承認したりはしない。

## 検討過程・レビュー履歴

`notes` はYAMLとともに編集・保持する。レビュー履歴は同じSQLレコードの `review_history` に追記し、
`id`, `stage`, `status`, `comment`, `createdAt`, `documentHash`（保存YAMLのSHA-256）を保持する。
保存し直しても履歴は消さない。`reviewStatus` / `reviewComment` は最新の判断を表す。
レビューは追記専用だが、仕様の全版復元・差分監査・レビュー者の証明までは提供しない。

スタジオのMermaidソース編集は一時的な描画確認。YAMLへの逆変換・保存は行わない。
図を永続変更するには、対応するフロー／画面状態／遷移を編集する。
