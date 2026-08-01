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

// 寄れる上限（カメラ高度・m）。
// 628軒の最近傍距離は中央値2.2km・下位5%でも610m。上空15kmなら高さ420pxの画面で
// 610m ≒ 14px となり、7pxの●同士が重ならない。ここより深いタイルは読みに行かせない。
const MIN_ALT = 15000;

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

/* 衛星写真の取得。ここは他社のタイル配信に依存しているので、落ちる前提で書く。
   以前は fromProviderAsync に promise を渡しっぱなしで、拒否されても誰も受け取らず、
   コンソールに素の例外が出たまま地球が真っ黒（点だけ浮かぶ）になっていた。
   1枚目が駄目なら別ホストへ、それも駄目なら画像なしで地球の色だけ塗る。 */
async function buildBaseLayer(Cesium) {
  const sources = [
    ["Esri World Imagery", () => Cesium.ArcGisMapServerImageryProvider.fromUrl(
      "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer")],
    ["OpenStreetMap", async () => new Cesium.OpenStreetMapImageryProvider({
      url: "https://tile.openstreetmap.org/" })],
  ];
  for (const [name, make] of sources) {
    try {
      const provider = await make();
      return { layer: new Cesium.ImageryLayer(provider), provider, source: name };
    } catch (e) {
      console.warn(`[globe] ${name} の地図タイルを読み込めませんでした`, e);
    }
  }
  return { layer: false, provider: null, source: null };   // baseLayer:false = 画像なし
}

// タイルが実際に落ちてくるかは、プロバイダを作れたかどうかとは別の話。
// OpenStreetMap のプロバイダは配信が死んでいても問題なく生成できるので、
// 「作れた＝写真が出る」ではない。実際のタイル取得の失敗を数えて判断する。
const TILE_ERRORS_BEFORE_GIVING_UP = 3;

export function GlobeView({ onRoaster }) {
  const wrapRef = useRef(null);
  const viewerRef = useRef(null);
  const apiRef = useRef(null);
  const paintedRef = useRef(null);   // 直前に強調表示したロースター
  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState("loading");   // loading | ready | error
  const [noImagery, setNoImagery] = useState(false);  // 衛星写真だけ落ちた場合
  const sourceRef = useRef(null);                     // 実際に使えた地図タイルの出所

  useEffect(() => {
    let viewer, disposed = false;

    (async () => {
      try {
        const Cesium = await loadCesium();
        if (disposed) return;

        // Cesium ion のトークンがあれば地形（起伏）まで表示する。無くても衛星写真は出る。
        const ionToken = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN;
        if (ionToken) Cesium.Ion.defaultAccessToken = ionToken;

        const base = await buildBaseLayer(Cesium);
        if (disposed) return;
        if (!base.layer) setNoImagery(true);
        sourceRef.current = base.source;
        if (base.layer && base.provider?.errorEvent) {
          let fails = 0;
          base.provider.errorEvent.addEventListener(() => {
            if (++fails >= TILE_ERRORS_BEFORE_GIVING_UP && !disposed) setNoImagery(true);
          });
        }

        viewer = new Cesium.Viewer(wrapRef.current, {
          // 余計なUIは全て隠し、図鑑の見た目に寄せる
          baseLayerPicker: false, geocoder: false, homeButton: false,
          sceneModePicker: false, navigationHelpButton: false, animation: false,
          timeline: false, fullscreenButton: false, infoBox: false,
          selectionIndicator: false, creditContainer: document.createElement("div"),
          // 3Dだけ使う（2D/コロンバスビューの資源を確保しない）
          scene3DOnly: true,
          // 画面に変化があったときだけ描画する。止まっている間はGPUを回さない
          requestRenderMode: true,
          maximumRenderTimeChange: Infinity,
          // MSAAは切ってFXAAで済ませる（下で msaaSamples = 1）
          contextOptions: { webgl: { antialias: false, powerPreference: "high-performance" } },
          // 衛星写真（ion トークン不要）。取れなければ false = 画像なしで続行する
          baseLayer: base.layer,
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
        // 写真が出ないときに点だけ宇宙に浮いて見えないよう、下地に海の色を敷いておく。
        // 既定の明るい青より落ち着いた色にして、写真が出たときも縁で悪目立ちしない。
        s.globe.baseColor = Cesium.Color.fromCssColorString("#16324a");
        s.postProcessStages.fxaa.enabled = true;
        // マルチサンプルは1画素あたりのコストが数倍になる。FXAAで代替する
        s.msaaSamples = 1;
        // タイルの解像度をわずかに落とす（既定2）。読み込む枚数が減り、回転が引っかからない
        s.globe.maximumScreenSpaceError = 3;
        // 一度読んだタイルを多めに保持し、戻ってきたときに再取得しない（既定100）
        s.globe.tileCacheSize = 250;
        s.globe.showSkirts = false;

        const cc = s.screenSpaceCameraController;
        // 寄れる上限は上空15km。●が重なりはじめる手前で、街全体が入る縮尺。
        // ここで止めることで最深部の衛星タイル読み込みが発生しなくなる。
        cc.minimumZoomDistance = MIN_ALT;
        cc.maximumZoomDistance = 3.2e7;
        // 15kmまでしか降りないので地形との衝突は起こりえない。毎フレームの判定を省く
        cc.enableCollisionDetection = false;
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

        // ＋−ボタンも一段ずつ跳ばず、イージングをかけて寄る／引く
        let zoomRaf = null;
        const smoothZoom = (factor) => {
          const start = viewer.camera.positionCartographic.height;
          const target = Math.min(Math.max(start * factor, MIN_ALT * 1.02), cc.maximumZoomDistance * 0.98);
          if (Math.abs(target - start) < 1) return;
          if (zoomRaf) cancelAnimationFrame(zoomRaf);
          const t0 = performance.now(), dur = 420;
          const step = (t) => {
            const k = Math.min(1, (t - t0) / dur);
            const want = start + (target - start) * (1 - Math.pow(1 - k, 3));   // easeOutCubic
            const d = viewer.camera.positionCartographic.height - want;
            if (d > 0) viewer.camera.zoomIn(d); else if (d < 0) viewer.camera.zoomOut(-d);
            zoomRaf = k < 1 ? requestAnimationFrame(step) : null;
          };
          zoomRaf = requestAnimationFrame(step);
        };

        apiRef.current = {
          zoomIn: () => smoothZoom(0.55),
          zoomOut: () => smoothZoom(1 / 0.55),
          cancelZoom: () => { if (zoomRaf) cancelAnimationFrame(zoomRaf); zoomRaf = null; },
          // ボタンでも一気に飛ばず、滑らかに移動する
          reset: () => viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(139.7, 35.0, 1.6e7), duration: 1.0,
          }),
          focus: (key) => {
            const r = ROASTERS[key]; if (!r || !r.coord) return;
            // 「この街まで寄る」＝寄れる上限のすこし手前。街全体が入る高さで止める
            viewer.camera.flyTo({
              destination: Cesium.Cartesian3.fromDegrees(r.coord[0], r.coord[1], MIN_ALT * 4),
              duration: 1.4,
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
      try { apiRef.current?.cancelZoom?.(); } catch {}
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
        拡大は ● が重ならない縮尺（街全体が入る高さ）までです。
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

        {/* 衛星写真だけ落ちたとき。真っ暗な球に点だけ浮いていると壊れて見えるので、
            位置は正しく出ていることと、原因が地図タイル側であることを書く。 */}
        {noImagery && status === "ready" && (
          <div style={{ position: "absolute", left: 8, right: 8, top: 8, zIndex: 3,
            background: "rgba(6,13,22,0.82)", color: "rgba(255,255,255,0.9)",
            fontSize: 10.5, lineHeight: 1.7, padding: "7px 10px", borderRadius: 6 }}>
            衛星写真を読み込めませんでした。ロースターの位置は正しく表示されています。
          </div>
        )}

        <div style={{ position: "absolute", left: 8, bottom: 8, fontSize: 9, color: "rgba(255,255,255,0.55)", zIndex: 2 }}>
          {noImagery ? "Roaster locations © BEAN TRACKER"
            : sourceRef.current === "OpenStreetMap" ? "Imagery © OpenStreetMap contributors"
              : "Imagery © Esri, Maxar, Earthstar Geographics"}
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
