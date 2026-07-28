"use client";
import { useState, useEffect, useRef } from "react";
import * as THREE from "three";
import { INK, PAPER, GRAY, GREEN, AMBER, LINE } from "../lib/theme";
import { ROASTERS } from "../data/roasters";
import { BEANS } from "../data/beans";
import { shopHref, mapHref } from "../lib/utils";
import { buildEarthTexture } from "../lib/earthTexture";

const R = 1;                 // 地球の半径（シーン内の単位）
const DIST_MIN = 1.35;       // カメラ最接近（都市が見える距離）
const DIST_MAX = 4.2;        // 引き（地球全体）
const DOT = 0xf0603f;        // マーカー
const DOTSEL = 0xffc23d;     // 選択中

// 経緯度 → 球面座標
function toVec(lon, lat, r = R) {
  const p = (90 - lat) * (Math.PI / 180);
  const t = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -r * Math.sin(p) * Math.cos(t),
    r * Math.cos(p),
    r * Math.sin(p) * Math.sin(t),
  );
}

export function GlobeView({ onRoaster }) {
  const wrapRef = useRef(null);
  const apiRef = useRef(null);
  const [selected, setSelected] = useState(null);
  const selRef = useRef(null);
  selRef.current = selected;

  useEffect(() => {
    const wrap = wrapRef.current;
    const size = Math.max(300, Math.min(wrap.clientWidth, 460));

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(size, size);
    wrap.appendChild(renderer.domElement);
    renderer.domElement.style.touchAction = "none";
    renderer.domElement.style.cursor = "grab";
    renderer.domElement.style.borderRadius = "50%";

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 100);
    let dist = 2.9, targetDist = 2.9;

    // 地球本体。テクスチャは手持ちデータから生成し、public/earth.jpg があれば差し替える。
    const globe = new THREE.Group();
    scene.add(globe);
    const mat = new THREE.MeshPhongMaterial({ shininess: 8, specular: 0x223344 });
    mat.map = new THREE.CanvasTexture(buildEarthTexture(2048));
    mat.map.colorSpace = THREE.SRGBColorSpace;
    mat.map.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const earth = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 64), mat);
    globe.add(earth);

    const base = (process.env.NEXT_PUBLIC_BASE_PATH || "") + "/earth.jpg";
    new THREE.TextureLoader().load(base, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      mat.map = tex; mat.needsUpdate = true;
    }, undefined, () => {});   // 無ければ生成テクスチャのまま

    // 大気の光（縁がふわっと光って地球らしく見える）
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(R * 1.035, 64, 48),
      new THREE.ShaderMaterial({
        transparent: true, side: THREE.BackSide, depthWrite: false,
        vertexShader: `varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `varying vec3 vN; void main(){ float i = pow(0.72 - dot(vN, vec3(0,0,1.0)), 2.0); gl_FragColor = vec4(0.42,0.68,1.0,1.0) * i; }`,
      }),
    );
    scene.add(glow);

    scene.add(new THREE.AmbientLight(0xffffff, 1.15));
    const sun = new THREE.DirectionalLight(0xffffff, 1.25);
    sun.position.set(-1.4, 0.8, 1.6);
    scene.add(sun);

    // ロースターのマーカー（球体に貼り付く点。地球の裏側は自然に隠れる）
    const keys = Object.keys(ROASTERS);
    const pos = new Float32Array(keys.length * 3);
    const col = new Float32Array(keys.length * 3);
    const cBase = new THREE.Color(DOT), cSel = new THREE.Color(DOTSEL);
    keys.forEach((k, i) => {
      const [lon, lat] = ROASTERS[k].coord || [0, 0];
      const v = toVec(lon, lat, R * 1.006);
      pos.set([v.x, v.y, v.z], i * 3);
      col.set([cBase.r, cBase.g, cBase.b], i * 3);
    });
    const pg = new THREE.BufferGeometry();
    pg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    pg.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const points = new THREE.Points(pg, new THREE.PointsMaterial({
      size: 0.022, vertexColors: true, sizeAttenuation: true,
    }));
    globe.add(points);

    const paintSelection = (selKey) => {
      const a = pg.getAttribute("color");
      keys.forEach((k, i) => {
        const c = k === selKey ? cSel : cBase;
        a.setXYZ(i, c.r, c.g, c.b);
      });
      a.needsUpdate = true;
    };

    // --- 操作：ドラッグで回転、ホイール/ピンチで寄り引き ---
    let rotY = -Math.PI * 0.72, rotX = -0.32;   // 初期は日本あたり
    let dragging = false, moved = false, last = null, pinch = null;
    const el = renderer.domElement;

    const down = (e) => {
      dragging = true; moved = false; last = [e.clientX, e.clientY];
      el.style.cursor = "grabbing"; el.setPointerCapture?.(e.pointerId);
    };
    const move = (e) => {
      if (!dragging || !last) return;
      const dx = e.clientX - last[0], dy = e.clientY - last[1];
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) moved = true;
      const k = 0.005 * (dist / DIST_MAX);      // 寄るほど動きを穏やかに
      rotY += dx * k; rotX += dy * k;
      rotX = Math.max(-1.35, Math.min(1.35, rotX));
      last = [e.clientX, e.clientY];
    };
    const up = (e) => { dragging = false; last = null; el.style.cursor = "grab"; el.releasePointerCapture?.(e.pointerId); };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);

    const clampD = (d) => Math.max(DIST_MIN, Math.min(DIST_MAX, d));
    const onWheel = (e) => { e.preventDefault(); targetDist = clampD(targetDist * (e.deltaY > 0 ? 1.12 : 1 / 1.12)); };
    el.addEventListener("wheel", onWheel, { passive: false });

    const dist2 = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const tmove = (e) => {
      if (e.touches.length !== 2) return;
      e.preventDefault();
      const d = dist2(e.touches);
      if (pinch) targetDist = clampD(targetDist * (pinch / d));
      pinch = d;
    };
    const tend = (e) => { if (!e.touches || e.touches.length < 2) pinch = null; };
    el.addEventListener("touchmove", tmove, { passive: false });
    el.addEventListener("touchend", tend);
    el.addEventListener("touchcancel", tend);

    // タップでマーカー選択
    const ray = new THREE.Raycaster();
    ray.params.Points.threshold = 0.028;
    el.addEventListener("click", (e) => {
      if (moved) return;
      const r = el.getBoundingClientRect();
      const m = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(m, camera);
      const hits = ray.intersectObject(points, false);
      if (!hits.length) return;
      // 手前（カメラに近い）ものを選ぶ＝裏側の点を拾わない
      const i = hits.sort((a, b) => a.distance - b.distance)[0].index;
      setSelected(keys[i]);
    });

    apiRef.current = {
      zoomIn: () => { targetDist = clampD(targetDist / 1.3); },
      zoomOut: () => { targetDist = clampD(targetDist * 1.3); },
      reset: () => { targetDist = 2.9; rotY = -Math.PI * 0.72; rotX = -0.32; },
      select: paintSelection,
    };

    let raf;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (!dragging && targetDist > DIST_MAX * 0.82) rotY += 0.0007;   // 引いている間はゆっくり自転
      dist += (targetDist - dist) * 0.12;
      globe.rotation.set(rotX, rotY, 0);
      glow.rotation.copy(globe.rotation);
      camera.position.set(0, 0, dist);
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchmove", tmove);
      el.removeEventListener("touchend", tend);
      el.removeEventListener("touchcancel", tend);
      renderer.dispose();
      pg.dispose();
      earth.geometry.dispose();
      mat.dispose();
      if (el.parentNode) el.parentNode.removeChild(el);
    };
  }, []);

  useEffect(() => { apiRef.current?.select(selected); }, [selected]);

  const sel = selected ? ROASTERS[selected] : null;
  const selBeans = selected ? BEANS.filter((b) => b.r === selected) : [];
  const btn = { width: 34, height: 34, borderRadius: 8, border: `1px solid ${INK}`, background: PAPER, color: INK, fontSize: 16, fontWeight: 700, cursor: "pointer", lineHeight: "1", display: "flex", alignItems: "center", justifyContent: "center" };

  return (
    <div>
      <div style={{ fontSize: 11, color: GRAY, marginBottom: 6 }}>
        衛星写真のような3Dの地球。ドラッグで回転、ホイール／ピンチ／＋−で拡大縮小。● をタップでロースター詳細。
      </div>
      <div ref={wrapRef} style={{ position: "relative", display: "flex", justifyContent: "center", touchAction: "none", background: "radial-gradient(circle at 50% 45%, #0b1a2b 0%, #060d16 70%)", borderRadius: 14, padding: "8px 0" }}>
        <div style={{ position: "absolute", right: 6, bottom: 6, display: "flex", flexDirection: "column", gap: 6, zIndex: 2 }}>
          <button aria-label="拡大" style={btn} onClick={() => apiRef.current?.zoomIn()}>＋</button>
          <button aria-label="縮小" style={btn} onClick={() => apiRef.current?.zoomOut()}>−</button>
          <button aria-label="リセット" style={{ ...btn, fontSize: 13 }} onClick={() => apiRef.current?.reset()}>⟲</button>
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
          {sel.url ? (
            <a href={shopHref(sel)} target="_blank" rel="noopener noreferrer"
              style={{ display: "block", textAlign: "center", textDecoration: "none", width: "100%", marginTop: 12, padding: "12px 0", background: INK, color: PAPER, borderRadius: 8, fontSize: 13, fontWeight: 700 }}>
              {sel.name} のECサイトへ ↗
            </a>
          ) : (
            <div style={{ textAlign: "center", marginTop: 12, padding: "12px 0", background: "#EDEAE1", color: GRAY, borderRadius: 8, fontSize: 12, fontWeight: 700 }}>ECサイト準備中</div>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button onClick={() => onRoaster(selected)}
              style={{ flex: 1, padding: "10px 0", background: "none", color: INK, border: `1px solid ${INK}`, borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              豆を見る →
            </button>
            <a href={mapHref(sel)} target="_blank" rel="noopener noreferrer"
              style={{ flex: 1, textAlign: "center", textDecoration: "none", padding: "10px 0", background: "none", color: INK, border: `1px solid ${LINE}`, borderRadius: 8, fontSize: 12, fontWeight: 700 }}>
              🗺 Google Map ↗
            </a>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: "center", fontSize: 11, color: GRAY, marginTop: 12 }}>
          ● をタップするとロースターの詳細が出ます
        </div>
      )}
    </div>
  );
}
