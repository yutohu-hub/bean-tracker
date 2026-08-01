// ローカルアカウント & 味の記録（localStorage 保存・端末内のみ）
// ※ 複数端末での本格ログインは将来 Supabase Auth 等のバックエンドに委譲する想定。
const USER_KEY = "bt_user";
const TASTE_KEY = "bt_tastings";
const ARCHIVE_KEY = "bt_archive";
const PLAN_KEY = "bt_plan";
const NOTIFY_KEY = "bt_notify";
const RESTOCK_KEY = "bt_restocks";
const DIAG_KEY = "bt_diag_history";
const ANALYSIS_KEY = "bt_analysis_history";

function read(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function write(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }

export function getUser() { return read(USER_KEY, null); }
// email は「この端末での本人の目印」。メール認証が済むまではサーバーには渡さない
export function setUser(name, email = null) {
  const u = { name: String(name).trim().slice(0, 24), since: Date.now() };
  if (email) u.email = String(email).trim().slice(0, 120);
  write(USER_KEY, u);
  return u;
}
export function logout() { try { localStorage.removeItem(USER_KEY); } catch {} }

export function getTastings() { const l = read(TASTE_KEY, []); return Array.isArray(l) ? l : []; }
export function getTasting(beanId) { return getTastings().find((t) => t.beanId === beanId) || null; }
export function upsertTasting(rec) {
  const list = getTastings().filter((t) => t.beanId !== rec.beanId);
  list.unshift({ ...rec, at: Date.now() });
  write(TASTE_KEY, list);
  return list;
}
export function removeTasting(beanId) {
  const list = getTastings().filter((t) => t.beanId !== beanId);
  write(TASTE_KEY, list);
  return list;
}
// 診断結果の履歴（味の記録に残す）
export function getDiagHistory() { const l = read(DIAG_KEY, []); return Array.isArray(l) ? l : []; }
export function addDiagResult(rec) {
  const list = getDiagHistory();
  list.unshift({ ...rec, at: Date.now() });
  write(DIAG_KEY, list.slice(0, 50));
  return list;
}
export function removeDiagResult(at) {
  const list = getDiagHistory().filter((d) => d.at !== at);
  write(DIAG_KEY, list);
  return list;
}

// 記録のAI分析スナップショット
export function getAnalysisHistory() { const l = read(ANALYSIS_KEY, []); return Array.isArray(l) ? l : []; }
export function addAnalysis(rec) {
  const list = getAnalysisHistory();
  list.unshift({ ...rec, at: Date.now() });
  write(ANALYSIS_KEY, list.slice(0, 50));
  return list;
}
export function removeAnalysis(at) {
  const list = getAnalysisHistory().filter((a) => a.at !== at);
  write(ANALYSIS_KEY, list);
  return list;
}

// クラウド取得分を端末内にマージ（at が新しい方を採用・タイムスタンプ保持）
export function mergeTastings(incoming) {
  const map = new Map(getTastings().map((t) => [t.beanId, t]));
  for (const t of incoming || []) {
    if (t.beanId == null) continue;
    const cur = map.get(t.beanId);
    if (!cur || (t.at || 0) >= (cur.at || 0)) map.set(t.beanId, { ...cur, ...t });
  }
  const list = [...map.values()].sort((a, b) => (b.at || 0) - (a.at || 0));
  write(TASTE_KEY, list);
  return list;
}

// アーカイブの端末内永続化
// 一度アーカイブになった豆のスナップショットを保存し、データ更新（再デプロイ）で
// カタログから消えても残り続けるようにする。既存スナップショットは上書きしない
// （「EC から消える前のカードのまま変更しない」ため、初出時の状態を保持）。
export function getArchivedBeans() { const l = read(ARCHIVE_KEY, []); return Array.isArray(l) ? l : []; }
export function syncArchive(currentArchive) {
  const stored = getArchivedBeans();
  const have = new Set(stored.map((b) => b.id));
  let changed = false;
  for (const b of currentArchive) {
    if (!have.has(b.id)) { stored.push(b); have.add(b.id); changed = true; }
  }
  if (changed) write(ARCHIVE_KEY, stored);
  return stored;
}

// ---- プラン ----
// 権限の判定は lib/entitlements.js に移した。支払いの記録（Supabase の entitlements）
// だけが根拠で、端末側から書き換える口は用意しない。
// ここに setPlan があったころは、画面のボタンが直接 localStorage に premium を
// 書いていたため、決済せずにプレミアムを取得できた。
// 古い端末に残った書き込み済みの値も、起動時に捨てる。
export function purgeLegacyPlan() { try { localStorage.removeItem(PLAN_KEY); } catch {} }

// ---- 新着レアロット通知の購読設定（端末内プロトタイプ） ----
const NOTIFY_DEFAULT = { email: "", mail: true, push: false, cats: { geisha: true, sidra: true, coe: true, restock: true }, at: null };
export function getNotify() {
  const n = read(NOTIFY_KEY, null);
  if (!n || typeof n !== "object") return { ...NOTIFY_DEFAULT };
  return { ...NOTIFY_DEFAULT, ...n, cats: { ...NOTIFY_DEFAULT.cats, ...(n.cats || {}) } };
}
export function setNotify(prefs) { const n = { ...getNotify(), ...prefs, at: Date.now() }; write(NOTIFY_KEY, n); return n; }

// ---- 再入荷ウォッチ（SOLD OUT の豆の再入荷アラート・端末内プロトタイプ） ----
export function getRestocks() { const l = read(RESTOCK_KEY, []); return Array.isArray(l) ? l : []; }
export function isRestock(beanId) { return getRestocks().some((x) => x.beanId === beanId); }
export function toggleRestock(rec) {
  const list = getRestocks();
  const i = list.findIndex((x) => x.beanId === rec.beanId);
  if (i >= 0) list.splice(i, 1); else list.unshift({ ...rec, at: Date.now() });
  write(RESTOCK_KEY, list);
  return list;
}
