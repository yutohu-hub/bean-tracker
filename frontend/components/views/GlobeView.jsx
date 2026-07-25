"use client";
import { useState, useEffect, useRef } from "react";
import * as d3 from "d3";
import { feature, mesh } from "topojson-client";
import worldTopo from "world-atlas/countries-110m.json";
import { INK, PAPER, GRAY, GREEN, AMBER } from "../lib/theme";
import { ROASTERS } from "../data/roasters";
import { BEANS } from "../data/beans";

// 世界地図（大陸・国境）は起動時に一度だけ生成
const LAND = feature(worldTopo, worldTopo.objects.land);
const BORDERS = mesh(worldTopo, worldTopo.objects.countries, (a, b) => a !== b);
const SPHERE = { type: "Sphere" };

// 配色（紙×インクの世界観に馴染む地球）
const OCEAN = "#D9E4E3";
const LANDF = "#CDBE9C";
const BORDER = "#AB9C7C";
const GRAT = "#B9C4C3";

const ZOOM_MIN = 1;
const ZOOM_MAX = 6;

export function GlobeView({ onRoaster }) {
  const svgRef = useRef(null);
  const wrapRef = useRef(null);
  const zoomApiRef = useRef(null);
  const renderRef = useRef(null);
  const [selected, setSelected] = useState(null);
  const selectedRef = useRef(null);
  selectedRef.current = selected;

  useEffect(() => {
    const wrap = wrapRef.current;
    const size = Math.max(300, Math.min(wrap.clientWidth, 420));
    const cx = size / 2, cy = size / 2;
    const baseScale = size / 2 - 8;
    let zoom = 1;

    const svg = d3.select(svgRef.current).attr("width", size).attr("height", size);
    svg.selectAll("*").remove();
    svg.style("cursor", "grab");

    // 球体の陰影グラデーション
    const defs = svg.append("defs");
    const grad = defs.append("radialGradient").attr("id", "bt-globe-shade").attr("cx", "35%").attr("cy", "30%").attr("r", "75%");
    grad.append("stop").attr("offset", "0%").attr("stop-color", "#ffffff").attr("stop-opacity", 0.4);
    grad.append("stop").attr("offset", "55%").attr("stop-color", "#ffffff").attr("stop-opacity", 0);
    grad.append("stop").attr("offset", "100%").attr("stop-color", "#000000").attr("stop-opacity", 0.16);

    const projection = d3.geoOrthographic()
      .translate([cx, cy])
      .clipAngle(90)
      .rotate([-139, -32]); // 日本あたりから
    const path = d3.geoPath(projection);

    // 海（球）
    const ocean = svg.append("path").datum(SPHERE).attr("fill", OCEAN).attr("stroke", INK).attr("stroke-width", 1.4);
    // 経緯線
    const grat = svg.append("path").datum(d3.geoGraticule10()).attr("fill", "none").attr("stroke", GRAT).attr("stroke-width", 0.5);
    // 大陸
    const land = svg.append("path").datum(LAND).attr("fill", LANDF).attr("stroke", "none");
    // 国境
    const borders = svg.append("path").datum(BORDERS).attr("fill", "none").attr("stroke", BORDER).attr("stroke-width", 0.4);
    // 赤道を少し濃く
    const equator = svg.append("path")
      .datum({ type: "LineString", coordinates: d3.range(-180, 181, 2).map((l) => [l, 0]) })
      .attr("fill", "none").attr("stroke", "#9FB0AE").attr("stroke-width", 0.7);
    // 陰影
    const shade = svg.append("path").datum(SPHERE).attr("fill", "url(#bt-globe-shade)").attr("pointer-events", "none");

    // ロースターのマーカー（データ結合で1回だけ生成→毎フレーム位置更新）
    const entries = Object.entries(ROASTERS);
    const markers = svg.append("g");
    const mk = markers.selectAll("g").data(entries, (d) => d[0]).enter().append("g")
      .style("cursor", "pointer")
      .on("click", (e, d) => { e.stopPropagation(); setSelected(d[0]); });
    mk.append("circle").attr("class", "hit").attr("r", 9).attr("fill", "transparent"); // タップ領域
    mk.append("circle").attr("class", "dot").attr("r", 3.2).attr("stroke", PAPER).attr("stroke-width", 1.2);
    const label = svg.append("text").attr("font-size", 10.5).attr("font-weight", 700)
      .attr("fill", INK).attr("font-family", "ui-monospace, monospace").attr("pointer-events", "none");

    function render() {
      projection.scale(baseScale * zoom);
      ocean.attr("d", path);
      grat.attr("d", path);
      land.attr("d", path);
      borders.attr("d", path);
      equator.attr("d", path);
      shade.attr("d", path);

      const center = projection.invert([cx, cy]);
      const sel = selectedRef.current;
      mk.attr("display", (d) => (d3.geoDistance(d[1].coord, center) > Math.PI / 2 - 0.02 ? "none" : null))
        .attr("transform", (d) => { const p = projection(d[1].coord); return p ? `translate(${p[0]},${p[1]})` : null; });
      mk.select(".dot")
        .attr("r", (d) => (d[0] === sel ? 5 : 3.2))
        .attr("fill", (d) => (d[0] === sel ? AMBER : GREEN));

      // 選択中のロースター名だけラベル表示
      if (sel && ROASTERS[sel] && d3.geoDistance(ROASTERS[sel].coord, center) <= Math.PI / 2 - 0.02) {
        const p = projection(ROASTERS[sel].coord);
        label.attr("display", null).attr("x", p[0] + 8).attr("y", p[1] + 3).text(ROASTERS[sel].name);
      } else {
        label.attr("display", "none");
      }
    }
    renderRef.current = render;
    render();

    // --- 回転（ドラッグ）---
    let dragging = false, last = null;
    const drag = d3.drag()
      .on("start", (e) => { dragging = true; last = [e.x, e.y]; svg.style("cursor", "grabbing"); })
      .on("drag", (e) => {
        const k = 0.36 / zoom; // ズーム時は回転を穏やかに
        const rot = projection.rotate();
        projection.rotate([rot[0] + (e.x - last[0]) * k, Math.max(-88, Math.min(88, rot[1] - (e.y - last[1]) * k))]);
        last = [e.x, e.y];
        render();
      })
      .on("end", () => { dragging = false; svg.style("cursor", "grab"); });
    svg.call(drag);

    // --- ズーム（ホイール / ピンチ / ボタン）---
    function applyZoom(factor) {
      zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom * factor));
      render();
    }
    function resetView() { zoom = 1; projection.rotate([-139, -32]); render(); }
    zoomApiRef.current = { zoomIn: () => applyZoom(1.3), zoomOut: () => applyZoom(1 / 1.3), reset: resetView };

    const svgNode = svgRef.current;
    const onWheel = (e) => { e.preventDefault(); applyZoom(e.deltaY < 0 ? 1.12 : 1 / 1.12); };
    svgNode.addEventListener("wheel", onWheel, { passive: false });

    // ピンチ
    let pinchDist = null;
    const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const onTouchMove = (e) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const d = dist(e.touches);
        if (pinchDist != null && pinchDist > 0) applyZoom(d / pinchDist);
        pinchDist = d;
      }
    };
    const onTouchEnd = () => { pinchDist = null; };
    svgNode.addEventListener("touchmove", onTouchMove, { passive: false });
    svgNode.addEventListener("touchend", onTouchEnd);

    // --- 触っていない間はゆっくり自転（ズーム中/操作中は止める）---
    const timer = d3.timer(() => {
      if (dragging || zoom > 1.08) return;
      const rot = projection.rotate();
      projection.rotate([rot[0] + 0.06, rot[1]]);
      render();
    });

    return () => {
      timer.stop();
      svgNode.removeEventListener("wheel", onWheel);
      svgNode.removeEventListener("touchmove", onTouchMove);
      svgNode.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  // 選択が変わったら地球の描画も更新（自転停止中でもハイライト反映）
  useEffect(() => { renderRef.current?.(); }, [selected]);

  const sel = selected ? ROASTERS[selected] : null;
  const selBeans = selected ? BEANS.filter((b) => b.r === selected) : [];
  const btn = { width: 34, height: 34, borderRadius: 8, border: `1px solid ${INK}`, background: PAPER, color: INK, fontSize: 16, fontWeight: 700, cursor: "pointer", lineHeight: "1", display: "flex", alignItems: "center", justifyContent: "center" };

  return (
    <div>
      <div style={{ fontSize: 11, color: GRAY, marginBottom: 6 }}>
        本物の地球を回して探す。ドラッグで回転、ホイール／ピンチ／＋−で拡大縮小。● をタップでロースター詳細。
      </div>
      <div ref={wrapRef} style={{ position: "relative", display: "flex", justifyContent: "center", touchAction: "none" }}>
        <svg ref={svgRef} style={{ overflow: "hidden", touchAction: "none" }} />
        {/* ズーム操作 */}
        <div style={{ position: "absolute", right: 6, bottom: 6, display: "flex", flexDirection: "column", gap: 6 }}>
          <button aria-label="拡大" style={btn} onClick={() => zoomApiRef.current?.zoomIn()}>＋</button>
          <button aria-label="縮小" style={btn} onClick={() => zoomApiRef.current?.zoomOut()}>−</button>
          <button aria-label="リセット" style={{ ...btn, fontSize: 13 }} onClick={() => zoomApiRef.current?.reset()}>⟲</button>
        </div>
      </div>
      {sel ? (
        <div style={{ borderTop: `2px solid ${INK}`, marginTop: 14, paddingTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{sel.name}</div>
            <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, color: GRAY }}>{sel.country} / {sel.platform}</span>
          </div>
          <div style={{ fontSize: 11.5, color: GRAY, marginTop: 2 }}>{sel.city} — {sel.note}</div>
          <div style={{ display: "flex", gap: 14, marginTop: 6, fontSize: 10.5, color: GRAY }}>
            <span>創業 {sel.founded}</span><span>{sel.style}</span><span>{sel.ship}</span>
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 8, fontFamily: "ui-monospace, monospace", fontSize: 10.5 }}>
            <span style={{ color: GREEN }}>NOW {selBeans.filter((b) => b.status === "now").length}</span>
            <span style={{ color: AMBER }}>SOLD OUT {selBeans.filter((b) => b.status === "sold").length}</span>
            <span style={{ color: GRAY }}>ARCHIVE {selBeans.filter((b) => b.status === "archive").length}</span>
          </div>
          <button onClick={() => onRoaster(selected)}
            style={{ width: "100%", marginTop: 12, padding: "11px 0", background: INK, color: PAPER, border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            このロースターの豆を見る →
          </button>
        </div>
      ) : (
        <div style={{ textAlign: "center", fontSize: 11, color: GRAY, marginTop: 12 }}>
          ● をタップするとロースターの詳細が出ます
        </div>
      )}
    </div>
  );
}
