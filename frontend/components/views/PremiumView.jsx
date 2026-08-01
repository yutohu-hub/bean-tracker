"use client";
import { useState, useEffect, useRef } from "react";
import { INK, PAPER, GRAY, LINE, GREEN, AMBER } from "../lib/theme";
import { BEANS } from "../data/beans";
import { ROASTERS } from "../data/roasters";
import { getNotify, setNotify, getRestocks } from "../lib/store";
import { PLANS, planLabel, LIMITS } from "../lib/entitlements";
import { usePlan, refreshPlan } from "../lib/usePlan";
import {
  checkoutUrl, isBillingConfigured, isTestMode,
  CUSTOMER_PORTAL_URL, hasCustomerPortal,
  isReturningFromCheckout, clearCheckoutFlag,
} from "../lib/billing";
import { isCloud, isSignedIn, getSession, currentUserId } from "../lib/account";
import { beanHref } from "../lib/utils";

const CATS = [
  ["geisha", "GEISHA（ゲイシャ）"],
  ["sidra", "SIDRA（シドラ）"],
  ["coe", "COE 入賞ロット"],
  ["restock", "再入荷アラート"],
];

// 入金から entitlements に反映されるまでは Webhook 一往復ぶんの間がある。
// 戻ってきた直後に「無料のまま」と出さないよう、数十秒は確認を続ける。
const POLL_MS = 2500;
const POLL_LIMIT = 14;

export function PremiumView({ onOpen, onNeedSignIn }) {
  const { plan, premium, checked } = usePlan();
  const [ready, setReady] = useState(false);
  const [notify, setNotifyState] = useState(null);
  const [saved, setSaved] = useState(false);
  const [payMsg, setPayMsg] = useState("");
  const [pushMsg, setPushMsg] = useState("");
  const [restocks, setRestocks] = useState([]);
  const [waiting, setWaiting] = useState(false);   // 決済後の反映待ち
  const [waitMsg, setWaitMsg] = useState("");
  const timer = useRef(null);

  useEffect(() => {
    setNotifyState(getNotify());
    setRestocks(getRestocks());
    setReady(true);
  }, []);

  // Stripe から戻ってきたら、反映されるまで確認を続ける
  useEffect(() => {
    if (!isReturningFromCheckout()) return;
    clearCheckoutFlag();
    setWaiting(true);
    setWaitMsg("お支払いを確認しています…");
    let n = 0;
    const tick = async () => {
      n += 1;
      const p = await refreshPlan();
      if (p && p.id && p.id.startsWith("premium")) {
        setWaiting(false);
        setWaitMsg("プレミアムを有効にしました。ありがとうございます。");
        return;
      }
      if (n >= POLL_LIMIT) {
        setWaiting(false);
        setWaitMsg("反映に時間がかかっています。決済は完了していることが多いので、少し経ってからこの画面を開き直してください。");
        return;
      }
      timer.current = setTimeout(tick, POLL_MS);
    };
    timer.current = setTimeout(tick, POLL_MS);
    return () => clearTimeout(timer.current);
  }, []);

  if (!ready || !notify) return null;

  const signedIn = isCloud() && isSignedIn();
  const session = getSession();
  const email = (session && session.user && session.user.email) || notify.email || "";

  const startCheckout = (planId) => {
    if (!signedIn) {
      // ここで勝手にタブを移すと、理由を書いたこのメッセージごと画面が消える。
      // 説明を出したうえで、移動するかは本人に選ばせる。
      setPayMsg("お支払いの前にログインが必要です。プレミアムは端末ではなくアカウントに付くため、支払いを本人に結びつけます。上の「ログインへ」からどうぞ。");
      return;
    }
    const url = checkoutUrl(planId, { userId: currentUserId(), email });
    if (!url) {
      setPayMsg("決済リンクが未設定です。docs/premium.md の手順で Stripe の Payment Link を lib/billing.js に貼ると、このボタンから申し込めるようになります。");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
    setPayMsg("Stripe の決済ページを開きました。完了するとこの画面に戻り、自動で有効になります。");
  };

  const patch = (p) => setNotifyState((n) => ({ ...n, ...p }));
  const toggleCat = (k) => setNotifyState((n) => ({ ...n, cats: { ...n.cats, [k]: !n.cats[k] } }));

  const enablePush = async () => {
    if (typeof window === "undefined" || typeof Notification === "undefined") {
      setPushMsg("この環境はブラウザ通知に対応していません。"); return;
    }
    try {
      const perm = await Notification.requestPermission();
      if (perm === "granted") { patch({ push: true }); setPushMsg("ブラウザ通知を許可しました。"); }
      else { patch({ push: false }); setPushMsg("ブラウザ通知が許可されませんでした（ブラウザ設定から変更できます）。"); }
    } catch { setPushMsg("通知の許可を取得できませんでした。"); }
  };

  const testPush = () => {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") {
      setPushMsg("先に「ブラウザ通知を許可」してください。"); return;
    }
    new Notification("BEAN TRACKER", { body: "新着レアロットが見つかったら、こんな通知が届きます。" });
  };

  const saveNotify = () => { setNotifyState(setNotify(notify)); setSaved(true); setTimeout(() => setSaved(false), 2500); };

  const card = { border: `1px solid ${LINE}`, borderRadius: 12, padding: "16px 16px" };
  const chk = (on) => ({ width: 18, height: 18, borderRadius: 5, border: `1.5px solid ${on ? INK : LINE}`, background: on ? INK : "transparent", color: PAPER, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, flexShrink: 0 });

  return (
    <div>
      {/* ヘッダー */}
      <div>
        <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, letterSpacing: "0.2em", color: GRAY }}>PREMIUM</div>
        <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>レアロットを、取りこぼさない</div>
        <div style={{ fontSize: 12, color: GRAY, marginTop: 4, lineHeight: 1.7 }}>
          巡回が世界 429 軒の在庫を追い続けています。プレミアムは、その全部を見られるプランです。
        </div>
        <div style={{ marginTop: 10, display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 12px", borderRadius: 999, background: premium ? GREEN : "#F2F0E9", color: premium ? PAPER : GRAY, fontSize: 11, fontWeight: 700 }}>
          <span style={{ width: 7, height: 7, borderRadius: 999, background: premium ? PAPER : AMBER }} />
          現在のプラン：{checked ? planLabel(plan) : "確認中…"}
        </div>
        {premium && plan.periodEnd && (
          <div style={{ fontSize: 10.5, color: GRAY, marginTop: 6 }}>
            {new Date(plan.periodEnd).toLocaleDateString("ja-JP")} まで有効
          </div>
        )}
      </div>

      {/* 決済後の反映待ち */}
      {(waiting || waitMsg) && (
        <div style={{ ...card, marginTop: 14, background: "#F2F0E9", border: "none" }}>
          <div style={{ fontSize: 12.5, color: INK, lineHeight: 1.8 }}>
            {waiting && <span style={{ marginRight: 8 }}>●</span>}{waitMsg}
          </div>
        </div>
      )}

      {/* ログイン必須の説明 */}
      {!signedIn && (
        <div style={{ ...card, marginTop: 14, borderStyle: "dashed" }}>
          <div style={{ fontSize: 12.5, fontWeight: 700 }}>先にログインしてください</div>
          <div style={{ fontSize: 11, color: GRAY, marginTop: 5, lineHeight: 1.8 }}>
            プレミアムは端末ではなくアカウントに付きます。ログインしておくと、
            スマホで申し込んだものをパソコンでもそのまま使えます。
            「☕ 味の記録」タブからメールアドレスでログインできます。
          </div>
          {onNeedSignIn && (
            <button onClick={onNeedSignIn}
              style={{ width: "100%", marginTop: 12, padding: "11px 0", background: INK, color: PAPER, border: "none", borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
              ログインへ
            </button>
          )}
        </div>
      )}

      {/* プラン */}
      <div style={{ marginTop: 20, display: "grid", gap: 12 }}>
        {PLANS.map((p) => {
          const isFree = p.id === "free";
          const active = isFree ? !premium : plan.id === p.id;
          return (
            <div key={p.id} style={{ ...card, borderColor: active ? INK : LINE, borderWidth: active ? 2 : 1, position: "relative" }}>
              {p.badge && <span style={{ position: "absolute", top: -9, right: 14, background: AMBER, color: PAPER, fontSize: 10, fontWeight: 700, padding: "2px 9px", borderRadius: 999 }}>{p.badge}</span>}
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: "0.06em" }}>{p.name}</div>
                <div><span style={{ fontFamily: "ui-monospace, monospace", fontSize: 20, fontWeight: 800 }}>{p.price}</span><span style={{ fontSize: 11, color: GRAY }}> {p.per}</span></div>
              </div>
              <div style={{ fontSize: 11, color: GRAY, marginTop: 2 }}>{p.tagline}</div>
              <ul style={{ margin: "10px 0 0", padding: 0, listStyle: "none" }}>
                {p.features.map((f) => (
                  <li key={f} style={{ display: "flex", gap: 7, fontSize: 11.5, color: INK, padding: "3px 0", lineHeight: 1.5 }}>
                    <span style={{ color: GREEN, flexShrink: 0 }}>✓</span>{f}
                  </li>
                ))}
              </ul>
              {isFree ? (
                <div style={{ marginTop: 12, padding: "11px 0", textAlign: "center", borderRadius: 8, background: "#F7F5EF", color: GRAY, fontSize: 12 }}>
                  {active ? "いま利用中のプラン" : "プレミアムを解約すると戻ります"}
                </div>
              ) : active ? (
                <div style={{ marginTop: 12, padding: "11px 0", textAlign: "center", borderRadius: 8, background: "#EDEAE1", color: GRAY, fontSize: 12.5, fontWeight: 700 }}>
                  ご利用中
                </div>
              ) : (
                <button onClick={() => startCheckout(p.id)}
                  style={{ width: "100%", marginTop: 12, padding: "11px 0", borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: "pointer", background: INK, color: PAPER, border: "none" }}>
                  {premium ? "このプランに変更" : "申し込む"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {payMsg && <div style={{ fontSize: 11, color: GREEN, marginTop: 10, lineHeight: 1.7 }}>{payMsg}</div>}

      {/* 支払いの状態 */}
      <div style={{ ...card, marginTop: 14, background: "#F7F5EF", border: "none" }}>
        <div style={{ fontSize: 12.5, fontWeight: 700 }}>お支払いについて</div>
        <div style={{ fontSize: 11, color: GRAY, marginTop: 5, lineHeight: 1.8 }}>
          カード決済は Stripe が処理します。カード番号がこのサイトに渡ることはありません。
          {isBillingConfigured() && isTestMode() && (
            <><br /><span style={{ color: AMBER, fontWeight: 700 }}>現在テストモードです。実際の請求は発生しません。</span></>
          )}
          {!isBillingConfigured() && (
            <><br /><span style={{ color: AMBER, fontWeight: 700 }}>決済リンクが未設定のため、まだ申し込みできません。</span></>
          )}
        </div>
        {premium && (
          hasCustomerPortal() ? (
            <a href={CUSTOMER_PORTAL_URL} target="_blank" rel="noopener noreferrer"
              style={{ display: "block", textAlign: "center", marginTop: 12, padding: "11px 0", background: PAPER, color: INK, border: `1.5px solid ${INK}`, borderRadius: 8, fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}>
              解約・カードの変更 ↗
            </a>
          ) : (
            <div style={{ fontSize: 11, color: GRAY, marginTop: 10, lineHeight: 1.7 }}>
              解約は Stripe から届いた領収書メールのリンク、またはお問い合わせから承ります。
            </div>
          )
        )}
      </div>

      {/* 通知センター（配信基盤は未接続。ここでは設定だけ預かる） */}
      <div style={{ ...card, marginTop: 20 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 800 }}>🔔 新着レアロット通知</div>
          <span style={{ fontSize: 9.5, fontWeight: 700, color: AMBER, border: `1px solid ${AMBER}`, borderRadius: 999, padding: "2px 8px", whiteSpace: "nowrap" }}>準備中</span>
        </div>
        <div style={{ fontSize: 11, color: GRAY, marginTop: 5, lineHeight: 1.8 }}>
          配信の仕組みはまだ動いていません。ここで預かった設定は、配信を始めるときにそのまま使います。
          プレミアムの料金には含めていません。
        </div>

        <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
          {CATS.map(([k, label]) => (
            <button key={k} onClick={() => toggleCat(k)} style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}>
              <span style={chk(notify.cats[k])}>{notify.cats[k] ? "✓" : ""}</span>
              <span style={{ fontSize: 12.5, color: INK }}>{label}</span>
            </button>
          ))}
        </div>

        <div style={{ marginTop: 16, fontSize: 12, fontWeight: 700 }}>届け先</div>
        <button onClick={() => patch({ mail: !notify.mail })} style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", padding: "8px 0 0", cursor: "pointer", textAlign: "left" }}>
          <span style={chk(notify.mail)}>{notify.mail ? "✓" : ""}</span>
          <span style={{ fontSize: 12.5, color: INK }}>メールで受け取る</span>
        </button>
        <input type="email" value={notify.email} onChange={(e) => patch({ email: e.target.value })} placeholder="you@example.com"
          style={{ width: "100%", boxSizing: "border-box", marginTop: 8, padding: "10px 12px", borderRadius: 8, border: `1px solid ${LINE}`, fontSize: 13, background: PAPER, color: INK }} />

        <button onClick={() => patch({ push: !notify.push })} style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", padding: "12px 0 0", cursor: "pointer", textAlign: "left" }}>
          <span style={chk(notify.push)}>{notify.push ? "✓" : ""}</span>
          <span style={{ fontSize: 12.5, color: INK }}>ブラウザ通知（プッシュ）で受け取る</span>
        </button>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button onClick={enablePush} style={{ flex: 1, padding: "9px 0", background: PAPER, color: INK, border: `1.5px solid ${INK}`, borderRadius: 8, fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>ブラウザ通知を許可</button>
          <button onClick={testPush} style={{ flex: 1, padding: "9px 0", background: PAPER, color: GRAY, border: `1px solid ${LINE}`, borderRadius: 8, fontSize: 11.5, cursor: "pointer" }}>通知をテスト</button>
        </div>
        {pushMsg && <div style={{ fontSize: 10.5, color: GRAY, marginTop: 6, lineHeight: 1.5 }}>{pushMsg}</div>}

        <button onClick={saveNotify} style={{ width: "100%", marginTop: 14, padding: "12px 0", background: INK, color: PAPER, border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          通知設定を保存
        </button>
        {saved && <div style={{ fontSize: 11, color: GREEN, marginTop: 8 }}>保存しました。配信を始めたらこの設定でお届けします。</div>}
      </div>

      {/* ウォッチリスト（再入荷） */}
      <div style={{ ...card, marginTop: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>再入荷ウォッチリスト</div>
          <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, color: GRAY }}>
            {restocks.length}{premium ? "" : ` / ${LIMITS.free.watchlist}`} 件
          </span>
        </div>
        {restocks.length === 0 ? (
          <div style={{ fontSize: 11, color: GRAY, marginTop: 6, lineHeight: 1.7 }}>
            SOLD OUT の豆の詳細から「再入荷を待つ」で追加できます。巡回が再入荷を見つけると、この一覧に「買う」ボタンが出ます。
          </div>
        ) : (
          <div style={{ marginTop: 8 }}>
            {restocks.map((rc) => {
              // 再入荷済みなら、待っていた人がそのまま買えるようにする
              const b = BEANS.find((x) => x.id === rc.beanId);
              const r = b && ROASTERS[b.r];
              const back = b && b.status === "now" && r && r.url;
              return (
                <div key={rc.beanId} style={{ display: "flex", alignItems: "center", gap: 10, borderTop: `1px solid ${LINE}`, padding: "10px 0" }}>
                  <button onClick={() => { if (b && onOpen) onOpen(b); }}
                    style={{ display: "flex", justifyContent: "space-between", flex: 1, minWidth: 0, gap: 8, background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: INK }}>{rc.name}</span>
                    <span style={{ fontSize: 10.5, color: GRAY, flexShrink: 0 }}>{rc.roaster}</span>
                  </button>
                  {back ? (
                    <a href={beanHref(r, b)} target="_blank" rel="noopener noreferrer"
                      style={{ flexShrink: 0, textDecoration: "none", padding: "6px 12px", background: INK, color: PAPER, borderRadius: 6, fontSize: 10.5, fontWeight: 700, whiteSpace: "nowrap" }}>
                      買う ↗
                    </a>
                  ) : (
                    <span style={{ flexShrink: 0, fontSize: 10, color: GRAY, whiteSpace: "nowrap" }}>入荷待ち</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ marginTop: 20, padding: "12px 14px", border: `1px dashed ${LINE}`, borderRadius: 10, fontSize: 10.5, color: GRAY, lineHeight: 1.8 }}>
        プレミアムの権限はアカウントに保存され、決済の記録だけを根拠に有効になります（この端末の操作では変わりません）。
        通知の配信だけはまだ動いていないため、料金に含めず「準備中」と表示しています。
      </div>
    </div>
  );
}
