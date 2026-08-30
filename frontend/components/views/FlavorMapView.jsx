"use client";
import { useState, useRef, useEffect, useMemo } from "react";
import { FS, INK, PAPER, GRAY, LINE } from "../lib/theme";
import { BEANS } from "../data/beans";
import { ROASTERS } from "../data/roasters";
import { FLAVORS, flavorOf } from "../data/flavors";
import { PROC, processKey } from "../lib/palette";

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const MIN = 1, MAX = 5;
const PROC_ORDER = ["washed", "natural", "honey", "anatural", "awashed", "other", "unknown"];

export function FlavorMapView({ onOpen, initialFam = null, focusId = null, procOnly = null }) {
  const [famF, setFamF] = useState(initialFam);  // 系統ハイライト
  /* 既定で「店のノートで座標を決めた豆」だけにする。
     全部出すと 6,031 点になり、点の面積だけで枠の 14 倍になって必ず重なる。
     しかも 73% は産地と精製から推定した座標で、重なった塊はコーヒーの性質では
     なく仕組みの影。少ないほうが読めるし、正しい。 */
  /* 座標の出どころで絞る。既定はいちばん確かなものだけ。
     "sure"  店が見出しを付けて書いた風味（Grape, Guava, Floral のような列挙）
     "notes" 見出しの無い説明文から拾った分も足す（地の文が混ざり、座標がぶれる）
     "all"   産地・精製からの推定も足す（入力が2種類しかないので点が固まる）
     精度を落とす向きにしか動かないので、進むほど件数は増えるが確からしさは下がる。 */
  const [srcLevel, setSrcLevel] = useState(null);   // null = まだ選んでいない
  const [procF, setProcF] = useState(null);       // 精製ハイライト
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const boxRef = useRef(null);
  const pointers = useRef(new Map());
  const pinch = useRef(null);
  const pan = useRef(null);
  const moved = useRef(false);

  // いま買える(now)・EC送客できる豆を表示。procOnly 指定時はその精製方法だけに絞る（精製ごとのマップ）
  const all = BEANS.filter((b) => b.status === "now" && ROASTERS[b.r] && ROASTERS[b.r].url && (!procOnly || processKey(b.process) === procOnly));
  // 座標の出どころ。店のノートから出したものと、産地・精製から推定したものを区別する
  const noted = all.filter((b) => flavorOf(b).src === "notes");
  const sure = noted.filter((b) => flavorOf(b).noteSrc === "label");
  /* 既定は「確かな風味」。ただし出どころは巡回が付けるので、一周し終わるまでは
     どの豆にも付いていない。そのとき既定にすると地図が空に見えるので、
     1件も無いあいだは「説明文も」に落とす。人が選んだあとはその選びを守る。 */
  const level = srcLevel || (sure.length ? "sure" : "notes");
  const beans = level === "sure" ? sure : level === "notes" ? noted : all;
  // 図鑑からの遷移時は、その豆の系統をハイライト
  useEffect(() => { if (initialFam) setFamF(initialFam); }, [initialFam, focusId]);
  // now豆に存在する精製方法だけ（柑橘などの系統の上に提示するチップ用）
  const presentProc = PROC_ORDER.filter((k) => beans.some((b) => processKey(b.process) === k));

  // 目標スケールへ rAF でイージング（毎フレーム寄せて滑らかに）
  const scaleRef = useRef(1);
  const targetRef = useRef(1);
  const rafRef = useRef(null);
  const animate = () => {
    const t = targetRef.current, cur = scaleRef.current, diff = t - cur;
    if (Math.abs(diff) < 0.002) {
      scaleRef.current = t; setScale(t); rafRef.current = null;
      if (t <= 1.001) { setTx(0); setTy(0); }
      return;
    }
    const ns = cur + diff * 0.25;
    scaleRef.current = ns; setScale(ns);
    rafRef.current = requestAnimationFrame(animate);
  };
  const setTargetScale = (t) => {
    targetRef.current = clamp(t, MIN, MAX);
    if (!rafRef.current) rafRef.current = requestAnimationFrame(animate);
  };
  const reset = () => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    scaleRef.current = 1; targetRef.current = 1; setScale(1); setTx(0); setTy(0);
  };
  const zoomBy = (f) => setTargetScale(targetRef.current * f);

  // ホイール/トラックパッドでズーム（passive:false）
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const onWheel = (e) => { e.preventDefault(); setTargetScale(targetRef.current * (e.deltaY < 0 ? 1.1 : 1 / 1.1)); };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => { el.removeEventListener("wheel", onWheel); if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onPointerDown = (e) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved.current = false;
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { d: dist(a, b) || 1 };
      pan.current = null;
    } else if (pointers.current.size === 1) {
      pan.current = { x: e.clientX, y: e.clientY, tx, ty };
    }
  };
  const onPointerMove = (e) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const d = dist(a, b);
      const ratio = clamp(d / pinch.current.d, 0.5, 2);   // 1移動あたりの比率
      pinch.current.d = d;
      moved.current = true;
      setTargetScale(targetRef.current * ratio);
    } else if (pan.current && pointers.current.size === 1 && scale > 1) {
      const dx = e.clientX - pan.current.x, dy = e.clientY - pan.current.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved.current = true;
      const lim = 260 * (scale - 1);
      setTx(clamp(pan.current.tx + dx, -lim, lim));
      setTy(clamp(pan.current.ty + dy, -lim, lim));
    }
  };
  const onPointerUp = (e) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 0) { pan.current = null; if (scale === 1) { setTx(0); setTy(0); } }
  };

  /* ---- 点を描く / 触れた場所からいちばん近い豆を拾う ---- */
  const cvRef = useRef(null);
  const [box, setBox] = useState(360);   // 図の一辺（px）

  // 図の大きさを測る。canvas は中身の解像度を自分で持つので、実寸が要る
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => setBox(Math.max(200, el.clientWidth));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* 豆 → 図の中の位置。拡大と移動をそのまま座標に掛ける
     （要素を transform していたころと同じ見え方になる）。 */
  const at = (m) => {
    const c = box / 2;
    return [(m.fx / 100 * box - c) * scale + c + tx, (m.fy / 100 * box - c) * scale + c + ty];
  };

  // 描画対象。系統や精製で絞ったものは薄く残す（消すと分布が分からなくなる）
  const pts = useMemo(() => beans.map((b) => {
    const m = flavorOf(b);
    const pk = processKey(b.process);
    // 真偽値にしておく。null のままだと下の描画で pass(true/false) と一致せず、
    // 全部の点が読み飛ばされて図が空になる
    return { b, m, color: (FLAVORS[m.fam] || FLAVORS.citrus).color,
             dim: Boolean((famF && famF !== m.fam) || (procF && procF !== pk)) };
  }), [beans, famF, procF]);

  useEffect(() => {
    const cv = cvRef.current;
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = box * dpr; cv.height = box * dpr;
    const g = cv.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, box, box);

    // 十字の補助線。図と一緒に動く
    g.strokeStyle = LINE; g.lineWidth = 1;
    const [cx, cy] = at({ fx: 50, fy: 50 });
    g.beginPath();
    g.moveTo(cx, 0); g.lineTo(cx, box);
    g.moveTo(0, cy); g.lineTo(box, cy);
    g.stroke();

    // 薄いものを先に描いて、目立たせるものを上に重ねる
    const r = 5.5;
    for (const pass of [true, false]) {
      for (const p of pts) {
        if (p.dim !== pass) continue;
        const [x, y] = at(p.m);
        if (x < -20 || y < -20 || x > box + 20 || y > box + 20) continue;
        /* 薄くする側は無彩色にする。自分の色のまま薄くすると、密なところで
           何十個も重なって結局その色が濃く出てしまい、絞り込んだ意味が消える。 */
        g.globalAlpha = p.dim ? 0.10 : 0.75;
        g.fillStyle = p.dim ? GRAY : p.color;
        g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
        if (focusId && p.b.id === focusId) {
          g.globalAlpha = 1; g.strokeStyle = INK; g.lineWidth = 2.4;
          g.beginPath(); g.arc(x, y, r * 1.8, 0, Math.PI * 2); g.stroke();
        }
      }
    }
    g.globalAlpha = 1;
    // at() は box/scale/tx/ty だけから作られるので、依存はその4つで足りている
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pts, box, scale, tx, ty, focusId]);

  // 触れた場所にいちばん近い豆。細かい点を正確に狙わせない
  const HIT = 26;
  const pick = (e) => {
    if (moved.current) return;
    const rect = cvRef.current.getBoundingClientRect();
    const px = e.clientX - rect.left, py = e.clientY - rect.top;
    let best = null, bd = HIT;
    for (const p of pts) {
      if (p.dim) continue;                 // 薄くしたものは拾わない
      const [x, y] = at(p.m);
      const d = Math.hypot(x - px, y - py);
      if (d < bd) { bd = d; best = p; }
    }
    if (best) onOpen(best.b);
  };

  const zbtn = { width: 30, height: 30, borderRadius: 8, border: `1px solid ${LINE}`, background: "rgba(250,250,247,0.92)", color: INK, fontSize: FS.lead, fontWeight: 700, cursor: "pointer", lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" };

  return (
    <div>
      <div style={{ fontSize: FS.meta, color: GRAY, marginBottom: 10 }}>
        {procOnly
          ? `${PROC[procOnly] ? PROC[procOnly].label : ""}の豆だけを味わいの座標で。●をタップで詳細、系統でさらに絞り込めます。`
          : "いま買える豆を、味わいの座標で。ピンチ／ホイールで拡大、ドラッグで移動。●をタップするとその豆の詳細へ移動します。"}
      </div>

      {/* 精製方法（柑橘などの系統の「上」に提示・タップでハイライト）。精製ごとのマップでは非表示 */}
      {!procOnly && (
        <>
          <div style={{ fontSize: FS.meta, color: GRAY, letterSpacing: "0.1em", marginBottom: 4 }}>精製方法</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, paddingBottom: 8 }}>
            {presentProc.map((k) => (
              <button key={k} onClick={() => setProcF(procF === k ? null : k)}
                style={{
                  flexShrink: 0, display: "flex", alignItems: "center", gap: 5,
                  padding: "5px 11px", borderRadius: 999, fontSize: FS.meta, cursor: "pointer",
                  border: `1px solid ${procF === k ? PROC[k].bg : LINE}`,
                  background: procF === k ? PROC[k].bg : "transparent",
                  color: procF === k ? "#fff" : INK, transition: "all 0.2s ease",
                }}>
                <span style={{ width: 8, height: 8, borderRadius: 3, background: procF === k ? "#fff" : PROC[k].bg }} />
                {PROC[k].label}
              </button>
            ))}
          </div>
        </>
      )}

      {/* 座標の出どころを隠さない。
          同じ「ノートから置いた」でも、見出しのある列挙と、説明文の地の文では
          座標の確からしさが違う。件数を出して選べるようにする。
          既定はいちばん確かなものだけ（件数より確からしさを優先する）。 */}
      <div style={{ marginBottom: 4, fontSize: FS.meta, color: GRAY, letterSpacing: "0.1em" }}>
        座標の出どころ
      </div>
      <div style={{ display: "flex", gap: 0, marginBottom: 6, border: `1px solid ${LINE}`, borderRadius: 8, overflow: "hidden" }}>
        {[["sure", "確かな風味", sure.length],
          ["notes", "説明文も", noted.length],
          ["all", "推定も", all.length]].map(([k, label, n]) => (
          <button key={k} onClick={() => setSrcLevel(k)}
            style={{ flex: 1, padding: "8px 4px", background: level === k ? INK : PAPER,
              color: level === k ? PAPER : GRAY, border: "none", cursor: "pointer",
              fontSize: FS.meta, fontWeight: level === k ? 700 : 400 }}>
            {label} <span style={{ fontFamily: "ui-monospace, monospace", opacity: 0.8 }}>{n}</span>
          </button>
        ))}
      </div>
      <div style={{ fontSize: FS.meta, color: GRAY, lineHeight: 1.7, marginBottom: 10 }}>
        {level === "sure"
          ? "店が「Tasting Notes」として書いた風味だけで置いています。いちばん確かです。"
          : level === "notes"
            ? "見出しの無い説明文から拾った風味も足しています。間違ってはいませんが、地の文が混ざるぶん座標がぶれます。"
            : "産地と精製からの推定も足しています。入力が2種類しかないので、点が同じ場所に固まります。"}
      </div>

      {/* 系統の凡例（タップでハイライト） */}
      <div style={{ fontSize: FS.meta, color: GRAY, letterSpacing: "0.1em", marginBottom: 4 }}>系統</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, paddingBottom: 8 }}>
        {Object.entries(FLAVORS).map(([k, f]) => (
          <button key={k} onClick={() => setFamF(famF === k ? null : k)}
            style={{
              flexShrink: 0, display: "flex", alignItems: "center", gap: 5,
              padding: "5px 11px", borderRadius: 999, fontSize: FS.meta, cursor: "pointer",
              border: `1px solid ${famF === k ? f.color : LINE}`,
              background: famF === k ? f.color : "transparent",
              color: famF === k ? "#fff" : INK,
              transition: "all 0.2s ease",
            }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: famF === k ? "#fff" : f.color }} />
            {f.label}
          </button>
        ))}
      </div>

      {/* マップ本体 */}
      <div ref={boxRef}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onPointerLeave={onPointerUp}
        style={{ position: "relative", width: "100%", aspectRatio: "1 / 1", marginTop: 6,
          borderRadius: 12, border: `1.4px solid ${INK}`, overflow: "hidden", touchAction: "none",
          cursor: scale > 1 ? "grab" : "default",
          background: `
            radial-gradient(at 15% 12%, rgba(217,180,65,0.13), transparent 55%),
            radial-gradient(at 85% 12%, rgba(217,140,166,0.14), transparent 55%),
            radial-gradient(at 85% 88%, rgba(124,77,143,0.12), transparent 55%),
            radial-gradient(at 15% 88%, rgba(122,82,50,0.13), transparent 55%),
            #FCFBF8` }}>

        {/* 点は canvas に描く。
            要素として置いていたころは、1画面に <button> が 6,054 個・DOM が
            12,209 個あった。キーボードで送ると次の見出しまで 6,054 回押すことに
            なり、開くだけで重い。精製ごとのマップは既に canvas で描いていて
            成立しているので、こちらも同じにする。
            触れた場所からいちばん近い豆を拾うので、細かい点を狙わせない。 */}
        <canvas ref={cvRef} onClick={pick}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }} />

        {/* 軸ラベル（固定・拡大しない） */}
        <span style={{ position: "absolute", top: 6, left: "50%", transform: "translateX(-50%)", fontSize: FS.meta, color: GRAY, letterSpacing: "0.15em", pointerEvents: "none" }}>明るい・すっきり</span>
        <span style={{ position: "absolute", bottom: 6, left: "50%", transform: "translateX(-50%)", fontSize: FS.meta, color: GRAY, letterSpacing: "0.15em", pointerEvents: "none" }}>深い・コク</span>
        {/* よこ軸の名前は図の外（下）に出す。中に置くと縦書きになり、
            rotate でも writing-mode でも右側が枠に当たって潰れた（実測 15×5px）。
            たて軸は上下に横書きで収まるので、そのまま図の中に置く。 */}

      </div>

      {/* よこ軸の名前 */}
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: FS.meta, color: GRAY, marginTop: 6, letterSpacing: "0.1em" }}>
        <span>← クリーン</span>
        <span>個性派 →</span>
      </div>

      {/* ズームは図の外に出す。中に置いていたころは、右下の点の上に重なっていた */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
        <button aria-label="縮小" onClick={() => zoomBy(1 / 1.3)} style={zbtn}>−</button>
        <button aria-label="拡大" onClick={() => zoomBy(1.3)} style={zbtn}>＋</button>
        <button onClick={reset} style={{ ...zbtn, width: "auto", padding: "0 12px", fontSize: FS.meta }}>もとの大きさ</button>
        <span style={{ marginLeft: "auto", fontFamily: "ui-monospace, monospace", fontSize: FS.meta, color: GRAY }}>
          {beans.length} 点{scale > 1 ? ` ・ ×${scale.toFixed(1)}` : ""}
        </span>
      </div>

      {/* 説明は1つにまとめる。2つを左右に並べていたころは、11pxの2行が
          折り返して互いに重なっていた */}
      <div style={{ fontSize: FS.meta, color: GRAY, marginTop: 8, lineHeight: 1.7 }}>
        右上ほど個性的で明るく、左下ほどクラシックで深い味わいです。色は豆ごとの風味の系統です。
      </div>
    </div>
  );
}
