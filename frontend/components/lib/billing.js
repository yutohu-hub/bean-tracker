// Stripe Payment Links（静的サイトのまま決済可能・サーバー不要・秘密鍵不要）
//
// 有効化手順:
//   1. Stripe 管理画面 → 「商品」で「PREMIUM 月額 ¥480」「PREMIUM 年額 ¥4,800」を作成
//   2. 各商品から Payment Link を発行（https://buy.stripe.com/... の URL が出ます）
//   3. その URL を下の PAYMENT_LINKS に貼り付けてコミット
//   → 「クレジットカードで申し込む」ボタンがそのまま本番決済になります
//
// ※ ここに貼るのは公開URLのみ。秘密鍵(sk_...)は絶対に置かないこと。
// ※ 入金後のプレミアム自動解放（Webhook）は別途バックエンドが必要
//    （docs/notifications-and-billing.md のルート②）。Payment Links 単体では
//    「決済は取れる／解放は手動 or 後でWebhook追加」になります。

export const PAYMENT_LINKS = {
  premium_monthly: "", // 例: "https://buy.stripe.com/xxxxxxxxxxxxxxxx"
  premium_yearly: "",  // 例: "https://buy.stripe.com/yyyyyyyyyyyyyyyy"
};

export function isBillingConfigured() {
  return Object.values(PAYMENT_LINKS).some((v) => !!v);
}

// 選択プランの Payment Link を返す（メールがあれば決済画面に事前入力）。未設定なら null。
export function paymentLinkFor(planId, opts = {}) {
  const base = PAYMENT_LINKS[planId];
  if (!base) return null;
  try {
    const u = new URL(base);
    if (opts.email) u.searchParams.set("prefilled_email", opts.email);
    return u.toString();
  } catch {
    return base;
  }
}
