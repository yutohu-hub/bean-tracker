"use client";
import { useState, useRef, useEffect } from "react";
import { INK, PAPER, GRAY, LINE } from "../lib/theme";
import { BEANS } from "../data/beans";
import { ROASTERS } from "../data/roasters";
import { FLAVORS, flavorOf } from "../data/flavors";
import { PROC, processKey } from "../lib/palette";

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const MIN = 1, MAX = 5;
const PROC_ORDER = ["washed", "natural", "honey", "anatural", "awashed", "other"];

export function FlavorMapView({ onOpen, initialFam = null, focusId = null, procOnly = null }) {
  const [famF, setFamF] = useState(initialFam);  // 系統ハイライト
  const [notesOnly, setNotesOnly] = useState(false);  // 店のノートで座標を決めた豆だけに絞る
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
  const beans = notesOnly ? noted : all;
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

  const zbtn = { width: 30, height: 30, borderRadius: 8, border: `1px solid ${LINE}`, background: "rgba(250,250,247,0.92)", color: INK, fontSize: 16, fontWeight: 700, cursor: "pointer", lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" };

  return (
    <div>
      <div style={{ fontSize: 11, color: GRAY, marginBottom: 10 }}>
        {procOnly
          ? `${PROC[procOnly] ? PROC[procOnly].label : ""}の豆だけを味わいの座標で。●をタップで詳細、系統でさらに絞り込めます。`
          : "いま買える豆を、味わいの座標で。ピンチ／ホイールで拡大、ドラッグで移動。●をタップするとその豆の詳細へ移動します。"}
      </div>

      {/* 精製方法（柑橘などの系統の「上」に提示・タップでハイライト）。精製ごとのマップでは非表示 */}
      {!procOnly && (
        <>
          <div style={{ fontSize: 9.5, color: GRAY, letterSpacing: "0.1em", marginBottom: 4 }}>精製方法</div>
          <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8, WebkitOverflowScrolling: "touch" }}>
            {presentProc.map((k) => (
              <button key={k} onClick={() => setProcF(procF === k ? null : k)}
                style={{
                  flexShrink: 0, display: "flex", alignItems: "center", gap: 5,
                  padding: "5px 11px", borderRadius: 999, fontSize: 11, cursor: "pointer",
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

      {/* 座標の出どころを隠さない。店が書いたノートで置いた豆と、産地・精製から推定した豆は
          精度がまるで違うので、件数を出して絞り込めるようにする */}
      <button onClick={() => setNotesOnly(!notesOnly)}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, width: "100%",
          marginBottom: 10, padding: "9px 12px", background: notesOnly ? INK : "none", color: notesOnly ? PAPER : INK,
          border: `1px solid ${notesOnly ? INK : LINE}`, borderRadius: 8, fontSize: 11.5, cursor: "pointer", textAlign: "left" }}>
        <span style={{ fontWeight: 700 }}>
          {notesOnly ? "✓ 店のノートで置いた豆だけ" : "店のノートで置いた豆だけを見る"}
        </span>
        <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 10.5, opacity: 0.8 }}>
          {noted.length} / {all.length}
        </span>
      </button>

      {/* 系統の凡例（タップでハイライト） */}
      <div style={{ fontSize: 9.5, color: GRAY, letterSpacing: "0.1em", marginBottom: 4 }}>系統</div>
      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8, WebkitOverflowScrolling: "touch" }}>
        {Object.entries(FLAVORS).map(([k, f]) => (
          <button key={k} onClick={() => setFamF(famF === k ? null : k)}
            style={{
              flexShrink: 0, display: "flex", alignItems: "center", gap: 5,
              padding: "5px 11px", borderRadius: 999, fontSize: 11, cursor: "pointer",
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

        {/* 拡大・移動するレイヤー（補助線＋ドット） */}
        <div style={{ position: "absolute", inset: 0, transform: `translate(${tx}px, ${ty}px) scale(${scale})`, transformOrigin: "center center" }}>
          {/* 十字の補助線 */}
          <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: LINE }} />
          <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 1, background: LINE }} />
          {/* 豆のドット */}
          {beans.map((b, i) => {
            const m = flavorOf(b);
            const f = FLAVORS[m.fam] || FLAVORS.citrus;
            const pk = processKey(b.process);
            const isFocus = focusId && b.id === focusId;
            const dimmed = !isFocus && ((famF && famF !== m.fam) || (procF && procF !== pk));
            const base = 11 / Math.sqrt(scale); // 拡大時はドットが大きくなりすぎないよう調整
            const r = isFocus ? base * 1.55 : base;
            return (
              <button key={b.id} onClick={() => { if (moved.current) return; onOpen(b); }} title={b.name}
                className={isFocus ? "bt-live" : "bt-dot"}
                style={{
                  position: "absolute", left: `${m.fx}%`, top: `${m.fy}%`,
                  width: 26, height: 26, marginLeft: -13, marginTop: -13,
                  background: "transparent", border: "none", cursor: "pointer", padding: 0,
                  animationDelay: `${0.2 + (i % 40) * 0.02}s`,
                  opacity: dimmed ? 0.1 : 0.92,
                  transition: "opacity 0.25s ease", zIndex: isFocus ? 3 : 1,
                }}>
                <span
                  style={{
                    display: "block", width: r, height: r, margin: `${(26 - r) / 2}px auto`,
                    borderRadius: 999, background: f.color,
                    border: `${(isFocus ? 2.4 : 2) / Math.sqrt(scale)}px solid ${isFocus ? INK : f.color}`,
                    boxShadow: isFocus ? `0 0 0 ${3 / Math.sqrt(scale)}px rgba(23,21,15,0.18)` : "0 1px 2px rgba(23,21,15,0.18)",
                  }} />
              </button>
            );
          })}
        </div>

        {/* 軸ラベル（固定・拡大しない） */}
        <span style={{ position: "absolute", top: 6, left: "50%", transform: "translateX(-50%)", fontSize: 9, color: GRAY, letterSpacing: "0.15em", pointerEvents: "none" }}>明るい・すっきり</span>
        <span style={{ position: "absolute", bottom: 6, left: "50%", transform: "translateX(-50%)", fontSize: 9, color: GRAY, letterSpacing: "0.15em", pointerEvents: "none" }}>深い・コク</span>
        <span style={{ position: "absolute", left: 8, top: "50%", transform: "translate(-30%, -50%) rotate(-90deg)", fontSize: 9, color: GRAY, letterSpacing: "0.15em", pointerEvents: "none" }}>クリーン</span>
        <span style={{ position: "absolute", right: 8, top: "50%", transform: "translate(30%, -50%) rotate(90deg)", fontSize: 9, color: GRAY, letterSpacing: "0.15em", pointerEvents: "none" }}>個性派</span>

        {/* ズーム操作 */}
        <div style={{ position: "absolute", right: 8, bottom: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          <button aria-label="拡大" onClick={() => zoomBy(1.3)} style={zbtn}>＋</button>
          <button aria-label="縮小" onClick={() => zoomBy(1 / 1.3)} style={zbtn}>−</button>
          <button aria-label="リセット" onClick={reset} style={{ ...zbtn, fontSize: 12 }}>⟲</button>
        </div>
        {scale > 1 && (
          <div style={{ position: "absolute", left: 8, bottom: 8, fontFamily: "ui-monospace, monospace", fontSize: 9.5, color: GRAY, background: "rgba(250,250,247,0.8)", padding: "2px 6px", borderRadius: 6, pointerEvents: "none" }}>
            ×{scale.toFixed(1)}
          </div>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9.5, color: GRAY, marginTop: 6 }}>
        <span>● いま買える豆（タップで詳細へ）</span>
        <span>系統は豆ごとの風味（無ければ産地・精製）で分類</span>
      </div>

      <div style={{ textAlign: "center", fontSize: 10.5, color: GRAY, marginTop: 14 }}>
        右上ほど個性的で明るく、左下ほどクラシックで深い味わいです
      </div>
    </div>
  );
}
