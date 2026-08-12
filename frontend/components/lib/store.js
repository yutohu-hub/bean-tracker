/* ローカルアカウント & 味の記録（localStorage 保存）
 *
 * 記録は消えてはいけないもの。原本はこの端末で、クラウド同期はその写し。
 *
 * ■ 守ること
 *   1. アカウントごとに別の引き出しに入れる（別の人がログインしても混ざらない）
 *   2. 引き出しが変わるときは「写す」のではなく「移す」
 *   3. 消したことも記録に残す（消えたのか、まだ届いていないのかを区別する）
 *   4. 記録した日は、あとから直しても動かさない
 *   5. 保存に失敗したら、黙って捨てずに呼び出し側へ伝える
 *   6. ブラウザに「消さないでほしい」と申告する（persist）
 *
 * ■ なぜこう決めたか（実際に起きていたこと）
 *
 * 引き出しの名前が「いまログインしているか」で変わるのに、
 * 移し替えが「初回だけ・写すだけ」だったため、次の2つが起きていた。
 *
 *   - ログアウトすると記録が1件も見えなくなる（家がアカウント側に有るまま）
 *   - ログアウト中に足した記録が、次にログインしても引き継がれず、
 *     匿名の引き出しに取り残されて二度と出てこない
 *
 * さらに、削除はクラウドに伝わらないので、消した記録が次の同期で復活し、
 * 評価を直すと「飲んだ日」が今日に書き換わっていた。
 * どれも「記録が残る」という前提を壊すので、まとめて直してある。
 */
// 拡張子まで書く。こう書いてあると、Node からそのまま読める＝テストにかけられる
import { currentUserId } from "./account.js";

const USER_KEY = "bt_user";
const TASTE_KEY = "bt_tastings";
const ARCHIVE_KEY = "bt_archive";
const PLAN_KEY = "bt_plan";
const NOTIFY_KEY = "bt_notify";
const RESTOCK_KEY = "bt_restocks";
const DELETED_KEY = "bt_deleted";      // 消した記録の墓標（同期先にも消したことを伝える）
const DIAG_KEY = "bt_diag_history";
const ANALYSIS_KEY = "bt_analysis_history";

function read(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
/* 書けたかどうかを返す。書けなかったことを黙って飲み込むと、
   端末の保存領域がいっぱいのときに、記録が消えたことに誰も気づけない。 */
function write(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch { return false; }
}
// 保存できなかったときに投げる。呼び出し側はこれを捕まえて画面に出す
export class SaveFailed extends Error {
  constructor() { super("この端末に保存できませんでした（保存領域がいっぱいの可能性があります）"); this.name = "SaveFailed"; }
}
function writeOrThrow(key, val) { if (!write(key, val)) throw new SaveFailed(); }

function uidOrNull() {
  try { return currentUserId(); } catch { return null; }
}

/* 記録の置き場所。ログインしていればアカウントごとに分ける。
   分けないと、同じ端末で別のアカウントにログインした人に前の人の記録が見え、
   同期でクラウドにも混ざってしまう。

   引き出しが変わるときは、匿名側を「写す」のではなく「移す」。
   写すだけだと同じ記録が2か所に残り、そのあと匿名側に足したぶんが
   どちらからも見えなくなる（実際にそうなっていた）。 */
function tasteKey() {
  const uid = uidOrNull();
  if (!uid) return TASTE_KEY;
  const key = `${TASTE_KEY}:${uid}`;
  adopt(key, TASTE_KEY);
  adopt(`${DELETED_KEY}:${uid}`, DELETED_KEY);
  return key;
}

/* 匿名の引き出し(from)に残っているものを、アカウントの引き出し(to)へ合流させて空にする。
   初回だけでなく毎回通る。ログアウト中に足した記録は、次にログインした人のものになる。 */
function adopt(to, from) {
  try {
    const raw = localStorage.getItem(from);
    if (!raw) return;
    const incoming = JSON.parse(raw);
    if (!Array.isArray(incoming) || incoming.length === 0) { localStorage.removeItem(from); return; }
    const cur = read(to, []);
    const map = new Map((Array.isArray(cur) ? cur : []).map((t) => [t.beanId, t]));
    for (const t of incoming) {
      if (t.beanId == null) continue;
      const now = map.get(t.beanId);
      if (!now || stamp(t) > stamp(now)) map.set(t.beanId, t);
    }
    // 移し終わってから元を消す。逆にすると、途中で失敗したときに記録ごと消える
    if (!write(to, [...map.values()].sort((a, b) => stamp(b) - stamp(a)))) return;
    localStorage.removeItem(from);
  } catch {}
}

// 新しさの比較に使う時刻。at は「飲んだ日」なので、直した時刻は updatedAt で別に持つ
const stamp = (t) => Number(t && (t.updatedAt || t.at)) || 0;

/* 「この端末のデータを消さないでほしい」とブラウザに申告する。
   iOS Safari は、しばらく開かれないサイトの保存領域を消すことがある。
   許可されるかはブラウザ次第だが、申告しておかないと必ず消去対象になる。 */
export async function keepForever() {
  try {
    if (!navigator.storage || !navigator.storage.persist) return null;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch { return null; }
}

export function getUser() { return read(USER_KEY, null); }
// email は「この端末での本人の目印」。メール認証が済むまではサーバーには渡さない
export function setUser(name, email = null) {
  const u = { name: String(name).trim().slice(0, 24), since: Date.now() };
  if (email) u.email = String(email).trim().slice(0, 120);
  write(USER_KEY, u);
  return u;
}
export function logout() { try { localStorage.removeItem(USER_KEY); } catch {} }

export function getTastings() { const l = read(tasteKey(), []); return Array.isArray(l) ? l : []; }
export function getTasting(beanId) { return getTastings().find((t) => t.beanId === beanId) || null; }

/* 記録する・直す。
   at は「飲んだ日」。あとから評価やメモを直しても動かさない。
   前は直すたびに at を今にしていたので、1月に飲んだ豆の評価を8月に直すと、
   カレンダーでも一覧でも8月に飲んだことになっていた。 */
export function upsertTasting(rec) {
  const now = Date.now();
  const prev = getTastings().find((t) => t.beanId === rec.beanId);
  const list = getTastings().filter((t) => t.beanId !== rec.beanId);
  list.unshift({ ...prev, ...rec, at: (prev && prev.at) || rec.at || now, updatedAt: now });
  writeOrThrow(tasteKey(), list.sort((a, b) => stamp(b) - stamp(a)));
  // 消したものを記録し直したときは、墓標を取り下げる
  dropTombstone(rec.beanId);
  return list;
}

/* 昔の豆番号で残っている記録を、新しい番号に付け替える。
   番号だけを差し替え、評価もメモも飲んだ日もそのまま残す。
   どれを付け替えるかは lib/relink.js が決める（ここは書き込むだけ）。 */
export function applyRelink(plan) {
  if (!Array.isArray(plan) || !plan.length) return 0;
  const list = getTastings();
  const to = new Map(plan.map((p) => [p.from, p.to]));
  let n = 0;
  const next = list.map((t) => {
    const dst = to.get(t.beanId);
    if (dst === undefined) return t;
    n += 1;
    /* updatedAt は動かさない。ここで今の時刻にすると、付け替えただけの記録が
       クラウド上の新しい記録に勝ってしまい、他の端末で直した内容を巻き戻す。 */
    return { ...t, beanId: dst };
  });
  if (!n) return 0;
  writeOrThrow(tasteKey(), next);

  /* 昔の番号を墓標に入れる。入れないと同じ豆が2件に増える。
     クラウドの行は bean_id が鍵なので、付け替えても向こうには昔の番号の行が
     残ったままになる。次の同期でそれを取り込むと、同じ豆が新旧2つの番号で並ぶ。
     （実際に再現した。付け替え後に昔の行を合流させると2件になった）

     墓標に入れておけば、同期の最初に cloudDeleteTastings が向こうの行を消し、
     合流のときも墓標より古い行として弾かれる。削除の仕組みをそのまま使う。 */
  const at = Date.now();
  const olds = new Set(plan.map((p) => p.from));
  const tomb = getTombstones().filter((d) => !olds.has(d.beanId));
  for (const id of olds) tomb.unshift({ beanId: id, at });
  write(deletedKey(), tomb.slice(0, 500));
  return n;
}

/* 消す。消したことも残す。
   墓標が無いと、クラウドには消す前の行が残ったままなので、
   次の同期でそれを取り込んで復活してしまう（実際に復活していた）。 */
export function removeTasting(beanId) {
  const list = getTastings().filter((t) => t.beanId !== beanId);
  writeOrThrow(tasteKey(), list);
  const tomb = getTombstones().filter((d) => d.beanId !== beanId);
  tomb.unshift({ beanId, at: Date.now() });
  write(deletedKey(), tomb.slice(0, 500));
  return list;
}

function deletedKey() {
  const uid = uidOrNull();
  return uid ? `${DELETED_KEY}:${uid}` : DELETED_KEY;
}
export function getTombstones() { const l = read(deletedKey(), []); return Array.isArray(l) ? l : []; }

/* ログアウト中でも、この端末に何件しまってあるかは言える。
   0件の画面だけ見せると「消えた」と思わせるが、実際はアカウントの引き出しに入っている。 */
export function keptTastingCount() {
  try {
    let n = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k !== TASTE_KEY && !(k || "").startsWith(`${TASTE_KEY}:`)) continue;
      const l = read(k, []);
      if (Array.isArray(l)) n += l.length;
    }
    return n;
  } catch { return 0; }
}
function dropTombstone(beanId) {
  const tomb = getTombstones();
  if (!tomb.some((d) => d.beanId === beanId)) return;
  write(deletedKey(), tomb.filter((d) => d.beanId !== beanId));
}
/* 同期でクラウド側からも消せたぶんの墓標を片付ける。
   消せていないうちは残しておく（次の同期でもう一度試す）。 */
export function clearTombstones(beanIds) {
  const gone = new Set(beanIds || []);
  write(deletedKey(), getTombstones().filter((d) => !gone.has(d.beanId)));
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

/* クラウドから取ってきたぶんを端末内に合流させる。
   直した時刻(updatedAt)が新しい方を採用する。at は「飲んだ日」なので比較には使わない。
   消したものは、墓標より古い行が来ても戻さない。 */
export function mergeTastings(incoming) {
  const tomb = new Map(getTombstones().map((d) => [d.beanId, d.at || 0]));
  const map = new Map(getTastings().map((t) => [t.beanId, t]));
  for (const t of incoming || []) {
    if (t.beanId == null) continue;
    // こちらで消したあとに向こうで書き直されたものだけ復活させる
    const buried = tomb.get(t.beanId);
    if (buried != null && stamp(t) <= buried) continue;
    const cur = map.get(t.beanId);
    if (!cur || stamp(t) >= stamp(cur)) map.set(t.beanId, { ...cur, ...t });
  }
  const list = [...map.values()].sort((a, b) => stamp(b) - stamp(a));
  writeOrThrow(tasteKey(), list);
  return list;
}

/* ---- 書き出し / 読み込み ----
   端末が変わっても、ブラウザのデータを消しても、記録だけは戻せるようにする。
   クラウド同期は設定に依存するが、これはファイル1つで完結するので確実。 */
// アーカイブの端末内永続化
// 一度アーカイブになった豆のスナップショットを保存し、データ更新（再デプロイ）で
// カタログから消えても残り続けるようにする。既存スナップショットは上書きしない
// （「EC から消える前のカードのまま変更しない」ため、初出時の状態を保持）。
export function getArchivedBeans() { const l = read(ARCHIVE_KEY, []); return Array.isArray(l) ? l : []; }
/* 控えの重複は番号ではなく「店＋豆名」で見る。
   番号で見ていたころは、豆の番号が変わると同じ豆をもう一度足していた。
   控えは図鑑から消えた豆を残すためのものなので、番号の付け替え（relink）では
   拾えない（付け替え先が図鑑にもう無い）。だから鍵の方を変える。 */
const archKey = (b) => `${b.r || ""}::${String(b.name || "").trim().toLowerCase()}`;

export function syncArchive(currentArchive) {
  const stored = getArchivedBeans();
  const have = new Set(stored.map(archKey));
  let changed = false;
  for (const b of currentArchive) {
    const k = archKey(b);
    if (!have.has(k)) { stored.push(b); have.add(k); changed = true; }
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
/* 再入荷ウォッチの番号も付け替える。
   ここも beanId が鍵なので、付け替えないと「知らせる」に入れたはずの豆が
   外れて見える（isRestock が新しい番号で引けない）。
   しかも昔の番号の分は残り続けるので、無料プランのウォッチ上限も食う。 */
export function applyRestockRelink(plan) {
  if (!Array.isArray(plan) || !plan.length) return 0;
  const to = new Map(plan.map((p) => [p.from, p.to]));
  const list = getRestocks();
  let n = 0;
  const next = list.map((x) => {
    const dst = to.get(x.beanId);
    if (dst === undefined) return x;
    n += 1;
    return { ...x, beanId: dst };
  });
  if (!n) return 0;
  write(RESTOCK_KEY, next);
  return n;
}

export function toggleRestock(rec) {
  const list = getRestocks();
  const i = list.findIndex((x) => x.beanId === rec.beanId);
  if (i >= 0) list.splice(i, 1); else list.unshift({ ...rec, at: Date.now() });
  write(RESTOCK_KEY, list);
  return list;
}
