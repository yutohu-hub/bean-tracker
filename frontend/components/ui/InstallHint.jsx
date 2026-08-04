"use client";
// 「ホーム画面に追加」の案内。
//
// iPhone には、Androidのようなインストールの促しが無い。Safari の共有メニューを
// 自分で開いてもらうしかないので、知らない人はブラウザのまま使い続ける。
// 記録を残すアプリなので、ホーム画面に置いてもらえるかどうかは実際に効く
// （毎回ブラウザで開き直す人は、そもそも記録を続けない）。
//
// うるさくならないよう、次を守る:
//   * 出すのは1回だけ。閉じたら二度と出さない（端末に記録する）
//   * すでにホーム画面から起動している人には出さない
//   * 起動直後には出さない（まず中身を見てもらう）

import { useEffect, useState } from "react";
import { INK, PAPER, GRAY, LINE } from "../lib/theme";

const KEY = "bt_install_hint";
const DELAY = 12000;        // 12秒。ひととおり眺めたころ

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;

const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent)
  // iPadOS はデスクトップ版Safariを名乗るので、タッチの有無で見分ける
  || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

export function InstallHint() {
  const [show, setShow] = useState(false);
  const [prompt, setPrompt] = useState(null);   // Android/PC はこれで直接インストールできる

  useEffect(() => {
    if (typeof window === "undefined") return;
    try { if (localStorage.getItem(KEY)) return; } catch { return; }
    if (isStandalone()) return;

    const onPrompt = (e) => { e.preventDefault(); setPrompt(e); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    const t = setTimeout(() => setShow(true), DELAY);
    return () => { clearTimeout(t); window.removeEventListener("beforeinstallprompt", onPrompt); };
  }, []);

  if (!show) return null;
  const close = () => { try { localStorage.setItem(KEY, "1"); } catch {} setShow(false); };

  return (
    <div style={{
      position: "fixed", left: 12, right: 12, bottom: `calc(12px + env(safe-area-inset-bottom))`,
      zIndex: 60, maxWidth: 460, margin: "0 auto",
      background: PAPER, border: `1px solid ${LINE}`, borderRadius: 14,
      boxShadow: "0 6px 24px rgba(23,21,15,0.16)", padding: "13px 15px",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: INK }}>アプリとして使えます</div>
          <div style={{ fontSize: 11.5, color: GRAY, marginTop: 4, lineHeight: 1.75 }}>
            {prompt
              ? "ホーム画面に置くと、次からすぐ開けて、圏外でも図鑑を見られます。"
              : <>ホーム画面に置くと、次からすぐ開けて、圏外でも図鑑を見られます。<br />
                  {isIOS()
                    ? <>Safari下部の <strong style={{ color: INK }}>共有 <span style={{ fontFamily: "ui-monospace, monospace" }}>⬆︎</span></strong> →「<strong style={{ color: INK }}>ホーム画面に追加</strong>」</>
                    : <>ブラウザのメニューから「アプリをインストール」を選んでください。</>}
                </>}
          </div>
        </div>
        <button onClick={close} aria-label="閉じる"
          style={{ background: "none", border: "none", fontSize: 14, color: GRAY, cursor: "pointer", lineHeight: 1, padding: 2 }}>✕</button>
      </div>
      {prompt && (
        <button onClick={async () => { prompt.prompt(); await prompt.userChoice.catch(() => {}); close(); }}
          style={{ width: "100%", marginTop: 10, padding: "10px 0", background: INK, color: PAPER, border: "none", borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
          ホーム画面に追加
        </button>
      )}
    </div>
  );
}
