"use client";
import { useState, useEffect, useRef } from "react";
import * as d3 from "d3";
import { INK, PAPER, GRAY, GREEN, AMBER } from "../lib/theme";
import { ROASTERS } from "../data/roasters";
import { BEANS } from "../data/beans";

export function GlobeView({ onRoaster }) {
  const svgRef = useRef(null);
  const wrapRef = useRef(null);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const size = Math.min(wrap.clientWidth, 380);
    const svg = d3.select(svgRef.current).attr("width", size).attr("height", size);
    svg.selectAll("*").remove();

    const projection = d3.geoOrthographic()
      .translate([size / 2, size / 2])
      .scale(size / 2 - 10)
      .clipAngle(90)
      .rotate([-139, -32]); // 日本から始まる
    const path = d3.geoPath(projection);

    // 球体
    svg.append("circle")
      .attr("cx", size / 2).attr("cy", size / 2).attr("r", size / 2 - 10)
      .attr("fill", "#F2F0E9").attr("stroke", INK).attr("stroke-width", 1.4);

    // 経緯線
    const gratPath = svg.append("path")
      .datum(d3.geoGraticule10())
      .attr("fill", "none").attr("stroke", "#CFCBBE").attr("stroke-width", 0.5);

    // 赤道だけ少し濃く
    const equator = svg.append("path")
      .datum({ type: "LineString", coordinates: d3.range(-180, 181, 2).map((l) => [l, 0]) })
      .attr("fill", "none").attr("stroke", "#B5B0A0").attr("stroke-width", 0.8);

    // ロースターのマーカー
    const markers = svg.append("g");
    const entries = Object.entries(ROASTERS);

    function render() {
      gratPath.attr("d", path);
      equator.attr("d", path);
      markers.selectAll("*").remove();
      const center = projection.invert([size / 2, size / 2]);
      entries.forEach(([rid, r]) => {
        if (d3.geoDistance(r.coord, center) > Math.PI / 2 - 0.05) return; // 裏側は描かない
        const [x, y] = projection(r.coord);
        const g = markers.append("g").style("cursor", "pointer")
          .on("click", () => setSelected(rid));
        g.append("circle").attr("cx", x).attr("cy", y).attr("r", 10).attr("fill", "transparent"); // タップ領域
        g.append("circle").attr("cx", x).attr("cy", y).attr("r", 4).attr("fill", GREEN).attr("stroke", PAPER).attr("stroke-width", 1.5);
        g.append("text").attr("x", x + 8).attr("y", y + 3)
          .attr("font-size", 10).attr("font-weight", 700).attr("fill", INK)
          .attr("font-family", "ui-monospace, monospace")
          .text(r.name);
      });
    }
    render();

    // ドラッグで回転 / 触っていない間はゆっくり自転
    let dragging = false;
    let last = null;
    const drag = d3.drag()
      .on("start", (e) => { dragging = true; last = [e.x, e.y]; })
      .on("drag", (e) => {
        const [lx, ly] = last;
        const rot = projection.rotate();
        projection.rotate([rot[0] + (e.x - lx) * 0.4, Math.max(-80, Math.min(80, rot[1] - (e.y - ly) * 0.4))]);
        last = [e.x, e.y];
        render();
      })
      .on("end", () => { dragging = false; });
    svg.call(drag);

    const timer = d3.timer(() => {
      if (dragging) return;
      const rot = projection.rotate();
      projection.rotate([rot[0] + 0.06, rot[1]]);
      render();
    });
    return () => timer.stop();
  }, []);

  const sel = selected ? ROASTERS[selected] : null;
  const selBeans = selected ? BEANS.filter((b) => b.r === selected) : [];

  return (
    <div>
      <div style={{ fontSize: 11, color: GRAY, marginBottom: 6 }}>
        地球を回してロースターを探す。実装では Mapbox の地球儀ビューを想定した試作です。
      </div>
      <div ref={wrapRef} style={{ display: "flex", justifyContent: "center", touchAction: "none" }}>
        <svg ref={svgRef} />
      </div>
      {/* 選択中のロースター */}
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
