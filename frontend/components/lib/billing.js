// Stripe 決済への導線（静的サイトのまま・サーバー不要・秘密鍵不要）
//
// 有効化手順は docs/premium.md。ここに置くのは公開URLだけで、
// 秘密鍵(sk_...)や Webhook シークレットは絶対に置かない。
//
// 重要: 決済を「誰の支払いか」に結びつけるのは client_reference_id。
//   Stripe はこの値を Webhook の checkout.session.completed にそのまま載せて返すので、
//   Supabase の user.id を入れておけば、Edge Function が entitlements の
//   どの行を更新すべきか判断できる。これが無いと入金と利用者が紐づかず、
//   「払ったのに解放されない」が必ず起きる。

export const PAYMENT_LINKS = {
  // Stripe テストモードの Payment Link（本番切替時は test_ なしの URL に差し替え）
  premium_monthly: "https://buy.stripe.com/test_eVqcN66AA0kY97h5tgbAs00",
  premium_yearly: "https://buy.stripe.com/test_14A9AU4ssgjWdnx1d0bAs01",
};

// 解約・カード変更のための Stripe カスタマーポータル。
// Stripe 管理画面 → 設定 → 請求 → カスタマーポータル でリンクを発行して貼る。
export const CUSTOMER_PORTAL_URL = "";

// 貼られている URL がテストモードのものか。テストのままだと本物の課金は発生しない。
export const isTestMode = () =>
  Object.values(PAYMENT_LINKS).some((v) => v && v.includes("/test_"));

export function isBillingConfigured() {
  return Object.values(PAYMENT_LINKS).some((v) => !!v);
}

export const hasCustomerPortal = () => !!CUSTOMER_PORTAL_URL;

/* 決済ページの URL を組み立てる。userId が無いときは null を返す。
   ここで黙って userId 無しのリンクを返すと、入金はされるのに誰の支払いか
   分からない決済が発生してしまうため、リンクを作らせない。 */
export function checkoutUrl(planId, { userId, email } = {}) {
  const base = PAYMENT_LINKS[planId];
  if (!base || !userId) return null;
  try {
    const u = new URL(base);
    u.searchParams.set("client_reference_id", userId);
    if (email) u.searchParams.set("prefilled_email", email);
    return u.toString();
  } catch { return null; }
}

// 決済から戻ってきた直後かどうか（Stripe の成功後リダイレクト先に付ける印）
export const CHECKOUT_FLAG = "checkout";

export function isReturningFromCheckout() {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get(CHECKOUT_FLAG) === "success";
}

// 印を消す。反映待ちの表示が、リロードのたびに何度も出ないようにする。
export function clearCheckoutFlag() {
  if (typeof window === "undefined") return;
  try {
    const u = new URL(window.location.href);
    u.searchParams.delete(CHECKOUT_FLAG);
    window.history.replaceState({}, "", u.pathname + u.search + u.hash);
  } catch {}
}
