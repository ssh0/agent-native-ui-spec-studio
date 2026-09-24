import type { generateSpecLists } from "@shared/spec-lists";

type Lists = ReturnType<typeof generateSpecLists>;

export function GeneratedLists({ lists }: { lists: Lists }) {
  return (
    <div className="spec-generated-lists">
      <p className="spec-muted">保存済みの仕様 YAML から生成した読み取り専用の一覧です。</p>
      <h2>画面一覧</h2>
      {lists.screens.length ? <table className="spec-table"><thead><tr><th>ID</th><th>画面名</th><th>機能説明・メモ</th><th>エンティティ</th><th>ユースケース</th></tr></thead><tbody>
        {lists.screens.map((screen) => <tr key={screen.id}><td><code>{screen.id}</code></td><td>{screen.title}</td><td>{screen.description && <p>{screen.description}</p>}{screen.notes && <p>メモ: {screen.notes}</p>}{!screen.description && !screen.notes && "—"}</td><td>{screen.entities.join("、") || "—"}</td><td>{screen.useCases.join("、") || "—"}</td></tr>)}
      </tbody></table> : <p className="spec-muted">画面は未定義です。</p>}
      <h2>項目・操作一覧</h2>
      {lists.items.length ? <table className="spec-table"><thead><tr><th>画面</th><th>項目 ID</th><th>種類</th><th>表示内容</th><th>入力・選択</th><th>操作・関連</th></tr></thead><tbody>
        {lists.items.map((item) => <tr key={`${item.screenId}:${item.id}`}><td><code>{item.screenId}</code></td><td><code>{item.id}</code></td><td>{item.type}</td><td>{[item.label, item.content].filter(Boolean).join(" / ") || "—"}</td><td>{[
          item.placeholder && `入力ヒント: ${item.placeholder}`,
          item.options?.length && `選択肢: ${item.options.join("、")}`,
          item.required === undefined ? undefined : item.required ? "必須" : "任意",
          item.src && `参照: ${item.src}`,
        ].filter(Boolean).join(" / ") || "—"}</td><td>{[
          item.action && `操作: ${item.action}`,
          item.precondition && `条件: ${item.precondition}`,
          item.outcome && `結果: ${item.outcome}`,
          item.useCases?.length && `ユースケース: ${item.useCases.join("、")}`,
          item.notes && `メモ: ${item.notes}`,
          item.props && `表示設定: ${JSON.stringify(item.props)}`,
        ].filter(Boolean).join(" / ") || "—"}</td></tr>)}
      </tbody></table> : <p className="spec-muted">項目・操作は未定義です。</p>}
    </div>
  );
}
