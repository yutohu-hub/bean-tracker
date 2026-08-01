// Stripe Webhook → entitlements 更新（Supabase Edge Function / Deno）
//
// これがプレミアム権限の唯一の発行元。フロントは読むだけで、書けない。
//
// デプロイ:
//   supabase functions deploy stripe-webhook --no-verify-jwt
//   supabase secrets set STRIPE_SECRET_KEY=sk_... STRIPE_WEBHOOK_SECRET=whsec_...
//   （SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY は Supabase が自動で入れる）
//
// --no-verify-jwt が要る理由: 呼ぶのは Stripe であって、ログイン済みの利用者ではない。
// 代わりに Stripe の署名を検証する。署名検証を省くと、誰でもこの URL を叩いて
// 自分にプレミアムを付けられる。

import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});
const WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,      // RLS を迂回できる鍵。絶対にフロントへ出さない
  { auth: { persistSession: false } },
);

// Stripe の price ID → こちらのプラン名。Stripe 管理画面の price_... を貼る。
const PLAN_BY_PRICE: Record<string, string> = {
  [Deno.env.get("STRIPE_PRICE_MONTHLY") ?? "price_monthly_unset"]: "premium_monthly",
  [Deno.env.get("STRIPE_PRICE_YEARLY") ?? "price_yearly_unset"]: "premium_yearly",
};

function planOf(sub: Stripe.Subscription): string {
  const priceId = sub.items?.data?.[0]?.price?.id ?? "";
  if (PLAN_BY_PRICE[priceId]) return PLAN_BY_PRICE[priceId];
  // price ID を設定していなくても、請求間隔から月額/年額は判断できる
  return sub.items?.data?.[0]?.price?.recurring?.interval === "year"
    ? "premium_yearly" : "premium_monthly";
}

async function upsert(userId: string, row: Record<string, unknown>) {
  const { error } = await db.from("entitlements")
    .upsert({ user_id: userId, ...row, updated_at: new Date().toISOString() },
            { onConflict: "user_id" });
  if (error) throw new Error(`upsert failed: ${error.message}`);
}

// 解約や更新のイベントには user_id が載っていない。顧客IDから引き当てる。
async function userIdByCustomer(customerId: string): Promise<string | null> {
  const { data } = await db.from("entitlements")
    .select("user_id").eq("stripe_customer_id", customerId).maybeSingle();
  return data?.user_id ?? null;
}

Deno.serve(async (req) => {
  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("missing signature", { status: 400 });

  let event: Stripe.Event;
  try {
    // 生の本文で検証する。JSON にパースしてから文字列に戻すと署名が合わなくなる。
    const raw = await req.text();
    event = await stripe.webhooks.constructEventAsync(raw, sig, WEBHOOK_SECRET);
  } catch (e) {
    return new Response(`signature verification failed: ${e.message}`, { status: 400 });
  }

  // Stripe は同じイベントを再送する。二重処理を防ぐ（主キー衝突＝処理済み）。
  const seen = await db.from("stripe_events").insert({ id: event.id, type: event.type });
  if (seen.error && seen.error.code === "23505") return new Response("duplicate", { status: 200 });

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object as Stripe.Checkout.Session;
        // 決済を利用者に結びつける唯一の手がかり。フロントが Payment Link に載せている。
        const userId = s.client_reference_id;
        if (!userId) {
          // 誰の支払いか分からない。落とさず記録だけ残し、手当てできるようにする。
          console.error("client_reference_id missing", { session: s.id, email: s.customer_details?.email });
          return new Response("no client_reference_id", { status: 200 });
        }
        if (!s.subscription) {                    // 単発課金の場合
          await upsert(userId, { plan: "premium_monthly", status: "active",
                                 stripe_customer_id: String(s.customer ?? "") });
          break;
        }
        const sub = await stripe.subscriptions.retrieve(String(s.subscription));
        await upsert(userId, {
          plan: planOf(sub),
          status: sub.status,
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          stripe_customer_id: String(s.customer ?? ""),
          stripe_subscription_id: sub.id,
        });
        break;
      }

      // 更新・支払い失敗・解約。状態をそのまま写す。
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = await userIdByCustomer(String(sub.customer));
        if (!userId) { console.error("unknown customer", sub.customer); break; }
        await upsert(userId, {
          plan: event.type.endsWith("deleted") ? "free" : planOf(sub),
          status: event.type.endsWith("deleted") ? "canceled" : sub.status,
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          stripe_subscription_id: sub.id,
        });
        break;
      }

      // 継続課金が通った。期間の終わりを延ばす。
      case "invoice.paid": {
        const inv = event.data.object as Stripe.Invoice;
        if (!inv.subscription) break;
        const sub = await stripe.subscriptions.retrieve(String(inv.subscription));
        const userId = await userIdByCustomer(String(inv.customer));
        if (!userId) { console.error("unknown customer", inv.customer); break; }
        await upsert(userId, {
          plan: planOf(sub), status: sub.status,
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
        });
        break;
      }
    }
  } catch (e) {
    // 500 を返すと Stripe が再送してくれる。握り潰して 200 にしない。
    console.error("handler failed", event.type, e);
    return new Response(`handler failed: ${e.message}`, { status: 500 });
  }

  return new Response("ok", { status: 200 });
});
