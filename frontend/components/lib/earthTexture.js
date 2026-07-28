// 地球儀に貼る正距円筒図法のテクスチャを、手持ちの地理データから生成する。
// 外部の衛星画像に依存しないため、オフラインでも必ず表示できる。
// public/earth.jpg を置けばそちらを優先して使う（本物の衛星画像に差し替え可能）。
import * as d3 from "d3";
import { feature, mesh } from "topojson-client";
import worldTopo from "world-atlas/countries-110m.json";

const LAND = feature(worldTopo, worldTopo.objects.land);
const BORDERS = mesh(worldTopo, worldTopo.objects.countries, (a, b) => a !== b);

// 緯度で植生が変わる様子を近似する（赤道=緑、中緯度=乾いた土、極=雪）。
function landColor(lat) {
  const a = Math.abs(lat);
  if (a > 72) return [236, 240, 245];        // 氷雪
  if (a > 60) return [150, 158, 140];        // ツンドラ
  if (a > 45) return [104, 124, 86];         // 針葉樹
  if (a > 33) return [126, 134, 78];         // 温帯
  if (a > 23) return [163, 143, 92];         // 乾燥帯
  return [86, 118, 66];                      // 熱帯
}

export function buildEarthTexture(w = 2048) {
  const h = w / 2;
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d");

  // 海：深度がついて見えるよう緯度方向にわずかに色を変える
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#0f3d5c");
  g.addColorStop(0.5, "#0d5c86");
  g.addColorStop(1, "#0f3d5c");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  const projection = d3.geoEquirectangular()
    .scale(w / (2 * Math.PI))
    .translate([w / 2, h / 2]);
  const path = d3.geoPath(projection, ctx);

  // 陸を緯度帯ごとに塗り分ける（帯単位でクリップして塗る）
  const bands = 36;
  for (let i = 0; i < bands; i++) {
    const lat0 = 90 - (180 * i) / bands;
    const lat1 = 90 - (180 * (i + 1)) / bands;
    const [r, gg, b] = landColor((lat0 + lat1) / 2);
    const y0 = projection([0, lat0])[1];
    const y1 = projection([0, lat1])[1];
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, y0, w, y1 - y0 + 1);
    ctx.clip();
    ctx.beginPath();
    path(LAND);
    ctx.fillStyle = `rgb(${r},${gg},${b})`;
    ctx.fill();
    ctx.restore();
  }

  // 地表の粒状感（のっぺり見えないように軽くノイズを重ねる）
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 14;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);

  // 国境をうっすら
  ctx.beginPath();
  path(BORDERS);
  ctx.strokeStyle = "rgba(255,255,255,0.16)";
  ctx.lineWidth = 0.7;
  ctx.stroke();

  return c;
}
