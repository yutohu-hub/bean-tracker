"use client";
// 画面の状態をURLに載せる。
//
// これまで状態は全てReactの中だけにあったので、
//   * 見つけた豆を人に送れない（リンクを送っても相手はトップに着地する）
//   * 戻るボタンでタブが戻らない
//   * 検索エンジンから見ると、6,000件の豆がある1ページのサイトにしか見えない
// という状態だった。送客が目的のサイトで、これは一番大きな取りこぼし。
//
// 静的書き出し（output: export）なので、実体は index.html 1枚のまま。
// クエリだけを読み書きして、起動時にそこから画面を組み立て直す。

// URLに出す状態。ここに無いもの（列数など、その人の見た目の好み）は
// 共有する意味が薄いので載せない。リンクは短いほうが貼りやすい。
//
// 並び順は載せる。「高い順の先頭を見て」と送るときに、
// 相手が同じ並びで開けないと話が噛み合わないため。
const KEYS = {
  v: "view",        // タブ
  b: "bean",        // 開いている豆
  r: "roaster",     // ロースター詳細
  rt: "roasterTab", // ロースター詳細の中のタブ
  p: "process",     // 精製の解説ページ
  q: "query",       // 検索語
  o: "origin",      // 産地
  s: "status",      // 在庫
  sb: "sortBy",     // 並び替え
  me: "meTab",      // マイページの中のタブ
};

const DEFAULTS = {
  view: "zukan", bean: null, roaster: null, roasterTab: "now",
  process: null, query: "", origin: "すべて", status: "all", sortBy: "default", meTab: "log",
};

export function readUrlState() {
  if (typeof window === "undefined") return { ...DEFAULTS };
  const sp = new URLSearchParams(window.location.search);
  const out = { ...DEFAULTS };
  for (const [short, name] of Object.entries(KEYS)) {
    const v = sp.get(short);
    if (v === null || v === "") continue;
    out[name] = name === "bean" ? Number(v) || null : v;
  }
  return out;
}

/* いまの状態をURLに書き戻す。履歴に積むかどうかは呼び出し側が決める。
   タブの移動やカードを開く操作は履歴に積む（戻るで戻れるように）。
   検索語の1文字ごとに履歴が増えると戻るボタンが使い物にならないので、
   そういうものは push=false で置き換える。 */
export function writeUrlState(state, { push = false } = {}) {
  if (typeof window === "undefined") return;
  const sp = new URLSearchParams();
  for (const [short, name] of Object.entries(KEYS)) {
    const v = state[name];
    if (v === null || v === undefined || v === "" || v === DEFAULTS[name]) continue;
    sp.set(short, String(v));
  }
  const qs = sp.toString();
  const url = window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash;
  if (url === window.location.pathname + window.location.search + window.location.hash) return;
  try {
    if (push) window.history.pushState(null, "", url);
    else window.history.replaceState(null, "", url);
  } catch {}
}

// 戻る/進むでURLが変わったときに呼ばれる購読口
export function onUrlChange(fn) {
  if (typeof window === "undefined") return () => {};
  const h = () => fn(readUrlState());
  window.addEventListener("popstate", h);
  return () => window.removeEventListener("popstate", h);
}

// 共有用の絶対URL（「リンクをコピー」で使う）
export function shareUrl(state) {
  if (typeof window === "undefined") return "";
  const sp = new URLSearchParams();
  for (const [short, name] of Object.entries(KEYS)) {
    const v = state[name];
    if (v === null || v === undefined || v === "" || v === DEFAULTS[name]) continue;
    sp.set(short, String(v));
  }
  const qs = sp.toString();
  return `${window.location.origin}${window.location.pathname}${qs ? `?${qs}` : ""}`;
}
