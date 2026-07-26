"use client";
import { useState, useEffect } from "react";
import { INK, PAPER, GRAY, LINE, GREEN } from "../lib/theme";
import { BEANS } from "../data/beans";
import { ROASTERS } from "../data/roasters";
import { getUser, setUser, logout, getTastings, removeTasting, upsertTasting, mergeTastings, getPlan, setPlan, getDiagHistory, removeDiagResult, getAnalysisHistory, removeAnalysis } from "../lib/store";
import { isCloud, isSignedIn, getSession, signInWithEmail, captureSessionFromUrl, signOut, cloudPullTastings, cloudPushTastings, cloudGetPlan } from "../lib/account";
import { analyzeTastings, recommendRoasters, GROUP_LABEL } from "../lib/analysis";

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
  const [anas, setAnas] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", roaster: "", origin: "", rating: 0, notes: "" });

  const saveManual = () => {
    if (!form.name.trim() || !form.rating) return;
    upsertTasting({ beanId: -Date.now(), r: null, name: form.name.trim(), roaster: form.roaster.trim(), origin: form.origin.trim(), rating: form.rating, notes: form.notes.trim() });
    setForm({ name: "", roaster: "", origin: "", rating: 0, notes: "" });
    setShowAdd(false);
    refresh();
  };

  const refresh = () => { setU(getUser()); setList(getTastings()); setSession(getSession()); setPlanState(getPlan()); setDiags(getDiagHistory()); setAnas(getAnalysisHistory()); };

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

  // 記録のライブAI分析（保存不要・記録から即時算出）＋相性の良いロースター3件
  const tan = analyzeTastings(list);
  const liveTags = [];
  if (tan.topGroup) liveTags.push(GROUP_LABEL[tan.topGroup] || tan.topGroup);
  if (tan.topProc) liveTags.push(tan.topProc);
  if (tan.topFam) liveTags.push(tan.topFam);
  const recs = recommendRoasters(tan, 3).filter((k) => ROASTERS[k]);

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

      {/* 過去に飲んだ豆を手動で記録（図鑑に無い豆もカード化） */}
      <div style={{ marginTop: 12 }}>
        {!showAdd ? (
          <button onClick={() => setShowAdd(true)}
            style={{ width: "100%", padding: "12px 0", background: INK, color: PAPER, border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            ＋ 過去に飲んだ豆を記録
          </button>
        ) : (
          <div style={{ padding: "14px 16px", border: `1px solid ${LINE}`, borderRadius: 12, background: "#F7F5EF" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div style={{ fontSize: 13, fontWeight: 800 }}>☕ 飲んだ豆を記録</div>
              <button onClick={() => setShowAdd(false)} style={{ background: "none", border: "none", fontSize: 11, color: GRAY, cursor: "pointer" }}>閉じる</button>
            </div>
            <div style={{ fontSize: 10.5, color: GRAY, marginTop: 3, lineHeight: 1.6 }}>図鑑に無い豆でもOK。銘柄名と評価だけで記録できます。</div>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="銘柄名（必須）例：Ethiopia Guji"
              style={{ width: "100%", boxSizing: "border-box", marginTop: 10, padding: "9px 11px", borderRadius: 8, border: `1px solid ${LINE}`, fontSize: 13, background: PAPER, color: INK }} />
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <input value={form.roaster} onChange={(e) => setForm({ ...form, roaster: e.target.value })} placeholder="ロースター（任意）"
                style={{ flex: 1, minWidth: 0, boxSizing: "border-box", padding: "9px 11px", borderRadius: 8, border: `1px solid ${LINE}`, fontSize: 12.5, background: PAPER, color: INK }} />
              <input value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value })} placeholder="産地（任意）"
                style={{ flex: 1, minWidth: 0, boxSizing: "border-box", padding: "9px 11px", borderRadius: 8, border: `1px solid ${LINE}`, fontSize: 12.5, background: PAPER, color: INK }} />
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 10, alignItems: "center" }}>
              <span style={{ fontSize: 11, color: GRAY, marginRight: 2 }}>評価</span>
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => setForm({ ...form, rating: n })} aria-label={`${n}点`}
                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: 24, lineHeight: 1, padding: 0, color: n <= form.rating ? "#E4A11B" : LINE }}>★</button>
              ))}
            </div>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="香り・酸味・甘み・余韻など、感じた味をメモ（任意）"
              style={{ width: "100%", boxSizing: "border-box", marginTop: 8, minHeight: 54, padding: "8px 10px", borderRadius: 8, border: `1px solid ${LINE}`, fontSize: 12.5, resize: "vertical", background: PAPER, color: INK, fontFamily: "inherit" }} />
            <button onClick={saveManual} disabled={!form.name.trim() || !form.rating}
              style={{ width: "100%", marginTop: 8, padding: "11px 0", background: (form.name.trim() && form.rating) ? INK : "#EDEAE1", color: (form.name.trim() && form.rating) ? PAPER : GRAY, border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: (form.name.trim() && form.rating) ? "pointer" : "default" }}>
              記録する
            </button>
          </div>
        )}
      </div>

      {/* 記録のライブAI分析（トップ）＋おすすめロースター3件 */}
      {tan.rated > 0 && (
        <div style={{ marginTop: 18, padding: "16px 16px 14px", background: "#141210", color: PAPER, borderRadius: 14 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
            <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, letterSpacing: "0.15em", color: "#B8AE9E" }}>🧠 記録のAI分析</div>
            <div style={{ fontSize: 10, color: "#B8AE9E" }}>{tan.rated}件を分析</div>
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, marginTop: 8, lineHeight: 1.5 }}>
            あなたの好みは{liveTags.length ? `「${liveTags[0]}」` : "分析中"}
          </div>
          {liveTags.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
              {liveTags.map((t) => (
                <span key={t} style={{ fontSize: 10.5, fontWeight: 700, color: "#141210", background: "#E4B84A", borderRadius: 999, padding: "3px 11px" }}>高評価: {t}</span>
              ))}
            </div>
          )}
          {recs.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 10.5, color: "#B8AE9E", letterSpacing: "0.06em" }}>あなたにおすすめのロースター</div>
              <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                {recs.map((k, i) => {
                  const r = ROASTERS[k];
                  return (
                    <button key={k} onClick={() => onRoaster(k)}
                      style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", textAlign: "left", background: "#211E1A", border: "1px solid #3A352E", borderRadius: 10, padding: "10px 12px", cursor: "pointer", color: PAPER }}>
                      <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, fontWeight: 800, color: "#E4B84A", width: 16, flexShrink: 0 }}>{i + 1}</span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: "block", fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</span>
                        <span style={{ display: "block", fontSize: 10.5, color: "#B8AE9E", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{[r.city, r.style].filter(Boolean).join(" ・ ")}</span>
                      </span>
                      <span style={{ color: "#B8AE9E", fontSize: 15, flexShrink: 0 }}>›</span>
                    </button>
                  );
                })}
              </div>
              <div style={{ fontSize: 9.5, color: "#7C7365", marginTop: 8, lineHeight: 1.6 }}>※ 高評価の記録の傾向から、いま買える豆のあるロースターを相性順に表示しています。</div>
            </div>
          )}
        </div>
      )}

      {/* 保存した分析 */}
      {anas.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, letterSpacing: "0.12em", color: GRAY }}>💾 保存した分析</div>
          {anas.map((a) => (
            <div key={a.at} style={{ borderBottom: `1px solid ${LINE}`, padding: "10px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: INK }}>{a.rated}件の記録を分析</span>
                <button onClick={() => { removeAnalysis(a.at); refresh(); }} style={{ background: "none", border: "none", fontSize: 10.5, color: GRAY, cursor: "pointer" }}>削除</button>
              </div>
              {a.tags && a.tags.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 5 }}>
                  {a.tags.map((t) => <span key={t} style={{ fontSize: 9.5, fontWeight: 700, color: INK, background: "#F2F0E9", borderRadius: 999, padding: "2px 9px" }}>高評価: {t}</span>)}
                </div>
              )}
              <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 9.5, color: GRAY, marginTop: 6 }}>{new Date(a.at).toLocaleDateString("ja-JP")}</div>
            </div>
          ))}
        </div>
      )}

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
