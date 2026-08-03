// プレミアム権限の一元管理。
//
// 原則: プレミアムかどうかを決めるのは「支払いの記録」だけ。
//   Stripe の決済 → Webhook → Supabase の entitlements 行 → ここが読む。
//   端末に置くのはその写しであって、権限そのものではない。
//   （以前は画面のボタンが直接 localStorage に premium を書いていたため、
//     誰でも無料でプレミアムになれた。書き込み口はこのファイルに持たせない。）
//
// オフラインの扱い: 写しには「支払い済み期間の終わり(periodEnd)」を持たせ、
//   その日までは通信できなくてもプレミアムとして扱う。期限を過ぎた写しは無効。
//   支払い済みの人が圏外で締め出されず、解約した人が居座ることもない。

import { isCloud, isSignedIn, cloudGetPlan } from "./account";

const CACHE_KEY = "bt_entitlement";

export const PLANS = [
  {
    id: "free", name: "FREE", price: "¥0", per: "",
    tagline: "世界の豆を、探して辿り着く",
    features: [
      "図鑑・地球儀・診断・味わいマップ",
      "レアロットは各カテゴリ 10 銘柄まで",
      "味の記録（写真1枚つき）",
      "再入荷ウォッチ 3 銘柄まで",
    ],
  },
  {
    id: "premium_monthly", name: "PREMIUM", price: "¥480", per: "/ 月",
    tagline: "レアロットを、取りこぼさない",
    features: [
      "レアロットを全件表示（上限なし）",
      "再入荷ウォッチ 上限なし",
      "記録の全期間アーカイブと分析",
      "複数端末で同期",
    ],
  },
  {
    id: "premium_yearly", name: "PREMIUM 年額", price: "¥4,800", per: "/ 年",
    tagline: "2ヶ月ぶんお得",
    features: ["月額プランの全機能", "12ヶ月ぶんの料金で 14ヶ月ぶん", "新機能への先行アクセス"],
    badge: "おすすめ",
  },
];

// 無料プランの上限。プレミアムは Infinity。ここを1か所に集めて、
// 画面ごとに違う数字が書かれる状態を作らない。
export const LIMITS = {
  free: { rareLots: 10, watchlist: 3, archiveMonths: 6 },
  premium: { rareLots: Infinity, watchlist: Infinity, archiveMonths: Infinity },
};

export const FREE_PLAN = { id: "free", status: "none", periodEnd: null, source: "default" };

function readCache() {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY));
    return c && typeof c === "object" && c.id ? c : null;
  } catch { return null; }
}

function writeCache(p) {
  try {
    if (p && p.id && p.id !== "free") localStorage.setItem(CACHE_KEY, JSON.stringify(p));
    else localStorage.removeItem(CACHE_KEY);
  } catch {}
}

export function isPremiumPlan(plan) {
  if (!plan || !plan.id || !plan.id.startsWith("premium")) return false;
  // 解約・支払い失敗は status で落ちる。periodEnd を過ぎた写しも無効。
  if (plan.status && !["active", "trialing"].includes(plan.status)) return false;
  if (plan.periodEnd && Date.now() > new Date(plan.periodEnd).getTime()) return false;
  return true;
}

export function limitsFor(plan) { return isPremiumPlan(plan) ? LIMITS.premium : LIMITS.free; }

// 端末に残っている写しを、期限を見たうえで返す。起動直後の一瞬だけ使う。
export function cachedPlan() {
  const c = readCache();
  return c && isPremiumPlan(c) ? c : FREE_PLAN;
}

/* 権威（Supabase）に問い合わせて確定させる。
   - 未ログイン / 未設定 → 無料。写しも消す（別の人が同じ端末を使う場合があるため）
   - 応答あり → その内容で写しを更新
   - 通信失敗 → 期限内の写しがあればそれを使う（圏外で締め出さない） */
export async function resolvePlan() {
  if (!isCloud() || !isSignedIn()) { writeCache(null); return FREE_PLAN; }
  try {
    const row = await cloudGetPlan();
    if (!row) { writeCache(null); return FREE_PLAN; }
    const plan = {
      id: row.plan || "free",
      status: row.status || "active",
      periodEnd: row.current_period_end || null,
      source: "cloud",
      checkedAt: Date.now(),
    };
    writeCache(isPremiumPlan(plan) ? plan : null);
    return isPremiumPlan(plan) ? plan : FREE_PLAN;
  } catch {
    return cachedPlan();          // 通信できないだけ。支払い済み期間内なら維持する
  }
}

export function planLabel(plan) {
  if (!isPremiumPlan(plan)) return "FREE";
  return plan.id === "premium_yearly" ? "PREMIUM 年額" : "PREMIUM 月額";
}
