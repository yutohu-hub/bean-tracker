// 登録済みの端末へプッシュ通知を送る（Supabase Edge Function / Deno）
//
// 呼ぶのは巡回ワークフロー。再入荷や新着レアロットを見つけたときに、
// 見出しと本文と行き先URLを渡す。
//
// デプロイ:
//   npx web-push generate-vapid-keys        # 鍵を1度だけ作る
//   supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... \
//                       VAPID_SUBJECT=mailto:you@example.com \
//                       PUSH_SEND_TOKEN=（長い乱数）
//   supabase functions deploy send-push --no-verify-jwt
//   公開鍵は frontend の NEXT_PUBLIC_VAPID_PUBLIC_KEY にも入れる（同じ値）。
//
// --no-verify-jwt な代わりに、自前の合言葉（PUSH_SEND_TOKEN）で守る。
// これが無いと、URLを知った誰でも全端末に通知を送れてしまう。
//
// 呼び方:
//   POST /functions/v1/send-push
//   x-push-token: <PUSH_SEND_TOKEN>
//   { "title": "再入荷", "body": "…", "url": "?b=12345", "tag": "restock-12345" }

import webpush from "npm:web-push@3.6.7";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@example.com";
const TOKEN = Deno.env.get("PUSH_SEND_TOKEN") ?? "";
const SITE = "https://yutohu-hub.github.io/bean-tracker/";

webpush.setVapidDetails(SUBJECT, PUBLIC, PRIVATE);

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });
  if (!TOKEN || req.headers.get("x-push-token") !== TOKEN) {
    return new Response("forbidden", { status: 403 });
  }
  if (!PUBLIC || !PRIVATE) {
    return new Response("VAPID keys are not set", { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const title = String(body.title ?? "BEAN TRACKER").slice(0, 80);
  const text = String(body.body ?? "").slice(0, 160);
  // 行き先はこのサイトの中だけに限る（外部URLを送りつけられないように）
  const url = new URL(String(body.url ?? "./"), SITE);
  if (!url.href.startsWith(SITE)) return new Response("bad url", { status: 400 });

  const payload = JSON.stringify({
    title, body: text, url: url.href,
    tag: body.tag ? String(body.tag).slice(0, 60) : undefined,
  });

  const { data: rows, error } = await admin
    .from("push_subscriptions")
    .select("endpoint, subscription");
  if (error) return new Response(error.message, { status: 500 });

  let sent = 0;
  const dead: string[] = [];
  for (const row of rows ?? []) {
    try {
      await webpush.sendNotification(row.subscription, payload);
      sent++;
    } catch (e) {
      // 404/410 は「この宛先はもう無い」。消さないと毎回送り続けることになる
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) dead.push(row.endpoint);
    }
  }
  if (dead.length) {
    await admin.from("push_subscriptions").delete().in("endpoint", dead);
  }

  return new Response(JSON.stringify({ sent, removed: dead.length, total: rows?.length ?? 0 }), {
    headers: { "Content-Type": "application/json" },
  });
});
