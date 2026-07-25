"use client";
import { useState, useEffect } from "react";
import { INK, PAPER, GRAY, LINE, GREEN, AMBER } from "../lib/theme";
import { BEANS } from "../data/beans";
import { getPlan, setPlan, getNotify, setNotify, getRestocks } from "../lib/store";
import { paymentLinkFor } from "../lib/billing";

// プラン定義（課金の受け皿）
const PLANS = [
  { id: "free", name: "FREE", price: "¥0", per: "", tagline: "図鑑を探して辿り着く", features: ["図鑑・地球儀・診断・味わい・レアロットの閲覧", "味の記録（この端末に保存）"] },
  { id: "premium_monthly", name: "PREMIUM", price: "¥480", per: "/ 月", tagline: "レアロットを逃さない", features: ["新着レアロット即時通知（GEISHA / SIDRA / COE）", "SOLD OUT 豆の再入荷アラート", "ウォッチリスト無制限", "為替アラート（今後）"] },
  { id: "premium_yearly", name: "PREMIUM 年額", price: "¥4,800", per: "/ 年", tagline: "2ヶ月分お得", features: ["月額プランの全機能", "年額でおよそ2ヶ月分お得", "新機能への優先アクセス"], badge: "おすすめ" },
];

const CATS = [
  ["geisha", "GEISHA（ゲイシャ）"],
  ["sidra", "SIDRA（シドラ）"],
  ["coe", "COE 入賞ロット"],
  ["restock", "再入荷アラート"],
];

export function PremiumView({ onOpen }) {
  const [ready, setReady] = useState(false);
  const [plan, setPlanState] = useState({ id: "free" });
  const [notify, setNotifyState] = useState(null);
  const [saved, setSaved] = useState(false);
  const [payMsg, setPayMsg] = useState("");
  const [pushMsg, setPushMsg] = useState("");
  const [restocks, setRestocks] = useState([]);

  useEffect(() => {
    setPlanState(getPlan());
    setNotifyState(getNotify());
    setRestocks(getRestocks());
    setReady(true);
  }, []);
  if (!ready || !notify) return null;

  const isPremium = plan.id.startsWith("premium");

  const choosePlan = (id) => {
    setPlanState(setPlan(id));
    setPayMsg(id === "free"
      ? "FREE プランに設定しました。"
      : "お申し込み内容をこの端末に保存しました。決済（Stripe Checkout など）はバックエンド連携後に有効化されます。");
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
        <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, letterSpacing: "0.2em", color: GRAY }}>PREMIUM &amp; ALERTS</div>
        <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>レアロットを、見逃さない</div>
        <div style={{ fontSize: 12, color: GRAY, marginTop: 4, lineHeight: 1.7 }}>
          世界のどこかで新しいゲイシャ・シドラ・COE が出た瞬間に通知します。プレミアムで再入荷アラートやウォッチリストも。
        </div>
        <div style={{ marginTop: 10, display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 12px", borderRadius: 999, background: isPremium ? GREEN : "#F2F0E9", color: isPremium ? PAPER : GRAY, fontSize: 11, fontWeight: 700 }}>
          <span style={{ width: 7, height: 7, borderRadius: 999, background: isPremium ? PAPER : AMBER }} />
          現在のプラン：{isPremium ? (plan.id === "premium_yearly" ? "PREMIUM 年額" : "PREMIUM 月額") : "FREE"}
        </div>
      </div>

      {/* プラン（課金の受け皿） */}
      <div style={{ marginTop: 20, display: "grid", gap: 12 }}>
        {PLANS.map((p) => {
          const active = plan.id === p.id;
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
              <button onClick={() => choosePlan(p.id)} disabled={active}
                style={{ width: "100%", marginTop: 12, padding: "11px 0", borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: active ? "default" : "pointer",
                  background: active ? "#EDEAE1" : (p.id === "free" ? PAPER : INK), color: active ? GRAY : (p.id === "free" ? INK : PAPER),
                  border: p.id === "free" && !active ? `1.5px solid ${INK}` : "none" }}>
                {active ? "選択中" : p.id === "free" ? "FREE にする" : "このプランを選ぶ"}
              </button>
            </div>
          );
        })}
      </div>

      {/* 決済（Stripe Payment Links） */}
      {isPremium && (
        <div style={{ ...card, marginTop: 12, background: "#F2F0E9", border: "none" }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>お支払い</div>
          <div style={{ fontSize: 11, color: GRAY, marginTop: 4, lineHeight: 1.7 }}>
            クレジットカード決済は Stripe。アプリ版は App Store / Google Play の課金に対応予定です。
          </div>
          <button onClick={() => {
              const link = paymentLinkFor(plan.id, { email: notify.email });
              if (link) { window.open(link, "_blank", "noopener,noreferrer"); setPayMsg("Stripe の決済ページを開きました。"); }
              else { setPayMsg("Stripe Payment Link が未設定です。lib/billing.js に buy.stripe.com の URL を貼ると、このボタンから本番決済できます。お申し込み内容はこの端末に保存済みです。"); }
            }}
            style={{ width: "100%", marginTop: 10, padding: "11px 0", background: INK, color: PAPER, border: "none", borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
            クレジットカードで申し込む
          </button>
        </div>
      )}
      {payMsg && <div style={{ fontSize: 11, color: GREEN, marginTop: 8, lineHeight: 1.6 }}>{payMsg}</div>}

      {/* 通知センター */}
      <div style={{ ...card, marginTop: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 800 }}>🔔 新着レアロット通知</div>
        <div style={{ fontSize: 11, color: GRAY, marginTop: 3, lineHeight: 1.6 }}>受け取りたいカテゴリと届け先を設定します。</div>

        {/* カテゴリ */}
        <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
          {CATS.map(([k, label]) => (
            <button key={k} onClick={() => toggleCat(k)} style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}>
              <span style={chk(notify.cats[k])}>{notify.cats[k] ? "✓" : ""}</span>
              <span style={{ fontSize: 12.5, color: INK }}>{label}</span>
            </button>
          ))}
        </div>

        {/* 届け先：メール */}
        <div style={{ marginTop: 16, fontSize: 12, fontWeight: 700 }}>届け先</div>
        <button onClick={() => patch({ mail: !notify.mail })} style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", padding: "8px 0 0", cursor: "pointer", textAlign: "left" }}>
          <span style={chk(notify.mail)}>{notify.mail ? "✓" : ""}</span>
          <span style={{ fontSize: 12.5, color: INK }}>メールで受け取る</span>
        </button>
        <input type="email" value={notify.email} onChange={(e) => patch({ email: e.target.value })} placeholder="you@example.com"
          style={{ width: "100%", boxSizing: "border-box", marginTop: 8, padding: "10px 12px", borderRadius: 8, border: `1px solid ${LINE}`, fontSize: 13, background: PAPER, color: INK }} />

        {/* 届け先：ブラウザ通知 */}
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
        {saved && <div style={{ fontSize: 11, color: GREEN, marginTop: 8 }}>保存しました。新着を検知したら（バックエンド連携後）お届けします。</div>}
      </div>

      {/* ウォッチリスト（再入荷） */}
      <div style={{ ...card, marginTop: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>再入荷ウォッチリスト</div>
          <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, color: GRAY }}>{restocks.length} 件</span>
        </div>
        {restocks.length === 0 ? (
          <div style={{ fontSize: 11, color: GRAY, marginTop: 6, lineHeight: 1.7 }}>SOLD OUT の豆の詳細から「再入荷を待つ」で追加できます。再入荷したら通知します。</div>
        ) : (
          <div style={{ marginTop: 8 }}>
            {restocks.map((rc) => (
              <button key={rc.beanId} onClick={() => { const b = BEANS.find((x) => x.id === rc.beanId); if (b && onOpen) onOpen(b); }}
                style={{ display: "flex", justifyContent: "space-between", width: "100%", gap: 8, background: "none", border: "none", borderTop: `1px solid ${LINE}`, padding: "10px 0", cursor: "pointer", textAlign: "left" }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: INK }}>{rc.name}</span>
                <span style={{ fontSize: 10.5, color: GRAY, flexShrink: 0 }}>{rc.roaster}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 設計メモ / 正直な注記 */}
      <div style={{ marginTop: 20, padding: "12px 14px", border: `1px dashed ${LINE}`, borderRadius: 10, fontSize: 10.5, color: GRAY, lineHeight: 1.8 }}>
        プロトタイプ：プラン・通知設定・ウォッチリストはこの端末に保存されます。実際のメール／ブラウザプッシュ配信と決済（Stripe）は、
        巡回システムが新着・在庫変化を検知して通知するバックエンド連携で有効化します。設計は docs/notifications-and-billing.md を参照。
        複数端末で同期する本ログイン（メール／パスワード等）も今後のバックエンド連携で追加予定です。
      </div>
    </div>
  );
}
