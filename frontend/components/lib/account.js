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

// マジックリンクで戻ってきた際、URLハッシュのトークンからセッションを確立
export async function captureSessionFromUrl() {
  if (!isCloud() || typeof window === "undefined") return null;
  const hash = window.location.hash || "";
  if (!hash.includes("access_token=")) return null;
  const p = new URLSearchParams(hash.slice(1));
  const access_token = p.get("access_token"), refresh_token = p.get("refresh_token");
  if (!access_token) return null;
  try {
    const res = await fetch(`${SUPABASE.url}/auth/v1/user`, { headers: h(access_token) });
    const user = res.ok ? await res.json() : null;
    const session = { access_token, refresh_token, user: user ? { id: user.id, email: user.email } : null, at: Date.now() };
    writeSession(session);
    history.replaceState(null, "", window.location.pathname + window.location.search); // ハッシュを掃除
    return session;
  } catch { return null; }
}

export async function signOut() {
  const s = readSession();
  try { if (s && isCloud()) await fetch(`${SUPABASE.url}/auth/v1/logout`, { method: "POST", headers: h(s.access_token) }); } catch {}
  writeSession(null);
}

// ---- データ同期（tastings） ----
export async function cloudPullTastings() {
  const s = readSession(); if (!s) return [];
  const res = await fetch(`${SUPABASE.url}/rest/v1/tastings?select=*`, { headers: h(s.access_token) });
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
  const res = await fetch(`${SUPABASE.url}/rest/v1/tastings?on_conflict=user_id,bean_id`, {
    method: "POST", headers: { ...h(s.access_token), Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`push-failed:${res.status}`);
  return true;
}

// ---- プレミアム連動（entitlements） ----
// Stripe 入金 → Edge Function(Webhook) が entitlements を更新（docs参照）。
export async function cloudGetPlan() {
  const s = readSession(); if (!s) return null;
  try {
    const res = await fetch(`${SUPABASE.url}/rest/v1/entitlements?select=plan,status`, { headers: h(s.access_token) });
    if (!res.ok) return null;
    const rows = await res.json();
    const row = Array.isArray(rows) ? rows.find((r) => r.status === "active") || rows[0] : null;
    return row ? row.plan : null;
  } catch { return null; }
}
