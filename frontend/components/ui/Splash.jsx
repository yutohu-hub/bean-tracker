"use client";
import { FS, INK, PAPER, GRAY } from "../lib/theme";

export function Splash({ done }) {
  return (
    <div className={done ? "bt-splash bt-splash-out" : "bt-splash"}
      style={{
        position: "fixed", inset: 0, zIndex: 100, background: PAPER,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        pointerEvents: done ? "none" : "auto",
      }}>
      <div className="bt-mark" style={{ fontWeight: 800, fontSize: FS.title, letterSpacing: "0.35em", color: INK, paddingLeft: "0.35em" }}>
        BEAN&nbsp;TRACKER
      </div>
      <div className="bt-line" style={{ height: 2, background: INK, marginTop: 14 }} />
      <div className="bt-tag" style={{ fontSize: FS.meta, color: GRAY, marginTop: 12, letterSpacing: "0.1em" }}>
        Find any bean, anywhere.
      </div>
    </div>
  );
}

/* ---------- 好み診断 ---------- */
