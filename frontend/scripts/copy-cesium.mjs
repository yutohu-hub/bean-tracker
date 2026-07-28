// Cesium は実行時に Workers / Assets / Widgets / ThirdParty を配信する必要がある。
// リポジトリを膨らませないよう、ビルドのたびに node_modules から public/cesium へ複製する。
// （public/cesium は .gitignore 済み）
import { cp, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const SRC = path.resolve("node_modules/cesium/Build/Cesium");
const DST = path.resolve("public/cesium");
// Cesium.js 本体ごと配信し、webpack でバンドルしない。
// （Cesium の ESM 再エクスポートは webpack と相性が悪く、バンドルするとビルドが落ちる）
const PARTS = ["Workers", "Assets", "Widgets", "ThirdParty", "Cesium.js"];

if (!existsSync(SRC)) {
  console.log("[cesium] node_modules に Cesium が無いためスキップします");
  process.exit(0);
}

await rm(DST, { recursive: true, force: true });
await mkdir(DST, { recursive: true });
for (const p of PARTS) {
  await cp(path.join(SRC, p), path.join(DST, p), { recursive: true });
}
console.log(`[cesium] ${PARTS.join(", ")} を public/cesium へ複製しました`);
