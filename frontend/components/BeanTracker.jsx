"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";

// ---- データ / ロジック（分離済みモジュール） ----
import { ROASTERS } from "./data/roasters";
import { BEANS } from "./data/beans";
import { RATES_TO_JPY, fetchLiveRates } from "./lib/currency";
import { FS, INK, PAPER, GRAY, LINE, GREEN } from "./lib/theme";
import { ORIGIN_GROUPS } from "./lib/constants";
import { syncArchive } from "./lib/store";
import { captureSessionFromUrl, ensureFreshSession } from "./lib/account";
import { purgeLegacyPlan, keepForever, getTastings, applyRelink } from "./lib/store";
import { planRelink, isLegacyId } from "./lib/relink";
import { movePhotos } from "./lib/photos";
import { refreshPlan } from "./lib/usePlan";
import { isReturningFromCheckout } from "./lib/billing";
import { readUrlState, writeUrlState, onUrlChange } from "./lib/urlState";
import { LEGEND, beanStyle } from "./lib/palette";
import { PRICE_BANDS, PROCESSES, priceBandLabel, filterBeans, filterRoasters,
         countNowByRoaster, pageWindow } from "./lib/catalog";

/* ============================================================
   BEAN TRACKER — プロトタイプ v0.1
   グリッド図鑑 / ロースターページ(NOW・SOLD OUT・ARCHIVE)
   実データの代わりにサンプルデータで手触りを確認するための試作
   ============================================================ */

// ---- 画面コンポーネント（分離済み） ----
import { BeanCard } from "./ui/BeanCard";
import { DetailSheet } from "./ui/DetailSheet";
import { Splash } from "./ui/Splash";
import { InstallHint } from "./ui/InstallHint";
import { RoasterPage } from "./views/RoasterPage";
// 地球儀は three.js を使うので、地球タブを開いたときだけ読み込む（初回表示を軽く保つ）
const GlobeView = dynamic(() => import("./views/GlobeView").then((m) => m.GlobeView), {
  ssr: false,
  loading: () => <div style={{ textAlign: "center", color: GRAY, fontSize: FS.body, padding: "60px 0" }}>地球を読み込み中…</div>,
});
import { DiagnosisView } from "./views/DiagnosisView";
import { FlavorMapView } from "./views/FlavorMapView";
import { FlavorByProcess } from "./views/FlavorByProcess";
import { ProcessChart } from "./views/ProcessChart";
import { ProcessPage } from "./views/ProcessPage";
import { flavorOf } from "./data/flavors";
import { RecipeView } from "./views/RecipeView";
import { GeishaView } from "./views/GeishaView";
import { MyLogView } from "./views/MyLogView";
import { PremiumView } from "./views/PremiumView";
import { AboutView } from "./views/AboutView";

const ROWS_PER_PAGE = 10; // 1ページの行数（列数は可変）

/* ---------- メイン ---------- */
export default function BeanTracker() {
  const [view, setView] = useState("zukan"); // zukan | roaster
  const [roasterId, setRoasterId] = useState(null);
  const [roasterTab, setRoasterTab] = useState("now");
  const [procKey, setProcKey] = useState("washed");
  // URLから戻したときに、その反映で履歴をもう1つ積まないための目印
  const restoringRef = useRef(false);
  const goProcess = (k) => { setProcKey(k); setView("process"); window.scrollTo(0, 0); };
  const [flavorFocus, setFlavorFocus] = useState({ fam: null, id: null });
  const goFlavor = (bean) => {
    const m = flavorOf(bean);
    setFlavorFocus({ fam: m.fam, id: bean.id });
    setView("flavor"); window.scrollTo(0, 0);
  };
  const [origin, setOrigin] = useState("すべて");
  const [statusF, setStatusF] = useState("all");
  const [open, setOpen] = useState(null);
  const [displayCur, setDisplayCur] = useState("JPY");
  const [priceF, setPriceF] = useState("all");
  const [processF, setProcessF] = useState("すべて");
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState("default"); // default | p100asc | p100desc | new | old
  const [splashDone, setSplashDone] = useState(false);
  const [splashGone, setSplashGone] = useState(false);
  const [fx, setFx] = useState({ live: false, loading: true, error: false, at: null, date: null, source: null });
  const [fxVersion, setFxVersion] = useState(0);
  const [archiveBeans, setArchiveBeans] = useState([]);
  const [page, setPage] = useState(0);
  const [autoCols, setAutoCols] = useState(4); // 画面幅から決まる列数
  const [zukanMode, setZukanMode] = useState("beans"); // beans | roasters
  const [meTab, setMeTab] = useState("log"); // マイページ内: log | premium
  const [legendOpen, setLegendOpen] = useState(false); // 色の凡例を開いているか
  const [filtersOpen, setFiltersOpen] = useState(false); // 絞り込みを開いているか
  const [tabsOverflow, setTabsOverflow] = useState(false); // タブが画面に収まらないか
  const tabsRef = useRef(null);
  const [flavorMode, setFlavorMode] = useState("one"); // 味わいマップ: one | proc
  const [authNotice, setAuthNotice] = useState(null); // メールリンクからのログイン結果
  /* 昔の豆番号で残っている記録を、いまの番号に付け替える。
     豆の番号は前まで巡回のたびにずれていたので、記録が別の豆に付いて見えていた。
     番号の作り方は直したが、手元に残っている記録は昔のままなので、ここで直す。
     付け替えるものが無ければ何もしない（毎回走っても実害が出ない作り）。 */
  useEffect(() => {
    try {
      const list = getTastings();
      if (!list.some((t) => isLegacyId(t.beanId))) return;
      const plan = planRelink(list, BEANS.map((b) => ({
        id: b.id, name: b.name, roasterName: (ROASTERS[b.r] || {}).name || b.r,
      })));
      if (!plan.length) return;
      // 写真を先に動かす。記録を先に書き替えると、途中で失敗したときに
      // 写真だけが昔の番号に取り残されて、二度と結び付かなくなる
      movePhotos(plan).finally(() => { try { applyRelink(plan); } catch {} });
    } catch {}
  }, []);

  // 色の凡例を開いているか。既定は畳んだ状態（豆を早く見せる）
  useEffect(() => { if (localStorage.getItem("bt_legend") === "1") setLegendOpen(true); }, []);
  useEffect(() => { try { localStorage.setItem("bt_legend", legendOpen ? "1" : "0"); } catch {} }, [legendOpen]);
  /* タブが画面に収まっているか。収まらないときだけ右端に影を出す。
     いつも出していると、送れるものが無いのに「まだ続く」と言うことになる。
     幅の狭い端末（320〜390px）では「マイページ」が外に出る。 */
  useEffect(() => {
    const el = tabsRef.current;
    if (!el) return;
    const check = () => setTabsOverflow(el.scrollWidth > el.clientWidth + 1);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    window.addEventListener("resize", check);
    return () => { ro.disconnect(); window.removeEventListener("resize", check); };
  }, []);

  // 自動列数：画面幅（最大640・左右16pxパディング）から最小カード幅で割って算出
  useEffect(() => {
    const calc = () => {
      const w = Math.min(window.innerWidth, 1120) - 32; // カタログの実効幅
      setAutoCols(Math.max(2, Math.min(8, Math.floor((w + 10) / (132 + 10)))));
    };
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, []);
  // フィルタ・モード変更時は1ページ目に戻す
  useEffect(() => { setPage(0); }, [origin, statusF, priceF, processF, query, sortBy, zukanMode]);

  // アーカイブを端末に永続化（更新してもカタログから消えず残る）
  useEffect(() => {
    setArchiveBeans(syncArchive(BEANS.filter((b) => b.status === "archive")));
  }, []);
  const archiveByRoaster = useMemo(() => {
    const m = {};
    for (const b of archiveBeans) { if (!ROASTERS[b.r]) continue; (m[b.r] = m[b.r] || []).push(b); }
    return m;
  }, [archiveBeans]);

  /* URL → 画面。起動時と、戻る/進むのたびに実行する。
     静的書き出しなのでサーバ側は常に既定の画面を返す。ここで組み立て直す。 */
  const applyUrl = (u) => {
    restoringRef.current = true;
    setView(u.view);
    if (u.roaster) { setRoasterId(u.roaster); setRoasterTab(u.roasterTab); }
    if (u.process) setProcKey(u.process);
    if (u.query) setQuery(u.query);
    if (u.origin) setOrigin(u.origin);
    if (u.status) setStatusF(u.status);
    if (u.sortBy) setSortBy(u.sortBy);
    if (u.meTab) setMeTab(u.meTab);
    // 豆は id から実体を引く。消えた豆のリンクを踏んでも落ちないよう存在確認する
    setOpen(u.bean ? BEANS.find((b) => b.id === u.bean) || null : null);
  };

  useEffect(() => {
    applyUrl(readUrlState());
    return onUrlChange(applyUrl);
  }, []);

  /* 画面 → URL。戻るで辿れると嬉しいもの（タブ・豆・ロースター）は履歴に積み、
     検索語や絞り込みは1文字ごとに履歴が増えないよう置き換えにする。

     起動直後の1回は書かない。上のURL適用は state を更新するだけなので、
     同じコミットで走るここはまだ既定値を見ている。そのまま書くと
     直リンク（?b=... など）を既定値で消してしまう。 */
  const urlState = () => ({
    view, bean: open ? open.id : null, roaster: roasterId,
    roasterTab, process: view === "process" ? procKey : null,
    query, origin, status: statusF, sortBy, meTab,
  });
  const navWroteRef = useRef(false);
  const filterWroteRef = useRef(false);

  useEffect(() => {
    if (!navWroteRef.current) {
      // 起動直後。URLの内容はまだ state に届いていないので書かない。
      // 復元の目印もここで下ろす（下ろさないと絞り込みの書き戻しが止まったままになる）
      navWroteRef.current = true;
      restoringRef.current = false;
      return;
    }
    // 戻る/進むで戻した直後は、その反映で履歴をもう1つ積まない
    if (restoringRef.current) { restoringRef.current = false; writeUrlState(urlState()); return; }
    writeUrlState(urlState(), { push: true });
    // urlState は毎回作り直される関数。依存に入れると毎描画で走り、履歴が溢れる
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, open, roasterId, roasterTab, procKey, meTab]);

  useEffect(() => {
    if (!filterWroteRef.current) { filterWroteRef.current = true; return; }
    if (restoringRef.current) return;
    writeUrlState(urlState());
    // 同上
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, origin, statusF, sortBy]);

  useEffect(() => {
    const t1 = setTimeout(() => setSplashDone(true), 1700);   // 表示を終えてフェード開始
    const t2 = setTimeout(() => setSplashGone(true), 2400);   // 完全に取り除く
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  /* メールのログインリンクから戻ってきた場合の受け取り。
     リンクの着地点は図鑑タブなので、マイページの中で処理していると
     トークンが使われないまま次の操作で消えてしまう（＝押しても反映されない）。
     アプリ起動時にここで拾い、結果をマイページに引き渡して表示する。 */
  useEffect(() => {
    (async () => {
      /* 以前は画面のボタンが localStorage に premium を書けたため、決済せずに
         プレミアムになった端末が残っている。起動時にその値を捨てる。
         正しい権限は、このあと refreshPlan() が支払いの記録から取り直す。 */
      purgeLegacyPlan();

      // 記録は消えては困るものなので、ブラウザに保持を申告しておく
      keepForever();

      const r = await captureSessionFromUrl();
      if (r) {
        setAuthNotice(r.ok
          ? { ok: true, text: "ログインしました。この端末の記録を同期します。" }
          : { ok: false, text: `ログインできませんでした：${r.error}` });
        setView("me"); setMeTab("log"); window.scrollTo(0, 0);
      } else {
        /* リンク経由でないふつうの起動。前回のログインを続かせる。
           トークンは1時間で切れるので、開いた時点で先に更新しておく
           （使おうとした時に更新する作りだと、久しぶりに開いた最初の操作だけ失敗する）。 */
        const s = await ensureFreshSession();
        if (s && !s.ok) setAuthNotice({ ok: false, text: s.error });
      }
      // 決済から戻ってきたときは、反映待ちを見せるためプレミアム画面へ送る
      if (isReturningFromCheckout()) { setView("me"); setMeTab("premium"); window.scrollTo(0, 0); }
      refreshPlan();
    })();
  }, []);

  /* ログイン状態を保ち続ける。
     アクセストークンは1時間で切れる。起動時に1度だけ更新していたので、開いたまま
     1時間を越えたり、ホーム画面のアプリを読み込み直さずに再開したりすると、
     画面はログイン済みなのに操作だけ失敗する状態になっていた。
     為替と同じ手当てをする（5分ごと＋タブ復帰＋フォーカス）。
     ensureFreshSession は期限が近くないときは何もしないので、何度呼んでも軽い。 */
  useEffect(() => {
    let alive = true;
    const keep = async () => {
      const r = await ensureFreshSession();
      if (alive && r && !r.ok) setAuthNotice({ ok: false, text: r.error });
    };
    const id = setInterval(keep, 5 * 60 * 1000);
    const onVis = () => { if (document.visibilityState === "visible") keep(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", keep);
    return () => {
      alive = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", keep);
    };
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

  const fxTitle = fx.live
    ? `1 USD = ¥${RATES_TO_JPY.USD.toFixed(1)} / 1 EUR = ¥${RATES_TO_JPY.EUR.toFixed(1)} / 1 AUD = ¥${RATES_TO_JPY.AUD.toFixed(1)}（出典: ${fx.source}${fx.date ? " · " + fx.date : ""}）`
    : "為替APIに接続できないため固定値で表示中";

  const goRoaster = (rid, tab) => { setRoasterId(rid); setRoasterTab(tab || "now"); setView("roaster"); window.scrollTo(0, 0); };

  const minSel = { width: "100%", boxSizing: "border-box", padding: "8px 9px", borderRadius: 8, border: `1px solid ${LINE}`, fontSize: FS.body, background: PAPER, color: INK };

  /* いま効いている絞り込み。既定値のものは入らない。
     在庫（NOW / SOLD OUT）は下のタブで常に見えているので、ここには出さない。 */
  const activeFilters = [
    query && { key: "q", label: `「${query}」`, clear: () => setQuery("") },
    origin !== "すべて" && { key: "o", label: `産地：${origin}`, clear: () => setOrigin("すべて") },
    processF !== "すべて" && { key: "p", label: `精製：${processF}`, clear: () => setProcessF("すべて") },
    priceF !== "all" && { key: "pr", label: priceBandLabel(priceF, displayCur), clear: () => setPriceF("all") },
  ].filter(Boolean);
  const clearFilters = () => { setQuery(""); setOrigin("すべて"); setProcessF("すべて"); setPriceF("all"); };

  // 為替が更新されると価格帯の判定も変わるので fxVersion を依存に入れている
  const filtered = useMemo(
    () => filterBeans(BEANS, ROASTERS, { query, origin, status: statusF, process: processF, price: priceF, sortBy }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [origin, statusF, priceF, processF, query, sortBy, fxVersion]);

  const nowCountByRoaster = useMemo(() => countNowByRoaster(BEANS), []);
  const filteredRoasters = useMemo(
    () => filterRoasters(ROASTERS, nowCountByRoaster, { query }),
    [query, nowCountByRoaster]);

  /* ページング（列数 × 10行 = 1ページの件数）— モードで対象リストを切替。
     列数は画面幅から決める。以前は「自動/2/3/4/5/6」の7ボタンを豆より上に
     置いていたが、携帯で列数を選ぶ人はいない。豆が出てくるまでの高さを
     そのぶん占めていた。 */
  const effCols = autoCols;
  const perPage = effCols * ROWS_PER_PAGE;
  const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(132px, 1fr))", gap: effCols >= 5 ? 8 : 10, marginTop: 12 };
  const activeList = zukanMode === "roasters" ? filteredRoasters : filtered;
  const pageCount = Math.max(1, Math.ceil(activeList.length / perPage));
  const curPage = Math.min(page, pageCount - 1);
  const pageItems = activeList.slice(curPage * perPage, curPage * perPage + perPage);
  const goPage = (p) => { setPage(p); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const pgStyle = (active, disabled) => ({ minWidth: 30, height: 30, padding: "0 8px", borderRadius: 8, border: `1px solid ${active ? INK : LINE}`, background: active ? INK : PAPER, color: active ? PAPER : INK, fontSize: FS.body, fontWeight: 700, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.4 : 1, display: "inline-flex", alignItems: "center", justifyContent: "center" });
  const unit = zukanMode === "roasters" ? "店" : "銘柄";
  const pagerEl = (
    <>
      {pageCount > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 22, flexWrap: "wrap" }}>
          <button disabled={curPage === 0} onClick={() => goPage(curPage - 1)} style={pgStyle(false, curPage === 0)}>‹</button>
          {pageWindow(curPage, pageCount).map((p, i) => p === "…"
            ? <span key={"e" + i} style={{ color: GRAY, fontSize: FS.body, padding: "0 2px" }}>…</span>
            : <button key={p} onClick={() => goPage(p)} style={pgStyle(p === curPage, false)}>{p + 1}</button>)}
          <button disabled={curPage === pageCount - 1} onClick={() => goPage(curPage + 1)} style={pgStyle(false, curPage === pageCount - 1)}>›</button>
        </div>
      )}
      {activeList.length > 0 && (
        <div style={{ textAlign: "center", fontFamily: "ui-monospace, monospace", fontSize: FS.meta, color: GRAY, marginTop: 10 }}>
          {curPage * perPage + 1}–{Math.min((curPage + 1) * perPage, activeList.length)} / {activeList.length}{unit}（{pageCount}ページ）
        </div>
      )}
    </>
  );

  return (
    <div style={{ minHeight: "100vh", background: PAPER, fontFamily: `"Hiragino Kaku Gothic ProN", "Hiragino Sans", "Noto Sans JP", sans-serif`, color: INK }}>
      <style>{`
        @keyframes btTrackIn { from { letter-spacing: 0.8em; opacity: 0; } to { letter-spacing: 0.35em; opacity: 1; } }
        @keyframes btLineGrow { from { width: 0; } to { width: 180px; } }
        @keyframes btFadeUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        @keyframes btFadeOut { from { opacity: 1; } to { opacity: 0; } }
        @keyframes btSheetUp { from { transform: translateY(100%); } to { transform: none; } }
        @keyframes btOverlayIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes btGridIn { from { opacity: 0; transform: translateY(10px) scale(0.985); } to { opacity: 1; transform: none; } }
        .bt-mark { animation: btTrackIn 0.9s cubic-bezier(0.22, 1, 0.36, 1) both; }
        .bt-line { animation: btLineGrow 0.7s 0.5s cubic-bezier(0.22, 1, 0.36, 1) both; }
        .bt-tag { animation: btFadeUp 0.6s 0.9s ease both; }
        .bt-splash-out { animation: btFadeOut 0.6s ease both; }
        .bt-overlay { animation: btOverlayIn 0.32s ease both; }
        .bt-sheet { animation: btSheetUp 0.44s cubic-bezier(0.22, 1, 0.36, 1) both; }
        .bt-card { animation: btGridIn 0.55s cubic-bezier(0.22, 1, 0.36, 1) backwards; transition: transform 0.4s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.4s cubic-bezier(0.22, 1, 0.36, 1); box-shadow: 0 1px 2px rgba(23,21,15,0.04); }
        .bt-card:hover { box-shadow: 0 8px 24px rgba(23,21,15,0.10); }
        .bt-card:active { transform: scale(0.98); }
        @keyframes btCardTap { 0% { transform: scale(1); } 42% { transform: scale(0.972); } 100% { transform: scale(1); } }
        .bt-card-tap { animation: btCardTap 0.6s cubic-bezier(0.22, 1, 0.36, 1); }
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
            <div style={{ fontWeight: 800, fontSize: FS.head, letterSpacing: "0.12em" }}>BEAN&nbsp;TRACKER</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ display: "flex", border: `1px solid ${INK}`, borderRadius: 6, overflow: "hidden" }}>
                {[["JPY", "¥"], ["USD", "$"]].map(([k, sym]) => (
                  <button key={k} onClick={() => setDisplayCur(k)}
                    style={{
                      padding: "3px 10px", border: "none", cursor: "pointer",
                      fontFamily: "ui-monospace, monospace", fontSize: FS.meta, fontWeight: 700,
                      background: displayCur === k ? INK : "transparent",
                      color: displayCur === k ? PAPER : INK,
                    }}>{sym}</button>
                ))}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 2 }}>
            {/* 惹句は1つ。2行あっても言っていることは同じで、豆に着くのが遅くなるだけ */}
            <div style={{ fontSize: FS.meta, color: GRAY }}>Find any bean, anywhere.</div>
            {/* 為替は、ふつうでないときだけ出す。取れているのが当たり前の状態なので、
                「LIVE · 12:34更新」を常に出しても読む人には使い道がない。
                固定値で出しているときだけは、ドル表示がずれるので知らせる。 */}
            {!fx.live && (
              <div title={fxTitle} style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0, fontFamily: "ui-monospace, monospace", fontSize: FS.meta, color: GRAY, whiteSpace: "nowrap" }}>
                <span style={{ width: 6, height: 6, borderRadius: 999, background: fx.error ? "#B8433A" : "#C8B36A" }} />
                {fx.loading ? "為替 取得中…" : "為替 固定値"}
              </div>
            )}
          </div>
          {/* 8つのうち「マイページ」と「About」が画面の外にあり、横に送れることを
              示すものが無かった。字間と間隔を詰めたうえで、右端に影を出す。 */}
          <div style={{ position: "relative", marginTop: 10 }}>
          <div ref={tabsRef} style={{ display: "flex", gap: 11, overflowX: "auto", WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}>
            {/* About はここから外して、下のフッターに置いた。
                8つだと必要な幅が 415px で、画面の帯（382px）に収まらない。
                字を小さくすれば収まるが、それは読みやすさの話と衝突する。
                About は一度読めば足りる説明なので、法務のリンクと同じ場所でいい。 */}
            {[["zukan", "図鑑"], ["map", "地球"], ["shindan", "診断"], ["flavor", "味わい"], ["geisha", "レアロット"], ["recipe", "レシピ"], ["me", "マイページ"]].map(([k, l]) => (
              <button key={k} onClick={() => { setView(k); setFlavorFocus({ fam: null, id: null }); }}
                style={{
                  background: "none", border: "none", padding: "0 0 6px", cursor: "pointer",
                  fontSize: FS.body, letterSpacing: "0.04em", whiteSpace: "nowrap", flexShrink: 0,
                  color: view === k || (k === "zukan" && view === "roaster") ? INK : GRAY,
                  fontWeight: view === k || (k === "zukan" && view === "roaster") ? 700 : 400,
                  borderBottom: view === k || (k === "zukan" && view === "roaster") ? `2px solid ${INK}` : "2px solid transparent",
                }}>{l}</button>
            ))}
          </div>
          {tabsOverflow && (
            <div aria-hidden style={{ position: "absolute", right: 0, top: 0, bottom: 6, width: 24, pointerEvents: "none",
              background: `linear-gradient(to right, rgba(250,250,247,0), ${PAPER})` }} />
          )}
          </div>
        </div>
      </header>

      <main style={{ maxWidth: (view === "zukan" || view === "process") ? 1120 : 640, margin: "0 auto", padding: "16px 16px 60px" }}>
        {view === "roaster" && roasterId ? (
          <RoasterPage key={roasterId + roasterTab} rid={roasterId} initialTab={roasterTab} onOpen={setOpen} onBack={() => setView("zukan")} onRoaster={goRoaster} cur={displayCur} />
        ) : view === "map" ? (
          <GlobeView onRoaster={goRoaster} />
        ) : view === "shindan" ? (
          <DiagnosisView onRoaster={goRoaster} />
        ) : view === "flavor" ? (
          <>
            {/* 1枚に全部載せると Washed が73%を占めて他が埋もれる。
                精製ごとに分けて並べる見かたも選べるようにする。 */}
            <div style={{ display: "inline-flex", border: `1px solid ${INK}`, borderRadius: 8, overflow: "hidden", marginBottom: 12 }}>
              {[["one", "1枚で見る"], ["proc", "精製ごとに見る"]].map(([k, l]) => (
                <button key={k} onClick={() => setFlavorMode(k)}
                  style={{ padding: "6px 14px", border: "none", cursor: "pointer", fontSize: FS.body, fontWeight: 700,
                    background: flavorMode === k ? INK : PAPER, color: flavorMode === k ? PAPER : INK }}>{l}</button>
              ))}
            </div>
            {flavorMode === "proc"
              ? <FlavorByProcess onOpen={setOpen} />
              : <FlavorMapView onOpen={setOpen} initialFam={flavorFocus.fam} focusId={flavorFocus.id} />}
            <ProcessChart cur={displayCur} onProcess={goProcess} />
          </>
        ) : view === "process" ? (
          <ProcessPage pkey={procKey} onOpen={setOpen} onRoaster={goRoaster} onProcess={goProcess} onBack={() => { setView("flavor"); window.scrollTo(0, 0); }} cur={displayCur} />
        ) : view === "geisha" ? (
          <GeishaView onOpen={setOpen} cur={displayCur} onPremium={() => { setView("me"); setMeTab("premium"); window.scrollTo(0, 0); }} />
        ) : view === "me" ? (
          <>
            {/* マイページ内サブ切替：記録 / プレミアム */}
            <div style={{ display: "flex", gap: 0, marginBottom: 16, border: `1px solid ${INK}`, borderRadius: 8, overflow: "hidden", maxWidth: 360 }}>
              {[["log", "☕ 味の記録"], ["premium", "★ プレミアム"]].map(([k, l]) => (
                <button key={k} onClick={() => setMeTab(k)}
                  style={{ flex: 1, padding: "9px 0", border: "none", cursor: "pointer", fontSize: FS.body, fontWeight: 700, background: meTab === k ? INK : PAPER, color: meTab === k ? PAPER : INK }}>{l}</button>
              ))}
            </div>
            {meTab === "premium"
              ? <PremiumView onOpen={setOpen} onNeedSignIn={() => { setMeTab("log"); window.scrollTo(0, 0); }} />
              : <MyLogView onOpen={setOpen} onRoaster={goRoaster} authNotice={authNotice} onDismissNotice={() => setAuthNotice(null)} />}
          </>
        ) : view === "recipe" ? (
          <RecipeView />
        ) : view === "about" ? (
          <AboutView />
        ) : (
          <>
            {/* 操作系は640pxに集約（グリッドはワイド） */}
            <div style={{ maxWidth: 640, margin: "0 auto" }}>
            {/* 表示切替：豆 / ロースター */}
            <div style={{ display: "inline-flex", border: `1px solid ${INK}`, borderRadius: 8, overflow: "hidden", marginBottom: 10 }}>
              {[["beans", "豆"], ["roasters", "ロースター"]].map(([k, l]) => (
                <button key={k} onClick={() => setZukanMode(k)}
                  style={{ padding: "6px 16px", border: "none", cursor: "pointer", fontSize: FS.body, fontWeight: 700, background: zukanMode === k ? INK : PAPER, color: zukanMode === k ? PAPER : INK }}>{l}</button>
              ))}
            </div>
            {/* フリーワード検索 */}
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={zukanMode === "roasters" ? "ロースター名・都市で検索" : "ロースター名・農園名・豆名で検索"}
              style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", borderRadius: 8, border: `1px solid ${LINE}`, fontSize: FS.body, marginBottom: 8, background: PAPER, color: INK }} />
            {zukanMode === "beans" && (<>
            {/* 絞り込みと並び替えは畳んでおく。
                最初の豆が出てくるのが 451px（896pxの画面の半分）で、そこまでに
                操作が18個あった。ほとんどの人は絞り込まずにまず豆を見る。
                いま効いている条件はこの下の札で見えるので、畳んでも見失わない。 */}
            <button onClick={() => setFiltersOpen((v) => !v)}
              style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", padding: "9px 12px", marginBottom: 8,
                borderRadius: 8, border: `1px solid ${LINE}`, background: PAPER, color: INK, fontSize: FS.body, cursor: "pointer" }}>
              絞り込みと並び替え
              {activeFilters.length > 0 && (
                <span style={{ fontFamily: "ui-monospace, monospace", fontSize: FS.meta, color: PAPER, background: INK, borderRadius: 999, padding: "1px 7px" }}>{activeFilters.length}</span>
              )}
              <span style={{ marginLeft: "auto", color: GRAY }}>{filtersOpen ? "▲" : "▼"}</span>
            </button>
            {filtersOpen && (<>
            {/* 絞り込み。3つあるので、幅に応じて2列にも3列にもなる。
                固定2列だと3つ目が半分の幅で1つだけ残り、空き升がある見た目になっていた。
                grid ではなく flex にしているのは、行に1つしか載らないときに
                その1つを幅いっぱいに伸ばすため。 */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
              {/* 産地は29個ある。平らに並べると目当てに着くまで延々スクロールするので、
                  地域ごとにまとめる（iPhone でも Android でも見出し付きで出る）。 */}
              <select value={origin} onChange={(e) => setOrigin(e.target.value)} style={{ ...minSel, flex: "1 1 150px", width: "auto" }} aria-label="産地">
                <option value="すべて">産地：すべて</option>
                {ORIGIN_GROUPS.map(([label, list]) => (
                  <optgroup key={label} label={label}>
                    {list.map((o) => <option key={o} value={o}>{o}</option>)}
                  </optgroup>
                ))}
              </select>
              <select value={processF} onChange={(e) => setProcessF(e.target.value)} style={{ ...minSel, flex: "1 1 150px", width: "auto" }} aria-label="精製">
                {PROCESSES.map((p) => <option key={p} value={p}>{p === "すべて" ? "精製：すべて" : p}</option>)}
              </select>
              <select value={priceF} onChange={(e) => setPriceF(e.target.value)} style={{ ...minSel, flex: "1 1 150px", width: "auto" }} aria-label="価格帯">
                {Object.keys(PRICE_BANDS).map((k) => <option key={k} value={k}>{priceBandLabel(k, displayCur)}</option>)}
              </select>
            </div>
            {/* 並び替えは絞り込みとは別の操作なので、同じ升目に混ぜず1行に分けて出す。
                4つの升の1つに紛れていたころは、並べ替えられること自体が気づかれにくかった。 */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: FS.meta, color: GRAY, flexShrink: 0 }}>並び替え</span>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{ ...minSel, flex: 1 }} aria-label="並び替え">
                <option value="default">おすすめ順</option>
                <option value="p100desc">値段が高い順（100gあたり）</option>
                <option value="p100asc">値段が安い順（100gあたり）</option>
                <option value="new">新しい順（図鑑に入った日）</option>
                <option value="old">古い順（図鑑に入った日）</option>
              </select>
            </div>
            </>)}
            {/* いま効いている絞り込み。
                絞り込みは4か所（検索・産地・精製・価格）に分かれていて、1つ掛けたまま
                忘れると「豆が出てこない」と見える。何が効いているかを1行にまとめ、
                その場で外せるようにする。何も掛かっていないときは出さない。 */}
            {activeFilters.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginBottom: 8 }}>
                {activeFilters.map((f) => (
                  <button key={f.key} onClick={f.clear} title={`${f.label}を外す`}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 8px 5px 10px",
                      borderRadius: 999, border: `1px solid ${INK}`, background: PAPER, color: INK,
                      fontSize: FS.meta, cursor: "pointer", maxWidth: "100%" }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.label}</span>
                    <span style={{ color: GRAY, fontSize: FS.body, lineHeight: 1 }}>✕</span>
                  </button>
                ))}
                {activeFilters.length > 1 && (
                  <button onClick={clearFilters}
                    style={{ background: "none", border: "none", padding: "5px 4px", cursor: "pointer",
                      fontSize: FS.meta, color: GRAY, textDecoration: "underline", textUnderlineOffset: 2 }}>
                    すべて外す
                  </button>
                )}
              </div>
            )}
            <div style={{ display: "flex", gap: 14, marginTop: 12, borderBottom: `1px solid ${LINE}`, paddingBottom: 8 }}>
              {[["all", "すべて"], ["now", "NOW"], ["sold", "SOLD OUT"], ["archive", "ARCHIVE"]].map(([k, l]) => (
                <button key={k} onClick={() => setStatusF(k)}
                  style={{
                    background: "none", border: "none", padding: 0, cursor: "pointer",
                    fontFamily: "ui-monospace, monospace", fontSize: FS.meta, letterSpacing: "0.05em",
                    color: statusF === k ? INK : GRAY, fontWeight: statusF === k ? 700 : 400,
                    borderBottom: statusF === k ? `2px solid ${INK}` : "2px solid transparent", paddingBottom: 6,
                  }}>{l}</button>
              ))}
              <div style={{ marginLeft: "auto", fontFamily: "ui-monospace, monospace", fontSize: FS.meta, color: GRAY, alignSelf: "center" }}>{/* アーカイブはロースターのカードが並ぶため、枚数と件数が食い違って見えないよう軒数も出す */}{statusF === "archive" ? `${Object.keys(archiveByRoaster).length} 店 / ${archiveBeans.length} 銘柄` : `${filtered.length} 銘柄`}</div>
            </div>
            {/* 色の凡例（精製方法／レア）。
                7つで2行を占め、操作系と豆の間に常に居座っていた。画面の狭い端末では、
                この2行のぶんだけ豆が下に押し出される。一度読めば足りる説明なので、
                畳めるようにして、開いたかどうかを端末に覚えさせる。 */}
            <div style={{ marginTop: 10 }}>
              <button onClick={() => setLegendOpen((v) => !v)}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none",
                  padding: 0, cursor: "pointer", fontSize: FS.meta, color: GRAY }}>
                <span style={{ display: "inline-flex", gap: 2 }}>
                  {LEGEND.slice(0, 5).map((l) => (
                    <span key={l.key} style={{ width: 8, height: 8, borderRadius: 2, background: l.bg }} />
                  ))}
                </span>
                色の見かた {legendOpen ? "▲" : "▼"}
              </button>
              {legendOpen && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 12px", marginTop: 8, fontSize: FS.meta, color: GRAY }}>
                  {LEGEND.map((l) => (
                    <span key={l.key} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 3, background: l.bg }} />{l.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
            </>)}
            </div>{/* /640集約 */}
            {zukanMode === "roasters" ? (
              <>
                {/* ロースター図鑑 */}
                <div style={gridStyle}>
                  {pageItems.map(([rid, r]) => (
                    <button key={rid} onClick={() => goRoaster(rid, "now")} className="bt-card"
                      style={{ display: "flex", flexDirection: "column", gap: 5, background: PAPER, border: `1px solid ${LINE}`, borderRadius: 10, padding: "11px 11px", cursor: "pointer", textAlign: "left" }}>
                      <div style={{ fontSize: FS.body, fontWeight: 700, color: INK, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</div>
                      <div style={{ fontSize: FS.meta, color: GRAY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.city} · {r.country}</div>
                      <div style={{ marginTop: 2, fontFamily: "ui-monospace, monospace", fontSize: FS.meta }}>
                        <span style={{ color: (nowCountByRoaster[rid] || 0) ? GREEN : GRAY }}>NOW {nowCountByRoaster[rid] || 0}</span>
                      </div>
                    </button>
                  ))}
                </div>
                {activeList.length === 0 && (
                  <div style={{ textAlign: "center", color: GRAY, fontSize: FS.body, padding: "50px 0" }}>該当するロースターがありません。</div>
                )}
                {pagerEl}
              </>
            ) : statusF === "archive" ? (
              /* ARCHIVE: ロースターを選んで歴代ポートフォリオへ */
              <div style={{ marginTop: 18 }}>
                <div style={{ fontSize: FS.meta, color: GRAY, marginBottom: 14 }}>
                  ロースターを選ぶと、その店の歴代ポートフォリオが開きます。
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                  {Object.entries(archiveByRoaster).map(([rid, arc]) => {
                    const r = ROASTERS[rid];
                    if (!r || arc.length === 0) return null;
                    const years = arc.map((b) => Number(b.year));
                    return (
                      <button key={rid} onClick={() => goRoaster(rid, "archive")} className="bt-card"
                        style={{
                          display: "flex", flexDirection: "column", gap: 7,
                          background: PAPER, border: `1px solid ${LINE}`, borderRadius: 8,
                          padding: "8px 8px", cursor: "pointer", textAlign: "left",
                        }}>
                        {/* ミニ標本プレビュー。1枠だけだと縦に伸びてカードの高さが揃わないため、
                            常に3枠・固定高さで並べ、足りない分は余白として置く */}
                        <div style={{ display: "flex", gap: 3, height: 46 }}>
                          {[0, 1, 2].map((i) => (
                            <div key={i} style={{ flex: 1, borderRadius: 2, background: arc[i] ? beanStyle(arc[i]).bg : "#F0EDE4" }} />
                          ))}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: FS.meta, fontWeight: 700, color: INK, lineHeight: 1.25, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</div>
                          {/* 年と件数は必ず別行にする。1行にすると年の桁数で折り返しが起き、
                              カードの高さが1枚だけ変わって列が乱れる */}
                          <div style={{ fontFamily: "ui-monospace, monospace", fontSize: FS.meta, color: GRAY, marginTop: 2, lineHeight: 1.5 }}>
                            {/* 単年なら "2025–2025" ではなく "2025" と書く */}
                            <div>{Math.min(...years) === Math.max(...years)
                              ? Math.min(...years)
                              : `${Math.min(...years)}–${Math.max(...years)}`}</div>
                            <div>{arc.length} 銘柄</div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <>
                {/* グリッド図鑑（列数 × 10行 / ページ） */}
                <div style={gridStyle}>
                  {pageItems.map((b) => <BeanCard key={b.id} bean={b} onOpen={setOpen} onRoaster={goRoaster} cur={displayCur} />)}
                </div>
                {filtered.length === 0 && (
                  <div style={{ textAlign: "center", color: GRAY, fontSize: FS.body, padding: "50px 0" }}>該当する豆がありません。フィルタを変えてみてください。</div>
                )}
                {pagerEl}
              </>
            )}
            {/* フッター注記 */}
            <div style={{ maxWidth: 640, margin: "0 auto", marginTop: 36, borderTop: `1px solid ${LINE}`, paddingTop: 14, fontSize: FS.meta, color: GRAY, lineHeight: 1.7 }}>
              カードは各ロースターの実ロゴを表示します。巡回システムが商品画像URL（bean.img）を取得すると、その豆の実際のECパッケージ写真に自動で切り替わります（未取得・読み込み失敗時は標本カードにフォールバック）。
              評価機能はありません — この図鑑は探して辿り着くためのインフラです。 円⇄ドル換算はライブ為替（対応時）を用い、変動を自動反映します。取得できない環境では固定値にフォールバックします。
            </div>
          </>
        )}
      </main>

      {/* サイト共通フッター（全タブの一番下・法務リンク） */}
      <footer style={{ borderTop: `1px solid ${LINE}`, background: PAPER }}>
        <div style={{ maxWidth: 640, margin: "0 auto", padding: "18px 16px 30px" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 16px", justifyContent: "center" }}>
            <button onClick={() => { setView("about"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
              style={{ background: "none", border: "none", padding: 0, cursor: "pointer",
                fontSize: FS.meta, color: view === "about" ? INK : GRAY,
                fontWeight: view === "about" ? 700 : 400 }}>
              この図鑑について
            </button>
            <Link href="/legal/tokushoho/" style={{ fontSize: FS.meta, color: GRAY, textDecoration: "none" }}>特定商取引法に基づく表記</Link>
            <Link href="/legal/terms/" style={{ fontSize: FS.meta, color: GRAY, textDecoration: "none" }}>利用規約</Link>
            <Link href="/legal/privacy/" style={{ fontSize: FS.meta, color: GRAY, textDecoration: "none" }}>プライバシーポリシー</Link>
          </div>
          <div style={{ textAlign: "center", fontFamily: "ui-monospace, monospace", fontSize: FS.meta, color: GRAY, marginTop: 12 }}>
            © 2026 BEAN TRACKER
          </div>
        </div>
      </footer>

      {/* ホーム画面に追加すると使い勝手が変わるので、1回だけ案内する */}
      <InstallHint />

      <DetailSheet bean={open} onClose={() => setOpen(null)} onRoaster={goRoaster} onFlavor={goFlavor} onOpen={setOpen} cur={displayCur} />
    </div>
  );
}
