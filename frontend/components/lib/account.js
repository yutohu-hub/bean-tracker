// 複数端末ログイン & 同期（Supabase / サーバーレス・静的サイトのまま）
//
// 有効化手順:
//   1. https://supabase.com で無料プロジェクトを作成
//   2. Project Settings → API から「Project URL」と「anon public」キーをコピー
//   3. 下の SUPABASE に貼り付けてコミット（anon キーは公開して良い鍵。秘密の
//      service_role キーは絶対に貼らないこと）
//   4. Authentication → URL Configuration に本サイトのURLを Redirect に追加
//   5. docs/account-sync.md の SQL でテーブル(tastings / entitlements)と RLS を作成
//   → 「味の記録」タブにメールログインが出現し、端末間で同期＆プレミアム連動します
//
// 未設定の間は、これらは何もせず（isCloud()=false）、従来どおり端末内保存で動きます。

export const SUPABASE = {
  url: "https://ilfkriwfvdpdxgadyvbs.supabase.co",
  // publishable（公開）キー。クライアントに置く前提の鍵。secret キーは絶対に置かない。
  anonKey: "sb_publishable_L4OplpABJOp4o5RjcdwKAg_bfvszElO",
};

const SESSION_KEY = "bt_session";
export const isCloud = () => !!(SUPABASE.url && SUPABASE.anonKey);

function readSession() { try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { return null; } }
function writeSession(s) { try { s ? localStorage.setItem(SESSION_KEY, JSON.stringify(s)) : localStorage.removeItem(SESSION_KEY); } catch {} }
export function getSession() { return readSession(); }
export function isSignedIn() { return !!(readSession() && readSession().access_token); }

const h = (token) => ({
  apikey: SUPABASE.anonKey,
  Authorization: `Bearer ${token || SUPABASE.anonKey}`,
  "Content-Type": "application/json",
});

// メール宛にログインリンク（マジックリンク）を送信
export async function signInWithEmail(email) {
  if (!isCloud()) throw new Error("cloud-not-configured");
  const redirect = typeof window !== "undefined" ? window.location.origin + window.location.pathname : "";
  const res = await fetch(`${SUPABASE.url}/auth/v1/otp?redirect_to=${encodeURIComponent(redirect)}`, {
    method: "POST", headers: h(), body: JSON.stringify({ email, create_user: true }),
  });
  if (!res.ok) throw new Error(`otp-failed:${res.status}`);
  return true;
}

/* マジックリンクで戻ってきたときにセッションを確立する。
   Supabase はトークンを URL のハッシュに載せて返すが、失敗時は #error=... を返す。
   以前はエラーを黙って捨てていたため、リンクを開いても何も起きないように見えていた。
   戻り値: null（リンク経由でない）/ {ok:true, session} / {ok:false, error} */
export async function captureSessionFromUrl() {
  if (!isCloud() || typeof window === "undefined") return null;
  const raw = (window.location.hash || "").replace(/^#/, "");
  const q = window.location.search.replace(/^\?/, "");
  const p = new URLSearchParams(raw || q);
  const clean = () => history.replaceState(null, "", window.location.pathname);

  const err = p.get("error_description") || p.get("error");
  if (err) { clean(); return { ok: false, error: decodeURIComponent(err.replace(/\+/g, " ")) }; }

  const access_token = p.get("access_token");
  const refresh_token = p.get("refresh_token");
  if (!access_token) return null;
  try {
    const res = await fetch(`${SUPABASE.url}/auth/v1/user`, { headers: h(access_token) });
    if (!res.ok) { clean(); return { ok: false, error: `ログインの確認に失敗しました (${res.status})` }; }
    const user = await res.json();
    const expires_in = Number(p.get("expires_in")) || 3600;
    const session = {
      access_token, refresh_token,
      user: user ? { id: user.id, email: user.email } : null,
      at: Date.now(), expires_at: Date.now() + expires_in * 1000,
    };
    writeSession(session);
    clean();
    return { ok: true, session };
  } catch { clean(); return { ok: false, error: "ネットワークエラーでログインを完了できませんでした" }; }
}

/* アクセストークンは既定1時間で失効する。更新処理が無かったため、
   ログインした当日でも時間が経つと同期が黙って401になっていた。 */
export async function refreshSession() {
  const s = readSession();
  if (!s || !s.refresh_token) return null;
  try {
    const res = await fetch(`${SUPABASE.url}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST", headers: h(), body: JSON.stringify({ refresh_token: s.refresh_token }),
    });
    if (!res.ok) { if (res.status === 400 || res.status === 401) writeSession(null); return null; }
    const d = await res.json();
    if (!d.access_token) return null;
    const next = {
      ...s, access_token: d.access_token, refresh_token: d.refresh_token || s.refresh_token,
      at: Date.now(), expires_at: Date.now() + (Number(d.expires_in) || 3600) * 1000,
    };
    writeSession(next);
    return next;
  } catch { return null; }
}

/* 期限が近ければ先に更新し、それでも401なら1度だけ更新して再試行する */
async function authFetch(path, init = {}) {
  let s = readSession();
  if (!s) throw new Error("not-signed-in");
  if (s.expires_at && s.expires_at - Date.now() < 5 * 60 * 1000) s = (await refreshSession()) || s;
  const call = (tok) => fetch(`${SUPABASE.url}${path}`, { ...init, headers: { ...h(tok), ...(init.headers || {}) } });
  let res = await call(s.access_token);
  if (res.status === 401) {
    const n = await refreshSession();
    if (n) res = await call(n.access_token);
  }
  return res;
}

export async function signOut() {
  const s = readSession();
  try { if (s && isCloud()) await fetch(`${SUPABASE.url}/auth/v1/logout`, { method: "POST", headers: h(s.access_token) }); } catch {}
  writeSession(null);
}

// ---- データ同期（tastings） ----
export async function cloudPullTastings() {
  if (!readSession()) return [];
  const res = await authFetch(`/rest/v1/tastings?select=*`);
  if (!res.ok) throw new Error(`pull-failed:${res.status}`);
  return await res.json();
}
export async function cloudPushTastings(list) {
  const s = readSession(); if (!s || !s.user) return false;
  const rows = list.map((t) => ({
    user_id: s.user.id, bean_id: t.beanId, r: t.r || null, name: t.name || null,
    roaster: t.roaster || null, origin: t.origin || null, rating: t.rating || null,
    notes: t.notes || null, at: t.at || Date.now(),
  }));
  if (rows.length === 0) return true;
  const res = await authFetch(`/rest/v1/tastings?on_conflict=user_id,bean_id`, {
    method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`push-failed:${res.status}`);
  return true;
}

// ---- プレミアム連動（entitlements） ----
// Stripe 入金 → Edge Function(Webhook) が entitlements を更新（docs参照）。
export async function cloudGetPlan() {
  if (!readSession()) return null;
  try {
    const res = await authFetch(`/rest/v1/entitlements?select=plan,status`);
    if (!res.ok) return null;
    const rows = await res.json();
    const row = Array.isArray(rows) ? rows.find((r) => r.status === "active") || rows[0] : null;
    return row ? row.plan : null;
  } catch { return null; }
}
