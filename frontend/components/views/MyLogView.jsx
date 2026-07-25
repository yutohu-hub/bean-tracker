"use client";
import { useState, useEffect } from "react";
import { INK, PAPER, GRAY, LINE, GREEN } from "../lib/theme";
import { BEANS } from "../data/beans";
import { ROASTERS } from "../data/roasters";
import { getUser, setUser, logout, getTastings, removeTasting, mergeTastings, getPlan, setPlan, getDiagHistory, removeDiagResult } from "../lib/store";
import { isCloud, isSignedIn, getSession, signInWithEmail, captureSessionFromUrl, signOut, cloudPullTastings, cloudPushTastings, cloudGetPlan } from "../lib/account";

const stars = (n) => "★★★★★".slice(0, n) + "☆☆☆☆☆".slice(0, 5 - n);
const rowToTasting = (r) => ({ beanId: r.bean_id, r: r.r, name: r.name, roaster: r.roaster, origin: r.origin, rating: r.rating, notes: r.notes, at: Number(r.at) || Date.now() });

export function MyLogView({ onOpen, onRoaster }) {
  const [user, setU] = useState(null);
  const [session, setSession] = useState(null);
  const [list, setList] = useState([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [ready, setReady] = useState(false);
  const [loginMsg, setLoginMsg] = useState("");
  const [syncMsg, setSyncMsg] = useState("");
  const [plan, setPlanState] = useState({ id: "free" });
  const [diags, setDiags] = useState([]);

  const refresh = () => { setU(getUser()); setList(getTastings()); setSession(getSession()); setPlanState(getPlan()); setDiags(getDiagHistory()); };

  const syncNow = async () => {
    if (!isCloud() || !isSignedIn()) return;
    try {
      setSyncMsg("同期中…");
      const cloud = await cloudPullTastings();
      mergeTastings(cloud.map(rowToTasting));
      await cloudPushTastings(getTastings());
      const p = await cloudGetPlan();
      if (p) setPlan(p);                   // 決済ランクをローカルプランへ反映（プレミアム連動）
      refresh();
      setSyncMsg("同期しました");
    } catch { setSyncMsg("同期に失敗しました（Supabase設定・ネットワークを確認）"); }
  };

  useEffect(() => {
    (async () => {
      await captureSessionFromUrl();       // マジックリンクで戻ってきた場合セッション確立
      refresh();
      setReady(true);
      if (isCloud() && isSignedIn()) syncNow();
    })();
  }, []);

  if (!ready) return null;

  const cloud = isCloud();
  const signed = cloud && isSignedIn();
  const authed = signed || (!cloud && !!user);

  // ---- 未ログイン ----
  if (!authed) {
    return (
      <div className="bt-card">
        <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, letterSpacing: "0.15em", color: GRAY }}>MY ACCOUNT</div>
        <div style={{ fontSize: 18, fontWeight: 800, marginTop: 6 }}>ログインして味を記録</div>

        {cloud ? (
          <>
            <div style={{ fontSize: 12, color: GRAY, marginTop: 6, lineHeight: 1.7 }}>
              メールアドレスでログインすると、味の記録が複数端末で同期され、プレミアムの状態も連動します。
            </div>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
              style={{ width: "100%", boxSizing: "border-box", marginTop: 12, padding: "10px 12px", borderRadius: 8, border: `1px solid ${LINE}`, fontSize: 14, background: PAPER, color: INK }} />
            <button onClick={async () => {
                if (!email.trim()) return;
                try { await signInWithEmail(email.trim()); setLoginMsg("メールを送信しました。届いたログインリンクを開いてください。"); }
                catch { setLoginMsg("送信に失敗しました。メールアドレスとSupabase設定を確認してください。"); }
              }}
              style={{ width: "100%", marginTop: 10, padding: "12px 0", background: INK, color: PAPER, border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              ログインリンクをメールで送る
            </button>
            {loginMsg && <div style={{ fontSize: 11, color: GREEN, marginTop: 8, lineHeight: 1.6 }}>{loginMsg}</div>}
            <div style={{ fontSize: 10, color: GRAY, marginTop: 10, lineHeight: 1.7 }}>
              メールのリンクを開くとこの画面に戻り、ログインが完了します。
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 12, color: GRAY, marginTop: 6, lineHeight: 1.7 }}>
              飲んだコーヒーの味を記録できます。まずはお名前（ニックネーム）を入れてください。
            </div>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ニックネーム"
              style={{ width: "100%", boxSizing: "border-box", marginTop: 12, padding: "10px 12px", borderRadius: 8, border: `1px solid ${LINE}`, fontSize: 14, background: PAPER, color: INK }} />
            <button onClick={() => { if (name.trim()) { setUser(name); refresh(); } }}
              style={{ width: "100%", marginTop: 10, padding: "12px 0", background: INK, color: PAPER, border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              ログイン（この端末に保存）
            </button>
            <div style={{ fontSize: 10, color: GRAY, marginTop: 10, lineHeight: 1.7 }}>
              ※ 現在この端末はクラウド未設定のため端末内保存のみ。メール同期は Supabase 設定後に有効化されます（docs/account-sync.md）。
            </div>
          </>
        )}
      </div>
    );
  }

  const rated = list.filter((t) => t.rating);
  const avg = rated.length ? (rated.reduce((s, t) => s + t.rating, 0) / rated.length).toFixed(1) : "–";
  const openBean = (id) => { const b = BEANS.find((x) => x.id === id); if (b) onOpen(b); };
  const accountName = signed ? (session && session.user ? session.user.email : "アカウント") : (user ? user.name : "");
  const doLogout = async () => { if (signed) { await signOut(); } else { logout(); } refresh(); };
  const premium = plan.id && plan.id.startsWith("premium");

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, letterSpacing: "0.15em", color: GRAY }}>MY LOG</div>
          <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4, wordBreak: "break-all" }}>{accountName}</div>
          <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
            <span style={{ fontSize: 10, color: signed ? GREEN : GRAY }}>{signed ? "☁ クラウド同期中" : "端末内保存"}</span>
            {premium && <span style={{ fontSize: 10, color: "#A87B2E", fontWeight: 700 }}>PREMIUM</span>}
          </div>
        </div>
        <button onClick={doLogout} style={{ background: "none", border: "none", fontSize: 11, color: GRAY, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2 }}>ログアウト</button>
      </div>

      {signed && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
          <button onClick={syncNow} style={{ padding: "8px 14px", background: PAPER, color: INK, border: `1.5px solid ${INK}`, borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>☁ 今すぐ同期</button>
          {syncMsg && <span style={{ fontSize: 11, color: GRAY }}>{syncMsg}</span>}
        </div>
      )}

      <div style={{ display: "flex", gap: 18, marginTop: 12, borderTop: `2px solid ${INK}`, borderBottom: `1px solid ${LINE}`, padding: "12px 0" }}>
        <div><div style={{ fontFamily: "ui-monospace, monospace", fontSize: 22, fontWeight: 800 }}>{list.length}</div><div style={{ fontSize: 10, color: GRAY }}>記録した豆</div></div>
        <div><div style={{ fontFamily: "ui-monospace, monospace", fontSize: 22, fontWeight: 800 }}>{avg}</div><div style={{ fontSize: 10, color: GRAY }}>平均評価</div></div>
      </div>

      {/* 診断の記録 */}
      {diags.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, letterSpacing: "0.12em", color: GRAY }}>🧭 診断の記録</div>
          {diags.map((d) => (
            <div key={d.at} style={{ borderBottom: `1px solid ${LINE}`, padding: "10px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: INK }}>{d.type}</span>
                <button onClick={() => { removeDiagResult(d.at); refresh(); }} style={{ background: "none", border: "none", fontSize: 10.5, color: GRAY, cursor: "pointer" }}>削除</button>
              </div>
              {d.tags && d.tags.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 5 }}>
                  {d.tags.map((t) => <span key={t} style={{ fontSize: 9.5, color: GRAY, border: `1px solid ${LINE}`, borderRadius: 999, padding: "2px 8px" }}>{t}</span>)}
                </div>
              )}
              {d.top && d.top.filter((k) => ROASTERS[k]).length > 0 && (
                <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 10 }}>
                  {d.top.filter((k) => ROASTERS[k]).map((k) => (
                    <button key={k} onClick={() => onRoaster(k)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 11, color: INK, textDecoration: "underline", textUnderlineOffset: 2 }}>{ROASTERS[k].name}</button>
                  ))}
                </div>
              )}
              <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 9.5, color: GRAY, marginTop: 6 }}>{new Date(d.at).toLocaleDateString("ja-JP")}</div>
            </div>
          ))}
        </div>
      )}

      {list.length === 0 ? (
        <div style={{ textAlign: "center", color: GRAY, fontSize: 12, padding: "40px 0", lineHeight: 1.8 }}>
          まだ記録がありません。<br />図鑑で豆を開いて「☕ 飲んだ味を記録」から追加できます。
        </div>
      ) : (
        <div style={{ marginTop: 6 }}>
          {list.map((t) => (
            <div key={t.beanId} style={{ borderBottom: `1px solid ${LINE}`, padding: "12px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                <button onClick={() => openBean(t.beanId)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: INK }}>{t.name}</span>
                </button>
                <span style={{ color: "#E4A11B", fontSize: 12, letterSpacing: 1, flexShrink: 0 }}>{stars(t.rating)}</span>
              </div>
              <button onClick={() => t.r && onRoaster(t.r)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 10.5, color: GRAY, marginTop: 2, textDecoration: "underline", textUnderlineOffset: 2 }}>
                {t.roaster}{t.origin ? ` ・ ${t.origin}` : ""}
              </button>
              {t.notes && <div style={{ fontSize: 12, color: INK, marginTop: 5, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{t.notes}</div>}
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 9.5, color: GRAY }}>{new Date(t.at).toLocaleDateString("ja-JP")}</span>
                <button onClick={() => { removeTasting(t.beanId); refresh(); }} style={{ background: "none", border: "none", fontSize: 10.5, color: GRAY, cursor: "pointer" }}>削除</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
