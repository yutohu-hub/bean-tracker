// ローカルアカウント & 味の記録（localStorage 保存・端末内のみ）
// ※ 複数端末での本格ログインは将来 Supabase Auth 等のバックエンドに委譲する想定。
const USER_KEY = "bt_user";
const TASTE_KEY = "bt_tastings";
const ARCHIVE_KEY = "bt_archive";
const PLAN_KEY = "bt_plan";
const NOTIFY_KEY = "bt_notify";
const RESTOCK_KEY = "bt_restocks";

function read(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function write(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }

export function getUser() { return read(USER_KEY, null); }
export function setUser(name) { const u = { name: String(name).trim().slice(0, 24), since: Date.now() }; write(USER_KEY, u); return u; }
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

// ---- プラン（課金の受け皿・端末内プロトタイプ） ----
// 実際の決済は Stripe Checkout / IAP 連携後に有効化。ここでは申込意思をローカル保持。
export function getPlan() { const p = read(PLAN_KEY, null); return p && p.id ? p : { id: "free", at: null }; }
export function setPlan(id) { const p = { id, at: Date.now() }; write(PLAN_KEY, p); return p; }

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
