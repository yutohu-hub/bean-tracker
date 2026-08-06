"use client";
// プッシュ通知の購読。
//
// 「再入荷を待つ」は、本来アプリを閉じている間に効いてほしい機能なのに、
// これまでは端末内で Notification を1回出すだけの見本だった。実際に届けるには
//   1. ブラウザに購読（subscription）を作ってもらう … ここ
//   2. その宛先をサーバに預ける             … ここ
//   3. 在庫が戻ったらサーバから送る          … supabase/functions/send-push
// の3つが要る。
//
// iOS は 16.4 以降、「ホーム画面に追加」した状態でのみ通知を受け取れる。
// Safari のタブで開いているだけでは購読を作れないので、その場合は理由を返す。

import { SUPABASE, isCloud, getSession } from "./account";

// VAPID の公開鍵。秘密鍵はサーバだけが持つ（documents/home-screen-and-push.md の手順で作る）。
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

export const pushConfigured = () => !!VAPID_PUBLIC_KEY && isCloud();

function urlBase64ToUint8Array(base64) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

const standalone = () =>
  typeof window !== "undefined" &&
  (window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true);

const isIOS = () =>
  typeof navigator !== "undefined" &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

/* いまこの端末で通知を受け取れるか。受け取れないときは、その理由を日本語で返す。
   「対応していません」で終わらせると、iPhoneの人は何をすればいいか分からない。 */
export function pushAvailability() {
  if (typeof window === "undefined") return { ok: false, reason: "" };
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    if (isIOS() && !standalone()) {
      return { ok: false, reason: "iPhone では、ホーム画面に追加してから開くと通知を受け取れます（Safari下部の共有 →「ホーム画面に追加」）。" };
    }
    return { ok: false, reason: "このブラウザはプッシュ通知に対応していません。" };
  }
  if (isIOS() && !standalone()) {
    return { ok: false, reason: "iPhone では、ホーム画面に追加してから開くと通知を受け取れます（Safari下部の共有 →「ホーム画面に追加」）。" };
  }
  if (!pushConfigured()) {
    return { ok: false, reason: "通知の配信設定がまだ済んでいません（管理者向け: documents/home-screen-and-push.md）。" };
  }
  return { ok: true, reason: "" };
}

export async function pushSubscribed() {
  try {
    const reg = await navigator.serviceWorker.ready;
    return !!(await reg.pushManager.getSubscription());
  } catch { return false; }
}

/* 宛先をサーバに預ける。ログインしていれば本人の行として、
   していなければ端末の宛先として保存する（ログイン前でも再入荷は届いてほしい）。 */
async function saveSubscription(sub) {
  const s = getSession();
  const body = {
    endpoint: sub.endpoint,
    subscription: sub.toJSON(),
    user_id: (s && s.user && s.user.id) || null,
    ua: navigator.userAgent.slice(0, 200),
  };
  const res = await fetch(`${SUPABASE.url}/rest/v1/push_subscriptions?on_conflict=endpoint`, {
    method: "POST",
    headers: {
      apikey: SUPABASE.anonKey,
      Authorization: `Bearer ${(s && s.access_token) || SUPABASE.anonKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    if (res.status === 404) throw new Error("通知の宛先を保存する場所がまだありません（supabase/schema.sql を実行してください）");
    throw new Error(`通知の登録に失敗しました (${res.status})`);
  }
}

export async function enablePush() {
  const a = pushAvailability();
  if (!a.ok) throw new Error(a.reason);
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("通知が許可されませんでした（端末の設定から変更できます）");
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription())
    || (await reg.pushManager.subscribe({
      userVisibleOnly: true,        // 見えない通知は Chrome/Safari とも許さない
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    }));
  await saveSubscription(sub);
  return true;
}

export async function disablePush() {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return true;
    // 先にサーバ側を消す。宛先だけ残ると、届かない通知を送り続けることになる
    await fetch(`${SUPABASE.url}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(sub.endpoint)}`, {
      method: "DELETE",
      headers: { apikey: SUPABASE.anonKey, Authorization: `Bearer ${SUPABASE.anonKey}` },
    }).catch(() => {});
    await sub.unsubscribe();
    return true;
  } catch { return false; }
}
