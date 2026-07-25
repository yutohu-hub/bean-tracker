"use client";
import { useState, useEffect } from "react";
import { INK, PAPER, GRAY, LINE, GREEN } from "../lib/theme";
import { BEANS } from "../data/beans";
import { getUser, setUser, logout, getTastings, removeTasting } from "../lib/store";

const stars = (n) => "★★★★★".slice(0, n) + "☆☆☆☆☆".slice(0, 5 - n);

export function MyLogView({ onOpen, onRoaster }) {
  const [user, setU] = useState(null);
  const [list, setList] = useState([]);
  const [name, setName] = useState("");
  const [ready, setReady] = useState(false);

  const refresh = () => { setU(getUser()); setList(getTastings()); };
  useEffect(() => { refresh(); setReady(true); }, []);

  if (!ready) return null;

  // 未ログイン（ローカルプロフィール未設定）
  if (!user) {
    return (
      <div className="bt-card">
        <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, letterSpacing: "0.15em", color: GRAY }}>MY ACCOUNT</div>
        <div style={{ fontSize: 18, fontWeight: 800, marginTop: 6 }}>ログインして味を記録</div>
        <div style={{ fontSize: 12, color: GRAY, marginTop: 6, lineHeight: 1.7 }}>
          飲んだコーヒーの味を、あなたのアカウントに記録できます。まずはお名前（ニックネーム）を入れてください。
        </div>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ニックネーム"
          style={{ width: "100%", boxSizing: "border-box", marginTop: 12, padding: "10px 12px", borderRadius: 8, border: `1px solid ${LINE}`, fontSize: 14, background: PAPER, color: INK }} />
        <button onClick={() => { if (name.trim()) { setUser(name); refresh(); } }}
          style={{ width: "100%", marginTop: 10, padding: "12px 0", background: INK, color: PAPER, border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          ログイン（この端末に保存）
        </button>
        <div style={{ fontSize: 10, color: GRAY, marginTop: 10, lineHeight: 1.7 }}>
          ※ 現在は端末内保存のみ。複数端末で同期する本ログイン（メール/パスワード等）は今後バックエンド連携で追加予定です。
        </div>
      </div>
    );
  }

  const rated = list.filter((t) => t.rating);
  const avg = rated.length ? (rated.reduce((s, t) => s + t.rating, 0) / rated.length).toFixed(1) : "–";
  const openBean = (id) => { const b = BEANS.find((x) => x.id === id); if (b) onOpen(b); };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, letterSpacing: "0.15em", color: GRAY }}>MY LOG</div>
          <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>{user.name} さんの記録</div>
        </div>
        <button onClick={() => { logout(); refresh(); }} style={{ background: "none", border: "none", fontSize: 11, color: GRAY, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2 }}>ログアウト</button>
      </div>

      <div style={{ display: "flex", gap: 18, marginTop: 12, borderTop: `2px solid ${INK}`, borderBottom: `1px solid ${LINE}`, padding: "12px 0" }}>
        <div><div style={{ fontFamily: "ui-monospace, monospace", fontSize: 22, fontWeight: 800 }}>{list.length}</div><div style={{ fontSize: 10, color: GRAY }}>記録した豆</div></div>
        <div><div style={{ fontFamily: "ui-monospace, monospace", fontSize: 22, fontWeight: 800 }}>{avg}</div><div style={{ fontSize: 10, color: GRAY }}>平均評価</div></div>
      </div>

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
