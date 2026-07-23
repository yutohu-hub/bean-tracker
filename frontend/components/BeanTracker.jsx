"use client";

import { useState, useMemo, useEffect } from "react";

// ---- データ / ロジック（分離済みモジュール） ----
import { ROASTERS } from "./data/roasters";
import { BEANS } from "./data/beans";
import { RATES_TO_JPY, toJPY, fetchLiveRates } from "./lib/currency";
import { INK, PAPER, GRAY, LINE, GREEN } from "./lib/theme";
import { ORIGINS } from "./lib/constants";

/* ============================================================
   BEAN TRACKER — プロトタイプ v0.1
   グリッド図鑑 / ロースターページ(NOW・SOLD OUT・ARCHIVE)
   実データの代わりにサンプルデータで手触りを確認するための試作
   ============================================================ */

// ---- 画面コンポーネント（分離済み） ----
import { BeanCard } from "./ui/BeanCard";
import { DetailSheet } from "./ui/DetailSheet";
import { Splash } from "./ui/Splash";
import { RoasterPage } from "./views/RoasterPage";
import { GlobeView } from "./views/GlobeView";
import { DiagnosisView } from "./views/DiagnosisView";
import { FlavorMapView } from "./views/FlavorMapView";
import { GeishaView } from "./views/GeishaView";

/* ---------- メイン ---------- */
export default function BeanTracker() {
  const [view, setView] = useState("zukan"); // zukan | roaster
  const [roasterId, setRoasterId] = useState(null);
  const [roasterTab, setRoasterTab] = useState("now");
  const [origin, setOrigin] = useState("すべて");
  const [statusF, setStatusF] = useState("all");
  const [open, setOpen] = useState(null);
  const [displayCur, setDisplayCur] = useState("JPY");
  const [priceF, setPriceF] = useState("all");
  const [processF, setProcessF] = useState("すべて");
  const [splashDone, setSplashDone] = useState(false);
  const [splashGone, setSplashGone] = useState(false);
  const [fx, setFx] = useState({ live: false, loading: true, error: false, at: null, date: null, source: null });
  const [fxVersion, setFxVersion] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setSplashDone(true), 1700);   // 表示を終えてフェード開始
    const t2 = setTimeout(() => setSplashGone(true), 2400);   // 完全に取り除く
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  // ライブ為替: 起動時に取得 → 10分ごと＋タブ復帰/フォーカス時に再取得して変動を自動反映
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const { rates, date, source } = await fetchLiveRates();
        if (!alive) return;
        Object.assign(RATES_TO_JPY, rates);           // その場で上書き → 全表示が新レートで再計算
        setFx({ live: true, loading: false, error: false, at: new Date(), date, source });
        setFxVersion((v) => v + 1);                   // 価格表示・帯フィルタを再描画
      } catch {
        if (!alive) return;
        setFx((p) => (p.live ? { ...p } : { ...p, loading: false, error: true }));
      }
    };
    load();
    const id = setInterval(load, 10 * 60 * 1000);
    const onVis = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", load);
    return () => {
      alive = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", load);
    };
  }, []);

  const fxTime = fx.at
    ? `${String(fx.at.getHours()).padStart(2, "0")}:${String(fx.at.getMinutes()).padStart(2, "0")}`
    : "";
  const fxTitle = fx.live
    ? `1 USD = ¥${RATES_TO_JPY.USD.toFixed(1)} / 1 EUR = ¥${RATES_TO_JPY.EUR.toFixed(1)} / 1 AUD = ¥${RATES_TO_JPY.AUD.toFixed(1)}（出典: ${fx.source}${fx.date ? " · " + fx.date : ""}）`
    : "為替APIに接続できないため固定値で表示中";

  const goRoaster = (rid, tab) => { setRoasterId(rid); setRoasterTab(tab || "now"); setView("roaster"); window.scrollTo(0, 0); };

  const PRICE_BANDS = {
    all: { label: displayCur === "JPY" ? "すべての価格" : "All prices", test: () => true },
    low: { label: displayCur === "JPY" ? "〜¥2,000" : "〜$13", test: (jpy) => jpy < 2000 },
    mid: { label: displayCur === "JPY" ? "¥2,000〜3,000" : "$13〜20", test: (jpy) => jpy >= 2000 && jpy < 3000 },
    high: { label: displayCur === "JPY" ? "¥3,000〜" : "$20〜", test: (jpy) => jpy >= 3000 },
  };

  const PROCESSES = ["すべて", "Washed", "Natural", "Honey", "Anaerobic"];

  const filtered = useMemo(() => BEANS.filter((b) =>
    (origin === "すべて" || b.origin === origin) &&
    (statusF === "all" || b.status === statusF) &&
    (processF === "すべて" || b.process.includes(processF)) &&
    PRICE_BANDS[priceF].test(toJPY(b))
  ), [origin, statusF, priceF, processF, displayCur, fxVersion]);

  return (
    <div style={{ minHeight: "100vh", background: PAPER, fontFamily: `"Hiragino Kaku Gothic ProN", "Hiragino Sans", "Noto Sans JP", sans-serif`, color: INK }}>
      <style>{`
        @keyframes btTrackIn { from { letter-spacing: 0.8em; opacity: 0; } to { letter-spacing: 0.35em; opacity: 1; } }
        @keyframes btLineGrow { from { width: 0; } to { width: 180px; } }
        @keyframes btFadeUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        @keyframes btFadeOut { from { opacity: 1; } to { opacity: 0; } }
        @keyframes btSheetUp { from { transform: translateY(100%); } to { transform: none; } }
        @keyframes btGridIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        .bt-mark { animation: btTrackIn 0.9s cubic-bezier(0.2, 0.7, 0.3, 1) both; }
        .bt-line { animation: btLineGrow 0.7s 0.5s cubic-bezier(0.2, 0.7, 0.3, 1) both; }
        .bt-tag { animation: btFadeUp 0.6s 0.9s ease both; }
        .bt-splash-out { animation: btFadeOut 0.6s ease both; }
        .bt-sheet { animation: btSheetUp 0.32s cubic-bezier(0.2, 0.7, 0.3, 1) both; }
        .bt-card { animation: btGridIn 0.45s ease backwards; transition: transform 0.15s cubic-bezier(0.2, 0.7, 0.3, 1); }
        .bt-card:active { transform: scale(0.955); }
        @keyframes btPkgIn { from { opacity: 0; transform: scale(0.9) translateY(4px); } to { opacity: 1; transform: none; } }
        .bt-detail-pkg { animation: btPkgIn 0.4s 0.08s cubic-bezier(0.2, 0.7, 0.3, 1) backwards; }
        .bt-detail-info { animation: btFadeUp 0.4s 0.16s ease backwards; }
        @keyframes btDotIn { 0% { opacity: 0; transform: scale(0); } 70% { transform: scale(1.25); } 100% { opacity: 1; transform: scale(1); } }
        @keyframes btFloat { from { transform: translateY(-1.5px); } to { transform: translateY(1.5px); } }
        .bt-dot { animation: btDotIn 0.5s cubic-bezier(0.2, 0.7, 0.3, 1) backwards; }
        .bt-dot-core { animation: btFloat 2.4s ease-in-out infinite alternate; }
        .bt-dot-sel { animation: none; }
        @keyframes btBarGrow { from { width: 0; } }
        .bt-bar { animation: btBarGrow 0.8s cubic-bezier(0.2, 0.7, 0.3, 1) backwards; }
        @keyframes btLivePulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.25; } }
        .bt-live { animation: btLivePulse 1.6s ease-in-out infinite; }
      `}</style>
      {!splashGone && <Splash done={splashDone} />}
      {/* ヘッダー */}
      <header style={{ position: "sticky", top: 0, zIndex: 40, background: PAPER, borderBottom: `2px solid ${INK}` }}>
        <div style={{ maxWidth: 640, margin: "0 auto", padding: "14px 16px 10px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div style={{ fontWeight: 800, fontSize: 17, letterSpacing: "0.12em" }}>BEAN&nbsp;TRACKER</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ display: "flex", border: `1px solid ${INK}`, borderRadius: 6, overflow: "hidden" }}>
                {[["JPY", "¥"], ["USD", "$"]].map(([k, sym]) => (
                  <button key={k} onClick={() => setDisplayCur(k)}
                    style={{
                      padding: "3px 10px", border: "none", cursor: "pointer",
                      fontFamily: "ui-monospace, monospace", fontSize: 11, fontWeight: 700,
                      background: displayCur === k ? INK : "transparent",
                      color: displayCur === k ? PAPER : INK,
                    }}>{sym}</button>
                ))}
              </div>
              <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 9, color: GRAY }}>v0.1</div>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 2 }}>
            <div style={{ fontSize: 10, color: GRAY }}>世界中のコーヒー豆に辿り着くためのインフラ</div>
            <div title={fxTitle} style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0, fontFamily: "ui-monospace, monospace", fontSize: 9, color: GRAY, whiteSpace: "nowrap" }}>
              <span className={fx.live ? "bt-live" : ""} style={{ width: 6, height: 6, borderRadius: 999, background: fx.live ? GREEN : (fx.error ? "#B8433A" : "#C8B36A") }} />
              {fx.live ? `為替LIVE · ${fxTime}更新` : fx.loading ? "為替 取得中…" : "為替 固定値"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 10, overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
            {[["zukan", "図鑑"], ["map", "地球"], ["shindan", "診断"], ["flavor", "味わい"], ["geisha", "レアロット"]].map(([k, l]) => (
              <button key={k} onClick={() => setView(k)}
                style={{
                  background: "none", border: "none", padding: "0 0 6px", cursor: "pointer",
                  fontSize: 12.5, letterSpacing: "0.12em", whiteSpace: "nowrap", flexShrink: 0,
                  color: view === k || (k === "zukan" && view === "roaster") ? INK : GRAY,
                  fontWeight: view === k || (k === "zukan" && view === "roaster") ? 700 : 400,
                  borderBottom: view === k || (k === "zukan" && view === "roaster") ? `2px solid ${INK}` : "2px solid transparent",
                }}>{l}</button>
            ))}
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 640, margin: "0 auto", padding: "16px 16px 60px" }}>
        {view === "roaster" && roasterId ? (
          <RoasterPage key={roasterId + roasterTab} rid={roasterId} initialTab={roasterTab} onOpen={setOpen} onBack={() => setView("zukan")} onRoaster={goRoaster} cur={displayCur} />
        ) : view === "map" ? (
          <GlobeView onRoaster={goRoaster} />
        ) : view === "shindan" ? (
          <DiagnosisView onRoaster={goRoaster} />
        ) : view === "flavor" ? (
          <FlavorMapView onOpen={setOpen} cur={displayCur} />
        ) : view === "geisha" ? (
          <GeishaView onOpen={setOpen} onRoaster={goRoaster} cur={displayCur} />
        ) : (
          <>
            {/* フィルタ */}
            <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, WebkitOverflowScrolling: "touch" }}>
              {ORIGINS.map((o) => (
                <button key={o} onClick={() => setOrigin(o)}
                  style={{
                    flexShrink: 0, padding: "6px 12px", borderRadius: 999, fontSize: 11.5, cursor: "pointer",
                    border: `1px solid ${origin === o ? INK : LINE}`,
                    background: origin === o ? INK : "transparent",
                    color: origin === o ? PAPER : INK,
                  }}>{o}</button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingTop: 8, paddingBottom: 4, WebkitOverflowScrolling: "touch" }}>
              {Object.entries(PRICE_BANDS).map(([k, band]) => (
                <button key={k} onClick={() => setPriceF(k)}
                  style={{
                    flexShrink: 0, padding: "5px 11px", borderRadius: 999, fontSize: 11, cursor: "pointer",
                    fontFamily: "ui-monospace, monospace",
                    border: `1px solid ${priceF === k ? INK : LINE}`,
                    background: priceF === k ? INK : "transparent",
                    color: priceF === k ? PAPER : GRAY,
                  }}>{band.label}</button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingTop: 6, paddingBottom: 4, WebkitOverflowScrolling: "touch" }}>
              {PROCESSES.map((p) => (
                <button key={p} onClick={() => setProcessF(p)}
                  style={{
                    flexShrink: 0, padding: "5px 11px", borderRadius: 999, fontSize: 11, cursor: "pointer",
                    fontFamily: p === "すべて" ? "inherit" : "ui-monospace, monospace",
                    letterSpacing: p === "すべて" ? 0 : "0.04em",
                    border: `1px solid ${processF === p ? GREEN : LINE}`,
                    background: processF === p ? GREEN : "transparent",
                    color: processF === p ? PAPER : GRAY,
                  }}>{p === "すべて" ? "全精製" : p}</button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 14, marginTop: 12, borderBottom: `1px solid ${LINE}`, paddingBottom: 8 }}>
              {[["all", "すべて"], ["now", "NOW"], ["sold", "SOLD OUT"], ["archive", "ARCHIVE"]].map(([k, l]) => (
                <button key={k} onClick={() => setStatusF(k)}
                  style={{
                    background: "none", border: "none", padding: 0, cursor: "pointer",
                    fontFamily: "ui-monospace, monospace", fontSize: 10.5, letterSpacing: "0.05em",
                    color: statusF === k ? INK : GRAY, fontWeight: statusF === k ? 700 : 400,
                    borderBottom: statusF === k ? `2px solid ${INK}` : "2px solid transparent", paddingBottom: 6,
                  }}>{l}</button>
              ))}
              <div style={{ marginLeft: "auto", fontFamily: "ui-monospace, monospace", fontSize: 10, color: GRAY, alignSelf: "center" }}>{filtered.length} 銘柄</div>
            </div>
            {statusF === "archive" ? (
              /* ARCHIVE: ロースターを選んで歴代ポートフォリオへ */
              <div style={{ marginTop: 18 }}>
                <div style={{ fontSize: 11, color: GRAY, marginBottom: 12 }}>
                  ロースターを選ぶと、その店の歴代ポートフォリオが開きます。
                </div>
                {Object.entries(ROASTERS).map(([rid, r]) => {
                  const arc = BEANS.filter((b) => b.r === rid && b.status === "archive");
                  if (arc.length === 0) return null;
                  const years = arc.map((b) => Number(b.year));
                  return (
                    <button key={rid} onClick={() => goRoaster(rid, "archive")}
                      style={{
                        display: "flex", alignItems: "center", width: "100%", gap: 12,
                        background: "none", border: "none", borderTop: `1px solid ${LINE}`,
                        padding: "14px 2px", cursor: "pointer", textAlign: "left",
                      }}>
                      {/* ミニ標本プレビュー */}
                      <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
                        {arc.slice(0, 3).map((b) => (
                          <div key={b.id} style={{ width: 20, height: 27, borderRadius: 2, background: b.color, filter: "grayscale(0.55)", opacity: 0.85 }} />
                        ))}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: INK }}>{r.name}</div>
                        <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, color: GRAY, marginTop: 2 }}>
                          {Math.min(...years)}–{Math.max(...years)} / {arc.length} 銘柄
                        </div>
                      </div>
                      <span style={{ color: GRAY, fontSize: 14 }}>→</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <>
                {/* グリッド図鑑 */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 16, marginTop: 18 }}>
                  {filtered.map((b) => <BeanCard key={b.id} bean={b} onOpen={setOpen} onRoaster={goRoaster} cur={displayCur} />)}
                </div>
                {filtered.length === 0 && (
                  <div style={{ textAlign: "center", color: GRAY, fontSize: 12, padding: "50px 0" }}>該当する豆がありません。フィルタを変えてみてください。</div>
                )}
              </>
            )}
            {/* フッター注記 */}
            <div style={{ marginTop: 36, borderTop: `1px solid ${LINE}`, paddingTop: 14, fontSize: 10.5, color: GRAY, lineHeight: 1.7 }}>
              パッケージは実画像の代わりの試作表示です。実装では巡回システムが取得した実際のパッケージ画像が入ります。
              評価機能はありません — この図鑑は探して辿り着くためのインフラです。 円⇄ドル換算はライブ為替（対応時）を用い、変動を自動反映します。取得できない環境では固定値にフォールバックします。
            </div>
          </>
        )}
      </main>

      <DetailSheet bean={open} onClose={() => setOpen(null)} onRoaster={goRoaster} cur={displayCur} />
    </div>
  );
}
