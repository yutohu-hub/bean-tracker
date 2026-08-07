"use client";
/* 味わいマップを精製方法ごとに分けて並べる（small multiples）。
 *
 * 1枚のマップに全部載せると、Washed が全体の73%を占めるので他の精製が埋もれる。
 * 同じ座標軸の小さい図を並べると、「どの精製がどのあたりに居るか」を形で見比べられる。
 *
 * ■ 既定で「店のノートがある豆」だけを出す理由
 *
 * 座標の出どころには2種類ある。店が書いた風味のノートから読み取ったものと、
 * ノートが無いので産地と精製から推定したもの。後者は精製から座標を作っている。
 * それを精製で分けて並べると、精製から作った位置を精製で分けただけの図になり、
 * 見えた塊は仕組みが作った影であって、コーヒーの性質ではない。
 *
 * だから既定はノートのある豆だけ。推定も見たいときは切り替えられるようにして、
 * そのときは何を見ているのかを画面に書く。
 */
import { useMemo, useRef, useEffect, useState } from "react";
import { INK, PAPER, GRAY, LINE } from "../lib/theme";
import { BEANS } from "../data/beans";
import { ROASTERS } from "../data/roasters";
import { flavorOf } from "../data/flavors";
import { PROC, processKey } from "../lib/palette";

// 並べる順。件数の多い順に固定する（絞り込んでも並びが動かないように）
const ORDER = ["washed", "natural", "honey", "anatural", "awashed", "other"];

/* 点の色。カードの背景色をそのまま点に使うと、白地の上で薄すぎるものがある。
   honey は背景色 #C89A3A のままだとコントラスト 2.47 で、基準の3を割る。
   同じ色みのまま濃さだけ落として 3.00 にした（他の5色はそのままで足りている）。 */
const DOT = { washed: "#3E6E7A", natural: "#8A3B2E", honey: "#B48B34",
              anatural: "#48205C", awashed: "#4A4A9E", other: "#6E655A" };

const PAD = 10;          // 図の内側の余白
const HIT = 24;          // 触れたとみなす距離。細かい点を狙わせない

export function FlavorByProcess({ onOpen }) {
  const [notesOnly, setNotesOnly] = useState(true);
  const [table, setTable] = useState(false);

  // いま買えて、買いに行ける豆だけ（1枚のマップと同じ条件）
  const all = useMemo(() => BEANS
    .filter((b) => b.status === "now" && ROASTERS[b.r] && ROASTERS[b.r].url)
    .map((b) => { const f = flavorOf(b); return { b, fx: f.fx, fy: f.fy, src: f.src, k: processKey(b.process) }; }),
    []);
  const shown = useMemo(() => notesOnly ? all.filter((p) => p.src === "notes") : all, [all, notesOnly]);
  const byProc = useMemo(() => {
    const m = {};
    for (const k of ORDER) m[k] = [];
    for (const p of shown) (m[p.k] = m[p.k] || []).push(p);
    return m;
  }, [shown]);

  const panels = ORDER.filter((k) => (byProc[k] || []).length > 0);
  const noted = all.filter((p) => p.src === "notes").length;

  return (
    <div>
      <div style={{ fontSize: 11, color: GRAY, marginBottom: 10, lineHeight: 1.7 }}>
        同じ座標軸で、精製方法ごとに分けて並べています。図の中をタップすると、
        いちばん近い豆の詳細が開きます。
      </div>

      {/* 何を見ているかの切り替え。図より上に1つだけ置く */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        <button onClick={() => setNotesOnly(true)} style={tab(notesOnly)}>
          店のノートがある豆（{noted}）
        </button>
        <button onClick={() => setNotesOnly(false)} style={tab(!notesOnly)}>
          推定も含める（{all.length}）
        </button>
      </div>

      {!notesOnly && (
        <div style={{ fontSize: 10.5, color: INK, background: "#F7F0E4", border: `1px solid ${LINE}`,
          borderRadius: 8, padding: "9px 11px", marginBottom: 12, lineHeight: 1.7 }}>
          いま出しているうち {all.length - noted} 銘柄は、店のノートが無いため
          <strong>産地と精製から座標を推定</strong>しています。精製で分けたこの図では、
          その分は「精製から作った位置を精製で分けた」ものになります。
          塊が見えても、それはコーヒーの性質ではなく仕組みの影です。
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
        {panels.map((k) => (
          <Panel key={k} pkey={k} pts={byProc[k]} onOpen={onOpen} />
        ))}
      </div>

      {/* 軸の意味は1度だけ書く。図ごとに繰り返すと小さい図が文字で埋まる */}
      <div style={{ fontSize: 10, color: GRAY, marginTop: 10, lineHeight: 1.8 }}>
        よこ軸：左ほどクリーン、右ほど個性派　／　たて軸：上ほど明るい、下ほど深い
      </div>

      {/* 図が読めない場合のための表。色だけに頼らせない */}
      <button onClick={() => setTable(!table)}
        style={{ marginTop: 12, background: "none", border: "none", padding: 0, cursor: "pointer",
          fontSize: 11, color: GRAY, textDecoration: "underline", textUnderlineOffset: 2 }}>
        数字で見る {table ? "▲" : "▼"}
      </button>
      {table && <Table byProc={byProc} panels={panels} />}
    </div>
  );
}

const tab = (on) => ({
  padding: "6px 12px", borderRadius: 999, cursor: "pointer", fontSize: 11.5,
  border: `1px solid ${on ? INK : LINE}`, background: on ? INK : PAPER, color: on ? PAPER : INK,
});

/* 1つの精製方法ぶんの図。点が多いので canvas で描く。
   6枚 × 数千点を SVG の要素にすると、開いた瞬間に固まる。 */
function Panel({ pkey, pts, onOpen }) {
  const ref = useRef(null);
  const boxRef = useRef(null);
  const [size, setSize] = useState(160);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => setSize(Math.max(120, el.clientWidth));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = size * dpr; cv.height = size * dpr;
    const g = cv.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, size, size);

    // 中心の十字。目盛りではなく「まんなか」の目印なので細く薄く
    g.strokeStyle = LINE; g.lineWidth = 1;
    g.beginPath();
    g.moveTo(size / 2, PAD); g.lineTo(size / 2, size - PAD);
    g.moveTo(PAD, size / 2); g.lineTo(size - PAD, size / 2);
    g.stroke();

    g.fillStyle = DOT[pkey] || DOT.other;
    g.globalAlpha = 0.55;                      // 重なりの濃さで密度が見えるように
    for (const p of pts) {
      const [x, y] = xy(p, size);
      g.beginPath(); g.arc(x, y, 2.2, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;
  }, [pts, size, pkey]);

  // 触れた場所にいちばん近い豆。細かい点を正確に狙わせない
  const pick = (e) => {
    const r = ref.current.getBoundingClientRect();
    const cx = e.clientX - r.left, cy = e.clientY - r.top;
    let best = null, bd = HIT;
    for (const p of pts) {
      const [x, y] = xy(p, size);
      const d = Math.hypot(x - cx, y - cy);
      if (d < bd) { bd = d; best = p; }
    }
    if (best) onOpen(best.b);
  };

  const meta = PROC[pkey] || PROC.other;
  return (
    <div ref={boxRef}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 4 }}>
        <span style={{ width: 9, height: 9, borderRadius: 2, background: DOT[pkey], flexShrink: 0 }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: INK }}>{meta.label}</span>
        <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, color: GRAY, marginLeft: "auto" }}>
          {pts.length}
        </span>
      </div>
      <canvas ref={ref} onClick={pick}
        style={{ width: "100%", height: size, display: "block", cursor: "pointer",
          background: PAPER, border: `1px solid ${LINE}`, borderRadius: 8 }} />
    </div>
  );
}

/* 座標 → 図の中の位置。fy は「上ほど明るい」なので、そのまま下に伸ばす。
 *
 * ごくわずかにばらつかせている。座標は風味の言葉から作るので同じ値になりやすく、
 * 実測ではノートのある1,601銘柄が839か所に重なっていた（最大18件が同一点）。
 * そのまま描くと18件が1画素に乗り、密なところが密に見えない。
 *
 * ばらつきは豆のIDから決めるので、開き直しても同じ絵になる。幅は±1（軸の1%）に
 * とどめてあり、塊の位置は動かない。 */
const jitter = (id, salt) => (((id * 9301 + salt * 49297) % 233280) / 233280 - 0.5) * 2;
const xy = (p, size) => {
  const s = size - PAD * 2;
  const fx = p.fx + jitter(p.b.id, 1);
  const fy = p.fy + jitter(p.b.id, 7);
  return [PAD + (fx / 100) * s, PAD + (fy / 100) * s];
};

function Table({ byProc, panels }) {
  const med = (a) => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return Math.round(s[Math.floor(s.length / 2)]); };
  const cell = { padding: "6px 8px", fontSize: 11, borderTop: `1px solid ${LINE}`, textAlign: "right", fontFamily: "ui-monospace, monospace" };
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
      <thead>
        <tr>
          <th style={{ ...cell, textAlign: "left", borderTop: "none", color: GRAY, fontWeight: 400 }}>精製方法</th>
          <th style={{ ...cell, borderTop: "none", color: GRAY, fontWeight: 400 }}>銘柄</th>
          <th style={{ ...cell, borderTop: "none", color: GRAY, fontWeight: 400 }}>クリーン↔個性派</th>
          <th style={{ ...cell, borderTop: "none", color: GRAY, fontWeight: 400 }}>明るい↔深い</th>
        </tr>
      </thead>
      <tbody>
        {panels.map((k) => (
          <tr key={k}>
            <td style={{ ...cell, textAlign: "left", fontFamily: "inherit" }}>
              <span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 2, background: DOT[k], marginRight: 6 }} />
              {(PROC[k] || PROC.other).label}
            </td>
            <td style={cell}>{byProc[k].length}</td>
            <td style={cell}>{med(byProc[k].map((p) => p.fx))}</td>
            <td style={cell}>{med(byProc[k].map((p) => p.fy))}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
