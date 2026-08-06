// 複数端末ログイン & 同期（Supabase / サーバーレス・静的サイトのまま）
//
// 有効化手順:
//   1. https://supabase.com で無料プロジェクトを作成
//   2. Project Settings → API から「Project URL」と「anon public」キーをコピー
//   3. 下の SUPABASE に貼り付けてコミット（anon キーは公開して良い鍵。秘密の
//      service_role キーは絶対に貼らないこと）
//   4. Authentication → URL Configuration に本サイトのURLを Redirect に追加
//   5. documents/account-sync.md の SQL でテーブル(tastings / entitlements)と RLS を作成
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
/* 送信できなかったときは「失敗しました」で終わらせず、Supabase が返した理由をそのまま返す。
   実際に起きるのはほぼ次のどれかで、対処がまったく違うため区別できないと直せない:
   - 429 : メール送信のレート制限（無料枠は1時間に数通）。時間をおけば直る
   - 401 : APIキーが無効/失効。account.js の SUPABASE を貼り直す
   - 422 : メールアドレスの形式、またはサインアップ無効化
   - 通信自体の失敗 : オフライン、またはプロジェクトURLの誤り */
const LAST_EMAIL_KEY = "bt_last_email";
export function lastEmail() { try { return localStorage.getItem(LAST_EMAIL_KEY) || ""; } catch { return ""; } }

export async function signInWithEmail(email) {
  if (!isCloud()) throw new Error("cloud-not-configured");
  // どのアドレスに送ったかを覚えておく。リンクが失敗したとき、
  // 打ち直さずに「もう一度送る」「コードを入れる」へ進めるようにするため
  try { localStorage.setItem(LAST_EMAIL_KEY, String(email).trim()); } catch {}
  const redirect = typeof window !== "undefined" ? window.location.origin + window.location.pathname : "";
  let res;
  try {
    res = await fetch(`${SUPABASE.url}/auth/v1/otp?redirect_to=${encodeURIComponent(redirect)}`, {
      method: "POST", headers: h(), body: JSON.stringify({ email, create_user: true }),
    });
  } catch {
    throw new Error("Supabase に接続できませんでした（オフライン、またはプロジェクトURLの誤り）");
  }
  if (res.ok) return true;

  let detail = "";
  try {
    const d = await res.json();
    detail = d.msg || d.error_description || d.message || d.error || "";
  } catch { detail = (await res.text().catch(() => "")).slice(0, 160); }

  const retry = Number(res.headers.get("retry-after"));
  if (res.status === 429) {
    throw new Error(`メール送信の回数制限に達しました。${retry ? `${Math.ceil(retry / 60)}分ほど` : "しばらく"}おいて再度お試しください（Supabaseの無料枠は1時間に数通まで）`);
  }
  if (res.status === 401 || res.status === 403) {
    throw new Error(`APIキーが受け付けられませんでした (${res.status}${detail ? `: ${detail}` : ""})。Supabaseのキーを確認してください`);
  }
  throw new Error(`送信できませんでした (${res.status}${detail ? `: ${detail}` : ""})`);
}

/* メールに載っている6桁のコードでログインする。

   リンクを踏む方式は、こちらでは直せない事情で失敗することが多い:
     * 戻り先URLが Supabase 側で許可されていない（Site URL に飛ばされる）
     * メールのセキュリティ検査がリンクを先に開き、1回きりのトークンを使い切る
       （Outlook / Gmail の保護機能。届いた瞬間に無効化される）
     * リンクの有効期限切れ
     * スマホのメールアプリ内ブラウザで開くと、ログインしたいPCには反映されない
   いま入りたい端末にコードを打ち込む方式なら、この4つとも起きない。
   「ほかの端末と同期する」ためのログインなので、こちらのほうが素直でもある。

   ※ 送信メールの本文に {{ .Token }} を入れておく必要がある
      （Supabase の Authentication → Email Templates。documents/account-sync.md 参照）。 */
export async function signInWithCode(email, code) {
  if (!isCloud()) throw new Error("cloud-not-configured");
  const token = String(code || "").replace(/\D/g, "");
  if (token.length < 6) throw new Error("6桁のコードを入力してください");
  const body = (type) => JSON.stringify({ type, email: String(email).trim(), token });
  let res;
  try {
    // signInWithOtp で送ったコードの type は email。
    // 古い設定の環境では magiclink で発行されることがあるので、駄目なら順に試す
    res = await fetch(`${SUPABASE.url}/auth/v1/verify`, { method: "POST", headers: h(), body: body("email") });
    if (!res.ok) {
      res = await fetch(`${SUPABASE.url}/auth/v1/verify`, { method: "POST", headers: h(), body: body("magiclink") });
    }
  } catch {
    throw new Error("Supabase に接続できませんでした（オフライン、またはプロジェクトURLの誤り）");
  }
  if (!res.ok) {
    let detail = "";
    try { const d = await res.json(); detail = d.msg || d.error_description || d.message || d.error || ""; } catch {}
    if (res.status === 403 || res.status === 401 || /expired|invalid/i.test(detail)) {
      throw new Error("コードが違うか、有効期限が切れています。もう一度メールを送ってください");
    }
    throw new Error(`ログインできませんでした (${res.status}${detail ? `: ${detail}` : ""})`);
  }
  const d = await res.json();
  if (!d.access_token) throw new Error("ログインできませんでした（応答にトークンがありません）");
  const session = {
    access_token: d.access_token,
    refresh_token: d.refresh_token || null,
    user: d.user ? { id: d.user.id, email: d.user.email } : null,
    at: Date.now(),
    expires_at: Date.now() + (Number(d.expires_in) || 3600) * 1000,
  };
  writeSession(session);
  return session;
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
  if (err) {
    clean();
    const text = decodeURIComponent(err.replace(/\+/g, " "));
    /* Supabase は「戻り先URLが許可されていない」ときも、期限切れと同じ
       otp_expired / access_denied を返す。文面だけ見て「時間をおいて再送」を
       繰り返しても直らないので、もう一方の可能性も併せて出す。
       実測: Redirect URLs が未登録だと Site URL（初期値 http://localhost:3000）
       へ飛ばされ、リンクを開いてもサイトに戻ってこない。 */
    const code = p.get("error_code") || "";
    /* 「使えないリンク」は原因が3つあり、どれも文面は同じ otp_expired になる。
       全部並べても読めないので、対処だけを1行で示し、詳しい話は画面側に譲る。 */
    const hint = /otp_expired|access_denied|invalid/.test(`${code} ${text}`)
      ? "（リンクは一度きり・時間切れがあります。メール側の安全確認で先に開かれて"
        + "使い切られることもあります。下の「6桁のコードでログイン」が確実です）"
      : "";
    return { ok: false, error: text + hint, recoverable: true };
  }

  /* PKCE の設定になっている場合、リンクは ?code=... で戻ってくる。
     この作りでは引き換えに必要な控え（code_verifier）を持っていないので完了できない。
     黙って無視すると「リンクを開いても何も起きない」になるため、道を示す。 */
  if (p.get("code") && !p.get("access_token")) {
    clean();
    return { ok: false, recoverable: true,
      error: "このリンクの形式では、開いた端末でしかログインを完了できません。下の「6桁のコードでログイン」をお使いください。" };
  }

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

/* 起動時に呼ぶ。ログイン状態を維持するための手当て。

   アクセストークンは1時間で切れる。これまでは「使おうとした時に気づいて更新」
   だったので、久しぶりに開くと、画面はログイン済みなのに最初の操作だけ失敗して
   いた。開いた時点で先に更新しておく。
   更新できない（＝本当に期限切れ）ときは、中途半端に残さず片付けて理由を返す。

   戻り値: null（そもそも未ログイン）/ {ok:true} / {ok:false, error} */
export async function ensureFreshSession() {
  if (!isCloud()) return null;
  const s = readSession();
  if (!s || !s.access_token) return null;
  const soon = !s.expires_at || s.expires_at - Date.now() < 5 * 60 * 1000;
  if (!soon) return { ok: true };
  const next = await refreshSession();
  if (next) return { ok: true };
  // refreshSession は 400/401 のときだけセッションを捨てる。
  // 通信できなかっただけなら残っているので、そのまま維持する（圏外で締め出さない）
  if (readSession()) return { ok: true };
  return { ok: false, error: "ログインの有効期限が切れました。もう一度メールでログインしてください。" };
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

/* 同期が失敗する理由は「テーブルがまだ無い」「ログインが切れた」で対処が違うのに、
   pull-failed:404 のような文字列を画面に出していたため区別できなかった。
   実測: tastings / entitlements を作る前は REST が 404 を返す。 */
function syncError(status, what) {
  if (status === 404) {
    return new Error(`${what}用のテーブルがまだ作られていません`
      + "（Supabase の SQL Editor で documents/account-sync.md の SQL を実行してください）");
  }
  if (status === 401 || status === 403) {
    return new Error("ログインの有効期限が切れています。もう一度ログインしてください");
  }
  return new Error(`${what}に失敗しました (${status})`);
}

export async function cloudPullTastings() {
  if (!readSession()) return [];
  const res = await authFetch(`/rest/v1/tastings?select=*`);
  if (!res.ok) throw syncError(res.status, "記録の取得");
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
  if (!res.ok) throw syncError(res.status, "記録の保存");
  return true;
}

// ---- プレミアム連動（entitlements） ----
// Stripe 入金 → Edge Function(Webhook) が entitlements を更新（documents/premium.md）。
// フロントは読むだけ。RLS で自分の行しか見えないため、他人の権限は取得できない。
//
// 行そのものを返す。判定に必要なのはプラン名だけでなく status と期限で、
// 名前だけ返していたころは「解約済みだが行は残っている」を見分けられなかった。
export async function cloudGetPlan() {
  if (!readSession()) return null;
  try {
    const res = await authFetch(`/rest/v1/entitlements?select=plan,status,current_period_end`);
    if (!res.ok) return null;
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) return null;
    return rows.find((r) => r.status === "active" || r.status === "trialing") || rows[0];
  } catch { return null; }
}

// 決済を自分の行に結びつけるための ID。Stripe の client_reference_id に渡す。
export function currentUserId() {
  const s = readSession();
  return (s && (s.user_id || (s.user && s.user.id))) || null;
}
