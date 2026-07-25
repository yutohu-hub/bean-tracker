// ローカルアカウント & 味の記録（localStorage 保存・端末内のみ）
// ※ 複数端末での本格ログインは将来 Supabase Auth 等のバックエンドに委譲する想定。
const USER_KEY = "bt_user";
const TASTE_KEY = "bt_tastings";

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
