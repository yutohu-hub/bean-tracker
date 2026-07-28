"use client";
import { useState, useEffect, useRef } from "react";
import { INK, PAPER, GRAY, GREEN, AMBER, LINE } from "../lib/theme";
import { ROASTERS } from "../data/roasters";
import { BEANS } from "../data/beans";
import { shopHref, mapHref } from "../lib/utils";

// Cesium は実行時に自前のアセットを読むため、ベースURLを先に教える必要がある。
const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";
if (typeof window !== "undefined") window.CESIUM_BASE_URL = `${BASE}/cesium/`;

const DOT = "#F0603F";
const DOTSEL = "#FFC23D";

// Cesium は public/cesium から素のスクリプトとして読み込む（webpack でバンドルしない）。
let cesiumPromise = null;
function loadCesium() {
  if (window.Cesium) return Promise.resolve(window.Cesium);
  if (cesiumPromise) return cesiumPromise;
  cesiumPromise = new Promise((resolve, reject) => {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = `${BASE}/cesium/Widgets/widgets.css`;
    document.head.appendChild(css);
    const s = document.createElement("script");
    s.src = `${BASE}/cesium/Cesium.js`;
    s.async = true;
    s.onload = () => (window.Cesium ? resolve(window.Cesium) : reject(new Error("Cesium not found")));
    s.onerror = () => reject(new Error("failed to load Cesium"));
    document.head.appendChild(s);
  });
  return cesiumPromise;
}

export function GlobeView({ onRoaster }) {
  const wrapRef = useRef(null);
  const viewerRef = useRef(null);
  const apiRef = useRef(null);
  const paintedRef = useRef(null);   // 直前に強調表示したロースター
  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState("loading");   // loading | ready | error

  useEffect(() => {
    let viewer, disposed = false;

    (async () => {
      try {
        const Cesium = await loadCesium();
        if (disposed) return;

        // Cesium ion のトークンがあれば地形（起伏）まで表示する。無くても衛星写真は出る。
        const ionToken = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN;
        if (ionToken) Cesium.Ion.defaultAccessToken = ionToken;

        viewer = new Cesium.Viewer(wrapRef.current, {
          // 余計なUIは全て隠し、図鑑の見た目に寄せる
          baseLayerPicker: false, geocoder: false, homeButton: false,
          sceneModePicker: false, navigationHelpButton: false, animation: false,
          timeline: false, fullscreenButton: false, infoBox: false,
          selectionIndicator: false, creditContainer: document.createElement("div"),
          // 衛星写真：ion トークン不要の Esri World Imagery を使う
          baseLayer: Cesium.ImageryLayer.fromProviderAsync(
            Cesium.ArcGisMapServerImageryProvider.fromUrl(
              "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer",
            ),
          ),
        });
        viewerRef.current = viewer;

        // 地形（起伏）は ion トークンがあるときだけ
        if (ionToken) {
          try { viewer.terrainProvider = await Cesium.createWorldTerrainAsync(); } catch {}
        }

        const s = viewer.scene;
        // 影・照明は負荷が高いうえ、夜側のマーカーが見えなくなるので使わない
        s.globe.enableLighting = false;
        s.globe.showGroundAtmosphere = true;
        s.skyAtmosphere.show = true;
        s.fog.enabled = false;
        s.shadows = false;
        s.backgroundColor = Cesium.Color.fromCssColorString("#060d16");
        s.postProcessStages.fxaa.enabled = true;

        const cc = s.screenSpaceCameraController;
        cc.minimumZoomDistance = 800;        // 都市レベルまで
        cc.maximumZoomDistance = 3.2e7;
        cc.enableCollisionDetection = true;
        // 指を離したあとに滑らせる（慣性）。既定より強めにして動きを滑らかに見せる
        cc.inertiaSpin = 0.85;
        cc.inertiaTranslate = 0.85;
        cc.inertiaZoom = 0.75;

        // マーカーは Entity ではなく PointPrimitive で描く。
        // Entity + CLAMP_TO_GROUND は627件ぶんの地形高さ問い合わせが毎フレーム走って重いため。
        const pts = s.primitives.add(new Cesium.PointPrimitiveCollection());
        const cBase = Cesium.Color.fromCssColorString(DOT);
        const cSel = Cesium.Color.fromCssColorString(DOTSEL);
        const byKey = new Map();
        for (const [key, r] of Object.entries(ROASTERS)) {
          const [lon, lat] = r.coord || [0, 0];
          const p = pts.add({
            id: key,
            position: Cesium.Cartesian3.fromDegrees(lon, lat, 0),
            pixelSize: 7,
            color: cBase,
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 1.2,
            scaleByDistance: new Cesium.NearFarScalar(1.0e5, 1.6, 1.5e7, 0.7),
            // 地球の裏側の点は隠れる（深度テストを有効に保つ）
            disableDepthTestDistance: 0,
          });
          byKey.set(key, p);
        }

        // タップで選択
        const handler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);
        handler.setInputAction((click) => {
          const picked = viewer.scene.pick(click.position);
          const id = picked && (typeof picked.id === "string" ? picked.id : picked.id && picked.id.id);
          if (id && ROASTERS[id]) setSelected(id);
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        // 日本あたりから開始
        viewer.camera.setView({
          destination: Cesium.Cartesian3.fromDegrees(139.7, 35.0, 1.6e7),
        });

        apiRef.current = {
          zoomIn: () => viewer.camera.zoomIn(viewer.camera.positionCartographic.height * 0.35),
          zoomOut: () => viewer.camera.zoomOut(viewer.camera.positionCartographic.height * 0.5),
          // ボタンでも一気に飛ばず、滑らかに移動する
          reset: () => viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(139.7, 35.0, 1.6e7), duration: 1.0,
          }),
          focus: (key) => {
            const r = ROASTERS[key]; if (!r || !r.coord) return;
            viewer.camera.flyTo({
              destination: Cesium.Cartesian3.fromDegrees(r.coord[0], r.coord[1], 6.0e5),
              duration: 1.2,
            });
          },
          // 前回選択と今回だけを書き換える（627件を毎回舐めない）
          paint: (selKey) => {
            const prev = paintedRef.current;
            if (prev && byKey.has(prev)) {
              const p = byKey.get(prev);
              p.color = cBase; p.pixelSize = 7;
            }
            if (selKey && byKey.has(selKey)) {
              const p = byKey.get(selKey);
              p.color = cSel; p.pixelSize = 13;
            }
            paintedRef.current = selKey || null;
            s.requestRender();
          },
          handler,
        };
        setStatus("ready");
      } catch (e) {
        console.error(e);
        if (!disposed) setStatus("error");
      }
    })();

    return () => {
      disposed = true;
      try { apiRef.current?.handler?.destroy(); } catch {}
      try { viewer && !viewer.isDestroyed() && viewer.destroy(); } catch {}
      viewerRef.current = null;
    };
  }, []);

  useEffect(() => { apiRef.current?.paint(selected); }, [selected]);

  const sel = selected ? ROASTERS[selected] : null;
  const selBeans = selected ? BEANS.filter((b) => b.r === selected) : [];
  const btn = { width: 34, height: 34, borderRadius: 8, border: `1px solid ${INK}`, background: PAPER, color: INK, fontSize: 16, fontWeight: 700, cursor: "pointer", lineHeight: "1", display: "flex", alignItems: "center", justifyContent: "center" };

  return (
    <div>
      <div style={{ fontSize: 11, color: GRAY, marginBottom: 6 }}>
        衛星写真の地球。ドラッグで回転、ホイール／ピンチ／＋−で拡大縮小。● をタップでロースター詳細。
      </div>

      <div style={{ position: "relative", borderRadius: 14, overflow: "hidden", background: "#060d16" }}>
        <div ref={wrapRef} style={{ width: "100%", height: 420 }} />

        {status !== "ready" && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#B8AE9E", fontSize: 12, textAlign: "center", padding: 20 }}>
            {status === "loading" ? "地球を読み込み中…" : "地球を表示できませんでした（通信環境をご確認ください）"}
          </div>
        )}

        {status === "ready" && (
          <div style={{ position: "absolute", right: 8, bottom: 8, display: "flex", flexDirection: "column", gap: 6, zIndex: 2 }}>
            <button aria-label="拡大" style={btn} onClick={() => apiRef.current?.zoomIn()}>＋</button>
            <button aria-label="縮小" style={btn} onClick={() => apiRef.current?.zoomOut()}>−</button>
            <button aria-label="リセット" style={{ ...btn, fontSize: 13 }} onClick={() => apiRef.current?.reset()}>⟲</button>
          </div>
        )}

        <div style={{ position: "absolute", left: 8, bottom: 8, fontSize: 9, color: "rgba(255,255,255,0.55)", zIndex: 2 }}>
          Imagery © Esri, Maxar, Earthstar Geographics
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
          <button onClick={() => apiRef.current?.focus(selected)}
            style={{ width: "100%", marginTop: 10, padding: "9px 0", background: "none", color: INK, border: `1px dashed ${LINE}`, borderRadius: 8, fontSize: 12, cursor: "pointer" }}>
            🌍 この街まで寄る
          </button>
          {sel.url ? (
            <a href={shopHref(sel)} target="_blank" rel="noopener noreferrer"
              style={{ display: "block", textAlign: "center", textDecoration: "none", width: "100%", marginTop: 8, padding: "12px 0", background: INK, color: PAPER, borderRadius: 8, fontSize: 13, fontWeight: 700 }}>
              {sel.name} のECサイトへ ↗
            </a>
          ) : (
            <div style={{ textAlign: "center", marginTop: 8, padding: "12px 0", background: "#EDEAE1", color: GRAY, borderRadius: 8, fontSize: 12, fontWeight: 700 }}>ECサイト準備中</div>
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
