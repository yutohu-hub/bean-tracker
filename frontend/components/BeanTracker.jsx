"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import * as d3 from "d3";

/* ============================================================
   BEAN TRACKER — プロトタイプ v0.1
   グリッド図鑑 / ロースターページ(NOW・SOLD OUT・ARCHIVE)
   実データの代わりにサンプルデータで手触りを確認するための試作
   ============================================================ */

const INK = "#17150F";
const PAPER = "#FAFAF7";
const GRAY = "#8A857B";
const LINE = "#E4E1D8";
const GREEN = "#2F5233";
const AMBER = "#A87B2E";

const ROASTERS = {
  bibi: { name: "bibi", city: "東京 / 亀戸", country: "JP", platform: "STORES", note: "下町のファントムロースター", coord: [139.83, 35.7],
    founded: "2024", style: "浅〜中煎り・少量焙煎", ship: "国内発送(2〜3日)", focus: "エチオピア・中南米",
    bio: "東京・亀戸の下町で少量ずつ焙煎するファントムロースター。店舗を持たず、映像と写真で豆の背景を伝えながら、日々の一杯に寄り添う豆を届けている。" },
  tw: { name: "Tim Wendelboe", city: "Oslo", country: "NO", platform: "Shopify", note: "北欧浅煎りの原点", coord: [10.75, 59.91],
    founded: "2007", style: "極浅煎り・北欧スタイル", ship: "海外発送(1〜2週間)", focus: "ケニア・コロンビア",
    bio: "2004年ワールド・バリスタ・チャンピオンのティム・ウェンデルボーが、オスロに構えた焙煎所兼エスプレッソバー。素材の風味を最大限に残す極浅煎りで「北欧スタイル」を世界に広めた存在。コロンビアに自身の農園を持つほど、生産の現場にも踏み込んでいる。" },
  onyx: { name: "Onyx Coffee Lab", city: "Arkansas", country: "US", platform: "Shopify", note: "デザインと透明性の名店", coord: [-94.12, 36.33],
    founded: "2012", style: "浅〜中煎り・実験的精製", ship: "海外発送(1〜2週間)", focus: "エチオピア・中南米",
    bio: "アーカンソー州で夫妻が創業。生産者への支払額まで公開する徹底した透明性と、グラフィカルなパッケージデザインで知られる。実験的な精製の豆を積極的に扱い、アメリカのスペシャルティシーンを牽引する一軒。" },
  cc: { name: "Coffee Collective", city: "København", country: "DK", platform: "Shopify", note: "ダイレクトトレードの先駆", coord: [12.57, 55.68],
    founded: "2007", style: "浅煎り・ダイレクトトレード", ship: "海外発送(1〜2週間)", focus: "ケニア・エチオピア",
    bio: "コペンハーゲンで創業。相場を大きく上回る対価を生産者に直接支払うダイレクトトレードをいち早く実践し、その取引価格を公開してきた。デンマークのコーヒー文化を象徴するロースター。" },
  april: { name: "April Coffee", city: "København", country: "DK", platform: "Shopify", note: "焙煎を突き詰める探究者", coord: [12.55, 55.67],
    founded: "2018", style: "浅煎り・精密焙煎", ship: "海外発送(1〜2週間)", focus: "エチオピア・コロンビア",
    bio: "パトリック・ローデンバーグがコペンハーゲンで立ち上げた焙煎所。「焙煎の進歩」を掲げ、一杯ごとの再現性とレシピの透明性を徹底追求する。カヨンマウンテンやビクトル・バレラら生産者との継続的な関係を軸に、澄んだ甘さの浅煎りを届ける。" },
  glitch: { name: "GLITCH COFFEE", city: "東京 / 神田", country: "JP", platform: "Shopify", note: "都心の極浅シングルオリジン", coord: [139.76, 35.69],
    founded: "2015", style: "極浅煎り・シングルオリジン", ship: "国内発送(2〜4日)", focus: "エチオピア・ゲイシャ",
    bio: "鈴木清和が神田錦町に開いた焙煎所兼ハンドドリップ専門店。Qグレーダーの目で選び抜いた最上級ロットを、素材の輪郭が際立つ極浅で焼く。ゲイシャなど希少品種を惜しみなく並べ、東京の浅煎りシーンを象徴する一軒。" },
  sey: { name: "Sey Coffee", city: "Brooklyn", country: "US", platform: "Shopify", note: "生産者名で選ぶ透明性", coord: [-73.93, 40.71],
    founded: "2016", style: "極浅煎り・シングルロット", ship: "海外発送(1〜2週間)", focus: "エチオピア・ケニア",
    bio: "ブルックリン・ブッシュウィックの焙煎所。ロットごとに生産者・農園・精製を明記する徹底した透明性と、風味を最大限に引き出す極浅焙煎で知られる。季節ごとに世界の銘品を入れ替える、NYスペシャルティの旗手。" },
  barn: { name: "The Barn", city: "Berlin", country: "DE", platform: "Shopify", note: "欧州を牽引する老舗", coord: [13.40, 52.52],
    founded: "2010", style: "浅〜中浅煎り・季節替わり", ship: "海外発送(1〜2週間)", focus: "ケニア・エチオピア",
    bio: "ベルリンで創業し、ヨーロッパのスペシャルティを牽引してきた焙煎所。ケニアやエチオピアの果実味あふれるロットを中心に、ゲイシャ・ヴィレッジなどの希少豆も扱う。品質基準の高さで欧州各地のカフェから信頼を集める。" },
  pm: { name: "Proud Mary", city: "Melbourne", country: "AU", platform: "Shopify", note: "豪州の華やかロースター", coord: [144.96, -37.81],
    founded: "2009", style: "浅〜中浅煎り・果実系", ship: "海外発送(1〜2週間)", focus: "コロンビア・エチオピア",
    bio: "メルボルンを拠点に、鮮やかな果実味とエネルギッシュな味づくりで知られるオーストラリアの人気ロースター。COE入賞ロットやコロンビアのゲイシャ・シドラなど、攻めた希少品種のラインナップにも定評がある。" },
};

const BEANS = [
  { id: 1, r: "bibi", name: "Ethiopia Chelbesa", origin: "エチオピア", process: "Washed", amount: 1800, cur: "JPY", per: "150g", status: "now", color: "#DCD6C8", accent: "#8A3B2E", year: "2026" },
  { id: 2, r: "bibi", name: "Colombia El Paraíso", origin: "コロンビア", process: "Anaerobic", amount: 2200, cur: "JPY", per: "150g", status: "sold", color: "#2E2A24", accent: "#C8A96A", year: "2026" },
  { id: 3, r: "bibi", name: "Kenya Karimikui", origin: "ケニア", process: "Washed", amount: 2000, cur: "JPY", per: "150g", status: "archive", color: "#B8433A", accent: "#F2E9DC", year: "2025" },
  { id: 4, r: "tw", name: "Karogoto AA", origin: "ケニア", process: "Washed", amount: 165, cur: "NOK", per: "250g", status: "now", color: "#F4F1E8", accent: "#1A1815", year: "2026" },
  { id: 5, r: "tw", name: "Finca Tamana", origin: "コロンビア", process: "Washed", amount: 145, cur: "NOK", per: "250g", status: "now", color: "#EFE9DA", accent: "#2F5233", year: "2026" },
  { id: 6, r: "tw", name: "Hunkute", origin: "エチオピア", process: "Washed", amount: 155, cur: "NOK", per: "250g", status: "sold", color: "#E8E2D2", accent: "#A87B2E", year: "2026" },
  { id: 7, r: "tw", name: "La Palma Geisha", origin: "コロンビア", process: "Natural", amount: 320, cur: "NOK", per: "100g", status: "archive", color: "#D9D2C0", accent: "#8A3B2E", year: "2024", vt: "geisha" },
  { id: 8, r: "onyx", name: "Geometry", origin: "ブレンド", process: "Washed / Natural", amount: 19, cur: "USD", per: "10oz", status: "now", color: "#1C1B19", accent: "#E8E2D2", year: "2026" },
  { id: 9, r: "onyx", name: "Ethiopia Hambela", origin: "エチオピア", process: "Natural", amount: 24, cur: "USD", per: "10oz", status: "now", color: "#3A2E4F", accent: "#D9B44A", year: "2026" },
  { id: 10, r: "onyx", name: "Colombia Aponte", origin: "コロンビア", process: "Honey", amount: 22, cur: "USD", per: "10oz", status: "sold", color: "#6B2D3C", accent: "#EFE9DA", year: "2026" },
  { id: 11, r: "onyx", name: "Monarch", origin: "ブレンド", process: "Natural", amount: 18, cur: "USD", per: "10oz", status: "archive", color: "#22303A", accent: "#C8792E", year: "2023" },
  { id: 12, r: "cc", name: "Kieni", origin: "ケニア", process: "Washed", amount: 120, cur: "DKK", per: "250g", status: "now", color: "#F2EFE6", accent: "#B8433A", year: "2026" },
  { id: 13, r: "cc", name: "Akmel Nuri", origin: "エチオピア", process: "Natural", amount: 115, cur: "DKK", per: "250g", status: "sold", color: "#EDE7D6", accent: "#2F5233", year: "2026" },
  { id: 14, r: "cc", name: "La Soledad", origin: "グアテマラ", process: "Washed", amount: 110, cur: "DKK", per: "250g", status: "archive", color: "#E2DBC8", accent: "#5A4632", year: "2022" },
  { id: 15, r: "onyx", name: "Hacienda La Esmeralda Geisha", origin: "パナマ", process: "Washed", amount: 62, cur: "USD", per: "100g", status: "now", color: "#EFE9DA", accent: "#3A2E4F", year: "2026", vt: "geisha" },
  { id: 16, r: "bibi", name: "Monteblanco Geisha", origin: "コロンビア", process: "Washed", amount: 3200, cur: "JPY", per: "100g", status: "now", color: "#F2EFE6", accent: "#2F5233", year: "2026", vt: "geisha" },
  { id: 17, r: "cc", name: "Ninety Plus Gesha", origin: "パナマ", process: "Natural", amount: 350, cur: "DKK", per: "100g", status: "sold", color: "#1C1B19", accent: "#D9B44A", year: "2026", vt: "geisha" },
  { id: 18, r: "tw", name: "Cerro Azul Geisha", origin: "コロンビア", process: "Natural", amount: 420, cur: "NOK", per: "100g", status: "now", color: "#E8E2D2", accent: "#8A3B2E", year: "2026", vt: "geisha" },
  { id: 19, r: "bibi", name: "Panama Geisha Lot 24", origin: "パナマ", process: "Natural", amount: 4500, cur: "JPY", per: "100g", status: "archive", color: "#B8433A", accent: "#F2E9DC", year: "2025", vt: "geisha" },
  { id: 20, r: "onyx", name: "Los Nogales Sidra", origin: "コロンビア", process: "Honey", amount: 30, cur: "USD", per: "100g", status: "now", color: "#4A5A3A", accent: "#EFE9DA", year: "2026", vt: "sidra" },
  { id: 21, r: "tw", name: "La Palma Sidra", origin: "コロンビア", process: "Washed", amount: 280, cur: "NOK", per: "100g", status: "now", color: "#F4F1E8", accent: "#4A5A3A", year: "2026", vt: "sidra" },
  { id: 22, r: "bibi", name: "Sidra Anaerobic", origin: "コロンビア", process: "Anaerobic", amount: 2800, cur: "JPY", per: "100g", status: "sold", color: "#2E2A24", accent: "#C8A96A", year: "2026", vt: "sidra" },
  { id: 23, r: "cc", name: "Finca Deveaux Sidra", origin: "エクアドル", process: "Washed", amount: 260, cur: "DKK", per: "100g", status: "archive", color: "#EDE7D6", accent: "#8A3B2E", year: "2025", vt: "sidra" },

  /* --- April Coffee (København) --- */
  { id: 24, r: "april", name: "Kayon Mountain", origin: "エチオピア", process: "Natural", amount: 145, cur: "DKK", per: "250g", status: "now", color: "#5A2E3A", accent: "#E8C8A0", year: "2026" },
  { id: 25, r: "april", name: "Bombe Bensa", origin: "エチオピア", process: "Natural", amount: 155, cur: "DKK", per: "250g", status: "now", color: "#7C2D3C", accent: "#F2E9DC", year: "2026" },
  { id: 26, r: "april", name: "El Tesoro Tabi", origin: "コロンビア", process: "Washed", amount: 160, cur: "DKK", per: "250g", status: "sold", color: "#EFE9DA", accent: "#8A3B2E", year: "2026" },
  { id: 27, r: "april", name: "Decaf de Caña", origin: "コロンビア", process: "Washed", amount: 130, cur: "DKK", per: "250g", status: "archive", color: "#E2DBC8", accent: "#5A4632", year: "2025" },

  /* --- GLITCH COFFEE (東京) --- */
  { id: 28, r: "glitch", name: "Hambela Alaka", origin: "エチオピア", process: "Natural", amount: 2400, cur: "JPY", per: "100g", status: "now", color: "#3A2E4F", accent: "#D9B44A", year: "2026" },
  { id: 29, r: "glitch", name: "Kirinyaga AA", origin: "ケニア", process: "Washed", amount: 2200, cur: "JPY", per: "100g", status: "now", color: "#B8433A", accent: "#F2E9DC", year: "2026" },
  { id: 30, r: "glitch", name: "El Diviso Geisha", origin: "コロンビア", process: "Washed", amount: 3800, cur: "JPY", per: "100g", status: "now", color: "#F2EFE6", accent: "#2F5233", year: "2026", vt: "geisha" },
  { id: 31, r: "glitch", name: "Gera Geisha", origin: "エチオピア", process: "Washed", amount: 4200, cur: "JPY", per: "100g", status: "sold", color: "#E8E2D2", accent: "#3A2E4F", year: "2026", vt: "geisha" },
  { id: 32, r: "glitch", name: "Elida Geisha", origin: "パナマ", process: "Natural", amount: 5000, cur: "JPY", per: "100g", status: "archive", color: "#2E2A24", accent: "#C8A96A", year: "2025", vt: "geisha" },

  /* --- Sey Coffee (Brooklyn) --- */
  { id: 33, r: "sey", name: "Nginda Estate", origin: "ケニア", process: "Washed", amount: 26, cur: "USD", per: "250g", status: "now", color: "#6B2D3C", accent: "#EFE9DA", year: "2026" },
  { id: 34, r: "sey", name: "El Diamante Chiroso", origin: "コロンビア", process: "Washed", amount: 25, cur: "USD", per: "250g", status: "now", color: "#F4F1E8", accent: "#8A3B2E", year: "2026" },
  { id: 35, r: "sey", name: "Buku Sayisa", origin: "エチオピア", process: "Washed", amount: 24, cur: "USD", per: "250g", status: "sold", color: "#EFE9DA", accent: "#2F5233", year: "2026" },
  { id: 36, r: "sey", name: "Guji Natural", origin: "エチオピア", process: "Natural", amount: 23, cur: "USD", per: "250g", status: "archive", color: "#3A2E4F", accent: "#D9B44A", year: "2025" },

  /* --- The Barn (Berlin) --- */
  { id: 37, r: "barn", name: "Kiangoi AA", origin: "ケニア", process: "Washed", amount: 16, cur: "EUR", per: "250g", status: "now", color: "#7C4D8F", accent: "#F2E9DC", year: "2026" },
  { id: 38, r: "barn", name: "Kabingara AB", origin: "ケニア", process: "Washed", amount: 15, cur: "EUR", per: "250g", status: "sold", color: "#B8433A", accent: "#F2E9DC", year: "2026" },
  { id: 39, r: "barn", name: "Sidama Natural", origin: "エチオピア", process: "Natural", amount: 15, cur: "EUR", per: "250g", status: "now", color: "#5A2E3A", accent: "#E8C8A0", year: "2026" },
  { id: 40, r: "barn", name: "Gesha Village", origin: "エチオピア", process: "Washed", amount: 45, cur: "EUR", per: "100g", status: "now", color: "#F2EFE6", accent: "#2F5233", year: "2026", vt: "geisha" },
  { id: 41, r: "barn", name: "El Vergel Washed", origin: "コロンビア", process: "Washed", amount: 17, cur: "EUR", per: "250g", status: "archive", color: "#E2DBC8", accent: "#5A4632", year: "2024" },

  /* --- Proud Mary (Melbourne) --- */
  { id: 42, r: "pm", name: "Guji Uraga", origin: "エチオピア", process: "Natural", amount: 24, cur: "AUD", per: "250g", status: "now", color: "#D97E3A", accent: "#2E2A24", year: "2026" },
  { id: 43, r: "pm", name: "La Cereza", origin: "コロンビア", process: "Washed", amount: 22, cur: "AUD", per: "250g", status: "now", color: "#EFE9DA", accent: "#6B2D3C", year: "2026" },
  { id: 44, r: "pm", name: "La Miel Geisha", origin: "コロンビア", process: "Natural", amount: 50, cur: "AUD", per: "100g", status: "sold", color: "#1C1B19", accent: "#D9B44A", year: "2026", vt: "geisha" },
  { id: 45, r: "pm", name: "El Tejar Sidra", origin: "コロンビア", process: "Washed", amount: 45, cur: "AUD", per: "100g", status: "now", color: "#4A5A3A", accent: "#EFE9DA", year: "2026", vt: "sidra" },
  { id: 46, r: "pm", name: "El Naranjo", origin: "グアテマラ", process: "Washed", amount: 23, cur: "AUD", per: "250g", status: "archive", color: "#E2DBC8", accent: "#5A4632", year: "2025" },
];

/* 為替レート（試作用の固定値 — 実装ではAPIで日次取得） */
const RATES_TO_JPY = { JPY: 1, USD: 150, NOK: 14.5, DKK: 22, EUR: 165, AUD: 100 };
const CUR_SYMBOL = { JPY: "¥", USD: "$", NOK: "kr ", DKK: "kr ", EUR: "€", AUD: "A$" };

function toJPY(bean) { return bean.amount * RATES_TO_JPY[bean.cur]; }
function fmtPrice(bean, disp) {
  const jpy = toJPY(bean);
  if (disp === "JPY") return `¥${Math.round(jpy).toLocaleString()}`;
  return `$${(jpy / RATES_TO_JPY.USD).toFixed(2)}`;
}
function perGrams(bean) {
  if (bean.per.endsWith("oz")) return Math.round(parseFloat(bean.per) * 28.35);
  return parseInt(bean.per);
}
function fmtLocal(bean) {
  return `${CUR_SYMBOL[bean.cur]}${bean.amount.toLocaleString()}${bean.cur !== "JPY" && bean.cur !== "USD" ? ` ${bean.cur}` : ""}`;
}

const STATUS = {
  now: { label: "NOW", jp: "在庫あり", dot: GREEN },
  sold: { label: "SOLD OUT", jp: "売り切れ", dot: AMBER },
  archive: { label: "ARCHIVE", jp: "記録", dot: GRAY },
};

const ORIGINS = ["すべて", "エチオピア", "ケニア", "コロンビア", "パナマ", "グアテマラ", "エクアドル", "ブレンド"];

/* ---------- パッケージ(標本)描画 ---------- */
function Package({ bean, small }) {
  const roaster = ROASTERS[bean.r];
  const faded = bean.status === "archive";
  return (
    <div
      style={{
        background: bean.color,
        borderRadius: 6,
        aspectRatio: "3 / 4",
        position: "relative",
        overflow: "hidden",
        filter: faded ? "grayscale(0.55) contrast(0.92)" : "none",
        opacity: faded ? 0.85 : 1,
        boxShadow: "0 1px 2px rgba(23,21,15,0.10)",
      }}
    >
      {/* 袋の折り返し */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "12%", background: "rgba(23,21,15,0.10)", borderBottom: "1px solid rgba(23,21,15,0.12)" }} />
      {/* ロースターマーク */}
      <div style={{ position: "absolute", top: "18%", left: 0, right: 0, textAlign: "center", color: bean.accent, fontSize: small ? 8 : 9, letterSpacing: "0.18em", fontWeight: 700 }}>
        {roaster.name.toUpperCase()}
      </div>
      {/* 豆名ラベル */}
      <div style={{ position: "absolute", top: "38%", left: "10%", right: "10%", textAlign: "center" }}>
        <div style={{ color: bean.accent, fontWeight: 700, fontSize: small ? 11 : 13, lineHeight: 1.25 }}>{bean.name}</div>
        <div style={{ marginTop: 6, height: 1, background: bean.accent, opacity: 0.5 }} />
        <div style={{ marginTop: 6, color: bean.accent, fontSize: small ? 8 : 9, letterSpacing: "0.08em", opacity: 0.9 }}>
          {bean.process.toUpperCase()}
        </div>
      </div>
      {/* 標本番号 */}
      <div style={{ position: "absolute", bottom: 6, right: 8, fontFamily: "ui-monospace, monospace", fontSize: 8, color: bean.accent, opacity: 0.7 }}>
        No.{String(bean.id).padStart(4, "0")}
      </div>
    </div>
  );
}

/* ---------- 豆カード ---------- */
function BeanCard({ bean, onOpen, onRoaster, cur }) {
  const s = STATUS[bean.status];
  return (
    <div className="bt-card" style={{ cursor: "pointer" }} onClick={() => onOpen(bean)}>
      <Package bean={bean} small />
      <div style={{ padding: "8px 2px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: s.dot, flexShrink: 0 }} />
          <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 9, color: s.dot === GRAY ? GRAY : s.dot, letterSpacing: "0.06em" }}>{s.label}</span>
          {bean.status !== "archive" && (
            <span style={{ marginLeft: "auto", fontFamily: "ui-monospace, monospace", fontSize: 9, color: INK }}>{fmtPrice(bean, cur)}/{perGrams(bean)}g</span>
          )}
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: INK, marginTop: 3, lineHeight: 1.3 }}>{bean.name}</div>
        <button
          onClick={(e) => { e.stopPropagation(); onRoaster(bean.r); }}
          style={{ fontSize: 10.5, color: GRAY, marginTop: 2, background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2 }}
        >
          {ROASTERS[bean.r].name}
        </button>
      </div>
    </div>
  );
}

/* ---------- 詳細シート ---------- */
function DetailSheet({ bean, onClose, onRoaster, cur }) {
  if (!bean) return null;
  const s = STATUS[bean.status];
  const roaster = ROASTERS[bean.r];
  const rows = [
    ["産地", bean.origin],
    ["精製", bean.process],
    ["現地価格", `${fmtLocal(bean)} / ${bean.per}`],
    [cur === "JPY" ? "円換算" : "ドル換算", `${fmtPrice(bean, cur)} / ${perGrams(bean)}g`],
    ["100gあたり", (() => {
      const jpy100 = (toJPY(bean) / perGrams(bean)) * 100;
      return cur === "JPY" ? `¥${Math.round(jpy100).toLocaleString()}` : `$${(jpy100 / RATES_TO_JPY.USD).toFixed(2)}`;
    })()],
    ["初出", bean.year],
  ];
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(23,21,15,0.45)", zIndex: 50, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div className="bt-sheet" onClick={(e) => e.stopPropagation()} style={{ background: PAPER, width: "100%", maxWidth: 480, borderRadius: "14px 14px 0 0", padding: "18px 20px 26px", maxHeight: "82vh", overflowY: "auto" }}>
        <div style={{ width: 34, height: 4, borderRadius: 999, background: LINE, margin: "0 auto 16px" }} />
        <div style={{ display: "flex", gap: 16 }}>
          <div className="bt-detail-pkg" style={{ width: 120, flexShrink: 0 }}><Package bean={bean} /></div>
          <div className="bt-detail-info" style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 7, height: 7, borderRadius: 999, background: s.dot }} />
              <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, color: s.dot === GRAY ? GRAY : s.dot }}>{s.label} — {s.jp}</span>
            </div>
            <div style={{ fontSize: 17, fontWeight: 700, color: INK, marginTop: 6, lineHeight: 1.25 }}>{bean.name}</div>
            <button onClick={() => { onClose(); onRoaster(bean.r); }} style={{ fontSize: 12, color: GRAY, marginTop: 3, background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2 }}>
              {roaster.name} — {roaster.city}
            </button>
            <table style={{ marginTop: 12, fontSize: 12, color: INK, borderCollapse: "collapse", width: "100%" }}>
              <tbody>
                {rows.map(([k, v]) => (
                  <tr key={k} style={{ borderTop: `1px solid ${LINE}` }}>
                    <td style={{ padding: "6px 0", color: GRAY, fontSize: 11, width: 62 }}>{k}</td>
                    <td style={{ padding: "6px 0", fontFamily: "ui-monospace, monospace", fontSize: 11.5 }}>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div style={{ marginTop: 18 }}>
          {bean.status === "now" && (
            <button style={{ width: "100%", padding: "13px 0", background: INK, color: PAPER, border: "none", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
              ロースターのECで見る →
            </button>
          )}
          {bean.status === "sold" && (
            <button style={{ width: "100%", padding: "13px 0", background: PAPER, color: INK, border: `1.5px solid ${INK}`, borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
              🔔 再入荷を待つ<span style={{ fontSize: 10, color: GRAY, fontWeight: 400, marginLeft: 8 }}>プレミアム機能(v2)</span>
            </button>
          )}
          {bean.status === "archive" && (
            <div style={{ textAlign: "center", fontSize: 11.5, color: GRAY, padding: "10px 0", borderTop: `1px solid ${LINE}` }}>
              この豆は販売を終了しています。図鑑の記録として保存されています。
            </div>
          )}
          {bean.status === "now" && (
            <div style={{ textAlign: "center", fontSize: 10, color: GRAY, marginTop: 8, fontFamily: "ui-monospace, monospace" }}>
              → /go/{String(bean.id).padStart(4, "0")} 経由で送客を計測
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- ロースターページ ---------- */
function RoasterPage({ rid, onOpen, onBack, onRoaster, initialTab, cur }) {
  const roaster = ROASTERS[rid];
  const [tab, setTab] = useState(initialTab || "now");
  const beans = BEANS.filter((b) => b.r === rid);
  const byStatus = (st) => beans.filter((b) => b.status === st);
  const tabs = [
    { key: "now", label: "NOW", n: byStatus("now").length },
    { key: "sold", label: "SOLD OUT", n: byStatus("sold").length },
    { key: "archive", label: "ARCHIVE", n: byStatus("archive").length },
  ];
  return (
    <div>
      <button onClick={onBack} style={{ background: "none", border: "none", color: GRAY, fontSize: 12, padding: "2px 0 12px", cursor: "pointer" }}>← 図鑑にもどる</button>
      <div style={{ borderTop: `2px solid ${INK}`, paddingTop: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: INK, margin: 0 }}>{roaster.name}</h2>
          <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, color: GRAY }}>{roaster.country} / {roaster.platform}</span>
        </div>
        <div style={{ fontSize: 12, color: GRAY, marginTop: 4 }}>{roaster.city} — {roaster.note}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 16px", marginTop: 12, padding: "10px 12px", background: "#F2F0E9", borderRadius: 8 }}>
          {[["創業", roaster.founded], ["焙煎", roaster.style], ["発送", roaster.ship], ["得意産地", roaster.focus]].map(([k, v]) => (
            <div key={k}>
              <div style={{ fontSize: 9, color: GRAY, letterSpacing: "0.06em" }}>{k}</div>
              <div style={{ fontSize: 11, color: INK, marginTop: 1, fontWeight: 600 }}>{v}</div>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 12, color: INK, lineHeight: 1.85, marginTop: 12, marginBottom: 0 }}>{roaster.bio}</p>
      </div>
      <div style={{ display: "flex", gap: 0, marginTop: 18, borderBottom: `1px solid ${LINE}` }}>
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              flex: 1, padding: "9px 0", background: "none", border: "none", cursor: "pointer",
              fontFamily: "ui-monospace, monospace", fontSize: 11, letterSpacing: "0.05em",
              color: tab === t.key ? INK : GRAY, fontWeight: tab === t.key ? 700 : 400,
              borderBottom: tab === t.key ? `2px solid ${INK}` : "2px solid transparent",
            }}>
            {t.label} <span style={{ opacity: 0.6 }}>{t.n}</span>
          </button>
        ))}
      </div>
      {tab === "archive" ? (
        /* 年別の歴代ポートフォリオ */
        (() => {
          const arc = byStatus("archive");
          const years = [...new Set(arc.map((b) => b.year))].sort((a, b) => b - a);
          return years.map((yr) => (
            <div key={yr} style={{ marginTop: 20 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, borderBottom: `1px solid ${LINE}`, paddingBottom: 6 }}>
                <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 15, fontWeight: 700, color: INK }}>{yr}</span>
                <span style={{ fontSize: 10, color: GRAY }}>{arc.filter((b) => b.year === yr).length} 銘柄</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 16, marginTop: 14 }}>
                {arc.filter((b) => b.year === yr).map((b) => <BeanCard key={b.id} bean={b} onOpen={onOpen} onRoaster={onRoaster} cur={cur} />)}
              </div>
            </div>
          ));
        })()
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 16, marginTop: 18 }}>
          {byStatus(tab).map((b) => <BeanCard key={b.id} bean={b} onOpen={onOpen} onRoaster={onRoaster} cur={cur} />)}
        </div>
      )}
      {byStatus(tab).length === 0 && (
        <div style={{ textAlign: "center", color: GRAY, fontSize: 12, padding: "40px 0" }}>このカテゴリの豆はまだありません。</div>
      )}
      {tab === "archive" && byStatus("archive").length > 0 && (
        <div style={{ marginTop: 20, fontSize: 11, color: GRAY, borderTop: `1px solid ${LINE}`, paddingTop: 12 }}>
          ARCHIVEは巡回で「ページが消えた」豆を自動保存した記録です。{roaster.name}の歴代ラインナップとして残ります。
        </div>
      )}
    </div>
  );
}

/* ---------- 地球儀（ロースター探索） ---------- */
function GlobeView({ onRoaster }) {
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

/* ---------- オープニング ---------- */
function Splash({ done }) {
  return (
    <div className={done ? "bt-splash bt-splash-out" : "bt-splash"}
      style={{
        position: "fixed", inset: 0, zIndex: 100, background: PAPER,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        pointerEvents: done ? "none" : "auto",
      }}>
      <div className="bt-mark" style={{ fontWeight: 800, fontSize: 24, letterSpacing: "0.35em", color: INK, paddingLeft: "0.35em" }}>
        BEAN&nbsp;TRACKER
      </div>
      <div className="bt-line" style={{ height: 2, background: INK, marginTop: 14 }} />
      <div className="bt-tag" style={{ fontSize: 11, color: GRAY, marginTop: 12, letterSpacing: "0.1em" }}>
        世界中のコーヒー豆に辿り着くためのインフラ
      </div>
    </div>
  );
}

/* ---------- 好み診断 ---------- */
const QUESTIONS = [
  { q: "どんな味わいが好きですか?", options: [
    { label: "すっきり明るい酸味", pts: { tw: 3, cc: 1, sey: 2, barn: 1 } },
    { label: "フルーティで甘やか", pts: { onyx: 3, bibi: 1, pm: 2, april: 1 } },
    { label: "バランスよく飲みやすい", pts: { cc: 3, bibi: 1, april: 1 } },
    { label: "飲んだことのない味に出会いたい", pts: { onyx: 2, tw: 1, bibi: 1, glitch: 2, pm: 1 } },
  ]},
  { q: "焙煎度の好みは?", options: [
    { label: "浅煎り一筋", pts: { tw: 3, cc: 1, sey: 2, glitch: 2 } },
    { label: "浅〜中浅で幅広く", pts: { cc: 2, onyx: 2, barn: 2, april: 1 } },
    { label: "おまかせで楽しみたい", pts: { bibi: 2, onyx: 1, pm: 1 } },
  ]},
  { q: "精製方式への冒険度は?", options: [
    { label: "クリーンな Washed が基本", pts: { tw: 3, cc: 2, sey: 2, april: 1 } },
    { label: "Natural や Honey も好き", pts: { onyx: 2, bibi: 2, barn: 1, pm: 1 } },
    { label: "Anaerobic など実験系も試したい", pts: { onyx: 3, bibi: 1, pm: 2, glitch: 1 } },
  ]},
  { q: "豆の買い方は?", options: [
    { label: "国内でさっと届いてほしい", pts: { bibi: 3, glitch: 3 } },
    { label: "海外からの取り寄せも楽しい", pts: { tw: 2, onyx: 2, cc: 2, april: 2, sey: 2, barn: 2, pm: 2 } },
  ]},
];

const TYPE_LABEL = {
  tw: { type: "北欧クリーン型", desc: "透明感のある酸味と、素材そのままの味を追いかけるタイプ。" },
  onyx: { type: "モダン・エクスペリメンタル型", desc: "新しい精製や華やかな甘さに心が動くタイプ。" },
  cc: { type: "クラシック・バランス型", desc: "毎日の一杯の完成度を大切にするタイプ。" },
  bibi: { type: "下町デイリー型", desc: "身近な店と、日々の暮らしに寄り添う豆を好むタイプ。" },
  april: { type: "精密レシピ型", desc: "再現性と甘さの設計に惹かれる、探究派のタイプ。" },
  glitch: { type: "極浅ハンター型", desc: "都心で希少品種や極浅の輪郭を追いかけるタイプ。" },
  sey: { type: "生産者トレース型", desc: "誰が作った豆かを知り、澄んだ果実味を好むタイプ。" },
  barn: { type: "ヨーロピアン果実型", desc: "ケニアの果実味など、王道の華やかさを好むタイプ。" },
  pm: { type: "サウス・エナジェティック型", desc: "鮮烈で攻めた味づくりにワクワクするタイプ。" },
};

/* 全ロースター分のスコアを 0 で初期化 */
const initScores = () => Object.fromEntries(Object.keys(ROASTERS).map((k) => [k, 0]));

function DiagnosisView({ onRoaster }) {
  const [step, setStep] = useState(0);
  const [scores, setScores] = useState(initScores);

  const answer = (pts) => {
    const next = { ...scores };
    Object.entries(pts).forEach(([k, v]) => { next[k] += v; });
    setScores(next);
    setStep(step + 1);
  };
  const reset = () => { setStep(0); setScores(initScores()); };

  if (step >= QUESTIONS.length) {
    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const [topId] = sorted[0];
    const top = ROASTERS[topId];
    const t = TYPE_LABEL[topId];
    return (
      <div className="bt-card">
        <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, color: GRAY, letterSpacing: "0.1em" }}>RESULT</div>
        <div style={{ fontSize: 21, fontWeight: 800, marginTop: 6 }}>{t.type}</div>
        <div style={{ fontSize: 12.5, color: GRAY, marginTop: 6, lineHeight: 1.7 }}>{t.desc}</div>

        <div style={{ borderTop: `2px solid ${INK}`, marginTop: 18, paddingTop: 14 }}>
          <div style={{ fontSize: 11, color: GRAY }}>いま一番相性が近いロースター</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 6 }}>
            <div style={{ fontSize: 17, fontWeight: 700 }}>{top.name}</div>
            <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, color: GRAY }}>{top.city}</span>
          </div>
          <div style={{ fontSize: 11.5, color: GRAY, marginTop: 2 }}>{top.note}</div>
          <button onClick={() => onRoaster(topId)}
            style={{ width: "100%", marginTop: 12, padding: "12px 0", background: INK, color: PAPER, border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            この店の豆を見に行く →
          </button>
        </div>

        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 11, color: GRAY, marginBottom: 4 }}>ほかの店との相性</div>
          {sorted.slice(1).map(([rid]) => (
            <button key={rid} onClick={() => onRoaster(rid)}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", background: "none", border: "none", borderTop: `1px solid ${LINE}`, padding: "11px 2px", cursor: "pointer", textAlign: "left" }}>
              <div>
                <span style={{ fontSize: 13, fontWeight: 700, color: INK }}>{ROASTERS[rid].name}</span>
                <span style={{ fontSize: 10.5, color: GRAY, marginLeft: 8 }}>{TYPE_LABEL[rid].type}</span>
              </div>
              <span style={{ color: GRAY }}>→</span>
            </button>
          ))}
        </div>

        <div style={{ marginTop: 16, fontSize: 10, color: GRAY, lineHeight: 1.7, borderTop: `1px solid ${LINE}`, paddingTop: 10 }}>
          この診断はロースターの優劣ではなく、あなたの好みとの相性です。答えが変われば近い店も変わります。
        </div>
        <button onClick={reset} style={{ marginTop: 12, background: "none", border: `1px solid ${LINE}`, borderRadius: 999, padding: "7px 16px", fontSize: 11, color: GRAY, cursor: "pointer" }}>
          もう一度診断する
        </button>
      </div>
    );
  }

  const q = QUESTIONS[step];
  return (
    <div className="bt-card" key={step}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, color: GRAY, letterSpacing: "0.1em" }}>
          Q{step + 1} / {QUESTIONS.length}
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {QUESTIONS.map((_, i) => (
            <span key={i} style={{ width: 14, height: 3, borderRadius: 2, background: i <= step ? INK : LINE }} />
          ))}
        </div>
        <p style={{ fontSize: 12, color: INK, lineHeight: 1.85, marginTop: 12, marginBottom: 0 }}>{roaster.bio}</p>
      </div>
      <div style={{ fontSize: 17, fontWeight: 700, marginTop: 12, lineHeight: 1.5 }}>{q.q}</div>
      <div style={{ marginTop: 16 }}>
        {q.options.map((o) => (
          <button key={o.label} onClick={() => answer(o.pts)}
            style={{
              display: "block", width: "100%", textAlign: "left", padding: "13px 14px", marginTop: 8,
              background: PAPER, border: `1px solid ${LINE}`, borderRadius: 8,
              fontSize: 13, color: INK, cursor: "pointer",
            }}>{o.label}</button>
        ))}
      </div>
      {step > 0 && (
        <button onClick={reset} style={{ marginTop: 14, background: "none", border: "none", fontSize: 11, color: GRAY, cursor: "pointer", padding: 0 }}>
          ← 最初からやり直す
        </button>
      )}
    </div>
  );
}

/* ---------- 味わいマップ ---------- */
const FLAVORS = {
  citrus: { label: "柑橘", color: "#D9B441" },
  floral: { label: "花・お茶", color: "#D98CA6" },
  berry: { label: "ベリー", color: "#7C4D8F" },
  tropical: { label: "トロピカル", color: "#D97E3A" },
  choco: { label: "チョコ・甘み", color: "#7A5232" },
};
/* fx: 0=クリーン ←→ 100=個性派 / fy: 0=明るい ←→ 100=深い */
const FLAVOR_MAP = {
  1: { fx: 32, fy: 20, fam: "citrus", notes: "レモンティー・白い花" },
  2: { fx: 88, fy: 45, fam: "tropical", notes: "ライチ・パイナップル" },
  4: { fx: 45, fy: 14, fam: "berry", notes: "カシス・グレープフルーツ" },
  5: { fx: 22, fy: 52, fam: "choco", notes: "キャラメル・赤リンゴ" },
  6: { fx: 52, fy: 10, fam: "floral", notes: "ジャスミン・ピーチ" },
  8: { fx: 30, fy: 66, fam: "choco", notes: "ミルクチョコ・オレンジ" },
  9: { fx: 70, fy: 40, fam: "berry", notes: "ブルーベリー・カカオ" },
  10: { fx: 60, fy: 60, fam: "choco", notes: "黒糖・プラム" },
  12: { fx: 46, fy: 24, fam: "berry", notes: "カシス・オレンジ" },
  13: { fx: 74, fy: 30, fam: "berry", notes: "ストロベリー・ハニー" },
  24: { fx: 68, fy: 34, fam: "tropical", notes: "マンゴー・ドライアプリコット" },
  25: { fx: 78, fy: 42, fam: "berry", notes: "ラズベリー・完熟プラム" },
  26: { fx: 24, fy: 50, fam: "choco", notes: "プラム・赤リンゴ・黒糖" },
  28: { fx: 82, fy: 38, fam: "berry", notes: "ブルーベリー・カカオニブ" },
  29: { fx: 40, fy: 18, fam: "citrus", notes: "ブラックカラント・トマト" },
  33: { fx: 44, fy: 20, fam: "berry", notes: "ブラッドオレンジ・カシス" },
  34: { fx: 58, fy: 12, fam: "floral", notes: "ジャスミン・白桃・柑橘" },
  35: { fx: 50, fy: 16, fam: "floral", notes: "紅茶・ベルガモット" },
  37: { fx: 48, fy: 22, fam: "berry", notes: "ブラッドオレンジ・プラム" },
  39: { fx: 76, fy: 40, fam: "berry", notes: "ストロベリー・ドライアプリコット" },
  42: { fx: 80, fy: 46, fam: "tropical", notes: "パイナップル・ライチ" },
  43: { fx: 30, fy: 56, fam: "choco", notes: "キャラメル・カカオ・オレンジ" },
};

function FlavorMapView({ onOpen, cur }) {
  const [famF, setFamF] = useState(null);     // 系統ハイライト
  const [selId, setSelId] = useState(null);   // 選択中の豆
  const beans = BEANS.filter((b) => FLAVOR_MAP[b.id]);
  const sel = beans.find((b) => b.id === selId);

  return (
    <div>
      <div style={{ fontSize: 11, color: GRAY, marginBottom: 10 }}>
        いま買える豆を、味わいの座標で。●をタップすると豆の詳細が出ます。
      </div>

      {/* 系統の凡例（タップでハイライト） */}
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
      <div style={{ position: "relative", width: "100%", aspectRatio: "1 / 1", marginTop: 6,
        borderRadius: 12, border: `1.4px solid ${INK}`, overflow: "hidden",
        background: `
          radial-gradient(at 15% 12%, rgba(217,180,65,0.13), transparent 55%),
          radial-gradient(at 85% 12%, rgba(217,140,166,0.14), transparent 55%),
          radial-gradient(at 85% 88%, rgba(124,77,143,0.12), transparent 55%),
          radial-gradient(at 15% 88%, rgba(122,82,50,0.13), transparent 55%),
          #FCFBF8` }}>
        {/* 十字の補助線 */}
        <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: LINE }} />
        <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 1, background: LINE }} />
        {/* 軸ラベル */}
        <span style={{ position: "absolute", top: 6, left: "50%", transform: "translateX(-50%)", fontSize: 9, color: GRAY, letterSpacing: "0.15em" }}>明るい・すっきり</span>
        <span style={{ position: "absolute", bottom: 6, left: "50%", transform: "translateX(-50%)", fontSize: 9, color: GRAY, letterSpacing: "0.15em" }}>深い・コク</span>
        <span style={{ position: "absolute", left: 8, top: "50%", transform: "translate(-30%, -50%) rotate(-90deg)", fontSize: 9, color: GRAY, letterSpacing: "0.15em" }}>クリーン</span>
        <span style={{ position: "absolute", right: 8, top: "50%", transform: "translate(30%, -50%) rotate(90deg)", fontSize: 9, color: GRAY, letterSpacing: "0.15em" }}>個性派</span>

        {/* 豆のドット */}
        {beans.map((b, i) => {
          const m = FLAVOR_MAP[b.id];
          const f = FLAVORS[m.fam];
          const dimmed = famF && famF !== m.fam;
          const isSel = selId === b.id;
          return (
            <button key={b.id} onClick={() => setSelId(isSel ? null : b.id)}
              className="bt-dot"
              style={{
                position: "absolute", left: `${m.fx}%`, top: `${m.fy}%`,
                width: 30, height: 30, marginLeft: -15, marginTop: -15,
                background: "transparent", border: "none", cursor: "pointer", padding: 0,
                animationDelay: `${0.35 + i * 0.06}s`,
                opacity: dimmed ? 0.15 : 1,
                transition: "opacity 0.25s ease",
                zIndex: isSel ? 5 : 1,
              }}>
              <span className={isSel ? "bt-dot-core bt-dot-sel" : "bt-dot-core"}
                style={{
                  display: "block", width: 14, height: 14, margin: "8px auto",
                  borderRadius: 999,
                  background: b.status === "sold" ? "transparent" : f.color,
                  border: `3px solid ${f.color}`,
                  boxShadow: isSel ? `0 0 0 5px ${f.color}33` : "0 1px 3px rgba(23,21,15,0.2)",
                  animationDelay: `${i * 0.4}s`,
                }} />
            </button>
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9.5, color: GRAY, marginTop: 6 }}>
        <span>● 在庫あり　○ 売り切れ</span>
        <span>座標は精製・焙煎からの位置づけ（優劣ではありません）</span>
      </div>

      {/* 選択中の豆カード */}
      {sel && (
        <div className="bt-card" key={sel.id} style={{ display: "flex", gap: 14, borderTop: `2px solid ${INK}`, marginTop: 12, paddingTop: 14 }}>
          <div style={{ width: 84, flexShrink: 0 }}><Package bean={sel} small /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 9, height: 9, borderRadius: 999, background: FLAVORS[FLAVOR_MAP[sel.id].fam].color }} />
              <span style={{ fontSize: 10.5, color: GRAY }}>{FLAVORS[FLAVOR_MAP[sel.id].fam].label} — {FLAVOR_MAP[sel.id].notes}</span>
            </div>
            <div style={{ fontSize: 14.5, fontWeight: 700, marginTop: 4 }}>{sel.name}</div>
            <div style={{ fontSize: 11, color: GRAY, marginTop: 2 }}>
              {ROASTERS[sel.r].name} ・ {STATUS[sel.status].jp} ・ {fmtPrice(sel, cur)}/{perGrams(sel)}g
            </div>
            <button onClick={() => onOpen(sel)}
              style={{ marginTop: 10, padding: "9px 18px", background: INK, color: PAPER, border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              詳しく見る →
            </button>
          </div>
        </div>
      )}
      {!sel && (
        <div style={{ textAlign: "center", fontSize: 10.5, color: GRAY, marginTop: 14 }}>
          右上ほど個性的で明るく、左下ほどクラシックで深い味わいです
        </div>
      )}
    </div>
  );
}

/* ---------- レアロット ---------- */
function VarietySection({ vt, title, sub, onOpen, cur }) {
  const all = BEANS.filter((b) => b.vt === vt);
  const live = all.filter((b) => b.status === "now");
  const soldNow = all.filter((b) => b.status === "sold");
  const arc = all.filter((b) => b.status === "archive");
  const per100 = (b) => (toJPY(b) / perGrams(b)) * 100;
  const fmt100 = (b) => cur === "JPY" ? `¥${Math.round(per100(b)).toLocaleString()}` : `$${(per100(b) / RATES_TO_JPY.USD).toFixed(0)}`;
  const ladder = [...live, ...soldNow].sort((a, b) => per100(a) - per100(b));
  const maxP = Math.max(...ladder.map(per100));
  const years = [...new Set(arc.map((b) => b.year))].sort((a, b) => b - a);

  return (
    <div style={{ marginTop: 26 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: "0.08em" }}>{title}</span>
        <span style={{ fontSize: 10, color: GRAY }}>{sub}</span>
      </div>

      {/* ライブカウンター */}
      <div style={{ borderTop: `2px solid ${INK}`, borderBottom: `1px solid ${LINE}`, padding: "12px 0", marginTop: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="bt-live" style={{ width: 8, height: 8, borderRadius: 999, background: GREEN }} />
          <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, letterSpacing: "0.15em", color: GRAY }}>LIVE</span>
        </div>
        <div style={{ fontSize: 19, fontWeight: 800, marginTop: 5 }}>
          いま世界で買える <span style={{ fontFamily: "ui-monospace, monospace" }}>{live.length}</span> 銘柄
        </div>
      </div>

      {/* 100gあたり価格軸 */}
      <div style={{ marginTop: 14 }}>
        <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, letterSpacing: "0.12em", color: GRAY }}>
          PRICE / 100g
        </div>
        {ladder.map((b, i) => (
          <button key={b.id} onClick={() => onOpen(b)}
            style={{ display: "block", width: "100%", background: "none", border: "none", padding: "10px 0 0", cursor: "pointer", textAlign: "left" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: INK }}>
                {b.status === "sold" && <span style={{ color: AMBER, fontSize: 9, fontFamily: "ui-monospace, monospace", marginRight: 6 }}>SOLD OUT</span>}
                {b.name}
              </span>
              <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: INK }}>{fmt100(b)}</span>
            </div>
            <div style={{ fontSize: 10, color: GRAY, marginTop: 1 }}>{ROASTERS[b.r].name} ・ {b.origin} ・ {b.process}</div>
            <div style={{ height: 6, background: "#F0EDE4", borderRadius: 3, marginTop: 5, overflow: "hidden" }}>
              <div className="bt-bar" style={{
                height: "100%", borderRadius: 3,
                width: `${(per100(b) / maxP) * 100}%`,
                background: b.status === "sold" ? LINE : `linear-gradient(90deg, ${GREEN}, #6B8F3C)`,
                animationDelay: `${0.15 + i * 0.09}s`,
              }} />
            </div>
          </button>
        ))}
      </div>

      {/* アーカイブ年表 */}
      {arc.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, letterSpacing: "0.12em", color: GRAY, borderBottom: `1px solid ${LINE}`, paddingBottom: 6 }}>
            {title} ARCHIVE — 消えたロットの記録
          </div>
          {years.map((yr) => (
            <div key={yr} style={{ display: "flex", gap: 14, marginTop: 12 }}>
              <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 13, fontWeight: 700, color: GRAY, width: 42, flexShrink: 0, paddingTop: 2 }}>{yr}</div>
              <div style={{ flex: 1 }}>
                {arc.filter((b) => b.year === yr).map((b) => (
                  <button key={b.id} onClick={() => onOpen(b)}
                    style={{ display: "flex", gap: 10, width: "100%", background: "none", border: "none", padding: "0 0 12px", cursor: "pointer", textAlign: "left", alignItems: "center" }}>
                    <div style={{ width: 34, flexShrink: 0 }}><Package bean={b} small /></div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: INK }}>{b.name}</div>
                      <div style={{ fontSize: 10, color: GRAY }}>{ROASTERS[b.r].name} ・ {b.origin} ・ {b.process}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GeishaView({ onOpen, onRoaster, cur }) {
  return (
    <div>
      {/* ページヘッダー */}
      <div>
        <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, letterSpacing: "0.2em", color: GRAY }}>RARE LOT</div>
        <div style={{ fontSize: 12, color: GRAY, marginTop: 4, lineHeight: 1.7 }}>
          少量で消えていく希少な豆だけを追いかけるトラッカー。
        </div>
      </div>

      <VarietySection vt="geisha" title="GEISHA" sub="ゲイシャ品種" onOpen={onOpen} cur={cur} />
      <VarietySection vt="sidra" title="SIDRA" sub="シドラ品種" onOpen={onOpen} cur={cur} />

      {/* 新着通知CTA */}
      <div style={{ marginTop: 24, padding: "14px 16px", background: "#F2F0E9", borderRadius: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>🔔 世界のどこかでレアロットが出たら、すぐ知る</div>
        <div style={{ fontSize: 11, color: GRAY, marginTop: 4, lineHeight: 1.7 }}>
          巡回が新しいゲイシャやシドラを見つけた瞬間に通知します。少量ロットの売り切れ前に。
        </div>
        <button style={{ marginTop: 10, padding: "10px 18px", background: INK, color: PAPER, border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          新着レアロット通知を受け取る<span style={{ fontSize: 9.5, fontWeight: 400, marginLeft: 8, opacity: 0.7 }}>プレミアム(v2)</span>
        </button>
      </div>

      {/* 今後のセクション予告 */}
      <div style={{ marginTop: 20, padding: "12px 14px", border: `1px dashed ${LINE}`, borderRadius: 10, fontSize: 11, color: GRAY, lineHeight: 1.8 }}>
        このタブは今後、AUCTION LOT(オークションロット)や COE(カップ・オブ・エクセレンス)入賞ロットなど、セクションを増やして育っていきます。
      </div>
    </div>
  );
}

/* ---------- メイン ---------- */
export default function BeanTracker() {
  const [view, setView] = useState("zukan"); // zukan | roaster
  const [roasterId, setRoasterId] = useState(null);
  const [roasterTab, setRoasterTab] = useState("now");
  const [origin, setOrigin] = useState("すべて");
  const [statusF, setStatusF] = useState("all");
  const [open, setOpen] = useState(null);
  const [displayCur, setDisplayCur] = useState("JPY");
  const [priceF, setPriceF] = useState("all");
  const [processF, setProcessF] = useState("すべて");
  const [splashDone, setSplashDone] = useState(false);
  const [splashGone, setSplashGone] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setSplashDone(true), 1700);   // 表示を終えてフェード開始
    const t2 = setTimeout(() => setSplashGone(true), 2400);   // 完全に取り除く
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const goRoaster = (rid, tab) => { setRoasterId(rid); setRoasterTab(tab || "now"); setView("roaster"); window.scrollTo(0, 0); };

  const PRICE_BANDS = {
    all: { label: displayCur === "JPY" ? "すべての価格" : "All prices", test: () => true },
    low: { label: displayCur === "JPY" ? "〜¥2,000" : "〜$13", test: (jpy) => jpy < 2000 },
    mid: { label: displayCur === "JPY" ? "¥2,000〜3,000" : "$13〜20", test: (jpy) => jpy >= 2000 && jpy < 3000 },
    high: { label: displayCur === "JPY" ? "¥3,000〜" : "$20〜", test: (jpy) => jpy >= 3000 },
  };

  const PROCESSES = ["すべて", "Washed", "Natural", "Honey", "Anaerobic"];

  const filtered = useMemo(() => BEANS.filter((b) =>
    (origin === "すべて" || b.origin === origin) &&
    (statusF === "all" || b.status === statusF) &&
    (processF === "すべて" || b.process.includes(processF)) &&
    PRICE_BANDS[priceF].test(toJPY(b))
  ), [origin, statusF, priceF, processF, displayCur]);

  return (
    <div style={{ minHeight: "100vh", background: PAPER, fontFamily: `"Hiragino Kaku Gothic ProN", "Hiragino Sans", "Noto Sans JP", sans-serif`, color: INK }}>
      <style>{`
        @keyframes btTrackIn { from { letter-spacing: 0.8em; opacity: 0; } to { letter-spacing: 0.35em; opacity: 1; } }
        @keyframes btLineGrow { from { width: 0; } to { width: 180px; } }
        @keyframes btFadeUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        @keyframes btFadeOut { from { opacity: 1; } to { opacity: 0; } }
        @keyframes btSheetUp { from { transform: translateY(100%); } to { transform: none; } }
        @keyframes btGridIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        .bt-mark { animation: btTrackIn 0.9s cubic-bezier(0.2, 0.7, 0.3, 1) both; }
        .bt-line { animation: btLineGrow 0.7s 0.5s cubic-bezier(0.2, 0.7, 0.3, 1) both; }
        .bt-tag { animation: btFadeUp 0.6s 0.9s ease both; }
        .bt-splash-out { animation: btFadeOut 0.6s ease both; }
        .bt-sheet { animation: btSheetUp 0.32s cubic-bezier(0.2, 0.7, 0.3, 1) both; }
        .bt-card { animation: btGridIn 0.45s ease backwards; transition: transform 0.15s cubic-bezier(0.2, 0.7, 0.3, 1); }
        .bt-card:active { transform: scale(0.955); }
        @keyframes btPkgIn { from { opacity: 0; transform: scale(0.9) translateY(4px); } to { opacity: 1; transform: none; } }
        .bt-detail-pkg { animation: btPkgIn 0.4s 0.08s cubic-bezier(0.2, 0.7, 0.3, 1) backwards; }
        .bt-detail-info { animation: btFadeUp 0.4s 0.16s ease backwards; }
        @keyframes btDotIn { 0% { opacity: 0; transform: scale(0); } 70% { transform: scale(1.25); } 100% { opacity: 1; transform: scale(1); } }
        @keyframes btFloat { from { transform: translateY(-1.5px); } to { transform: translateY(1.5px); } }
        .bt-dot { animation: btDotIn 0.5s cubic-bezier(0.2, 0.7, 0.3, 1) backwards; }
        .bt-dot-core { animation: btFloat 2.4s ease-in-out infinite alternate; }
        .bt-dot-sel { animation: none; }
        @keyframes btBarGrow { from { width: 0; } }
        .bt-bar { animation: btBarGrow 0.8s cubic-bezier(0.2, 0.7, 0.3, 1) backwards; }
        @keyframes btLivePulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.25; } }
        .bt-live { animation: btLivePulse 1.6s ease-in-out infinite; }
      `}</style>
      {!splashGone && <Splash done={splashDone} />}
      {/* ヘッダー */}
      <header style={{ position: "sticky", top: 0, zIndex: 40, background: PAPER, borderBottom: `2px solid ${INK}` }}>
        <div style={{ maxWidth: 640, margin: "0 auto", padding: "14px 16px 10px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div style={{ fontWeight: 800, fontSize: 17, letterSpacing: "0.12em" }}>BEAN&nbsp;TRACKER</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ display: "flex", border: `1px solid ${INK}`, borderRadius: 6, overflow: "hidden" }}>
                {[["JPY", "¥"], ["USD", "$"]].map(([k, sym]) => (
                  <button key={k} onClick={() => setDisplayCur(k)}
                    style={{
                      padding: "3px 10px", border: "none", cursor: "pointer",
                      fontFamily: "ui-monospace, monospace", fontSize: 11, fontWeight: 700,
                      background: displayCur === k ? INK : "transparent",
                      color: displayCur === k ? PAPER : INK,
                    }}>{sym}</button>
                ))}
              </div>
              <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 9, color: GRAY }}>v0.1</div>
            </div>
          </div>
          <div style={{ fontSize: 10, color: GRAY, marginTop: 2 }}>世界中のコーヒー豆に辿り着くためのインフラ</div>
          <div style={{ display: "flex", gap: 16, marginTop: 10, overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
            {[["zukan", "図鑑"], ["map", "地球"], ["shindan", "診断"], ["flavor", "味わい"], ["geisha", "レアロット"]].map(([k, l]) => (
              <button key={k} onClick={() => setView(k)}
                style={{
                  background: "none", border: "none", padding: "0 0 6px", cursor: "pointer",
                  fontSize: 12.5, letterSpacing: "0.12em", whiteSpace: "nowrap", flexShrink: 0,
                  color: view === k || (k === "zukan" && view === "roaster") ? INK : GRAY,
                  fontWeight: view === k || (k === "zukan" && view === "roaster") ? 700 : 400,
                  borderBottom: view === k || (k === "zukan" && view === "roaster") ? `2px solid ${INK}` : "2px solid transparent",
                }}>{l}</button>
            ))}
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 640, margin: "0 auto", padding: "16px 16px 60px" }}>
        {view === "roaster" && roasterId ? (
          <RoasterPage key={roasterId + roasterTab} rid={roasterId} initialTab={roasterTab} onOpen={setOpen} onBack={() => setView("zukan")} onRoaster={goRoaster} cur={displayCur} />
        ) : view === "map" ? (
          <GlobeView onRoaster={goRoaster} />
        ) : view === "shindan" ? (
          <DiagnosisView onRoaster={goRoaster} />
        ) : view === "flavor" ? (
          <FlavorMapView onOpen={setOpen} cur={displayCur} />
        ) : view === "geisha" ? (
          <GeishaView onOpen={setOpen} onRoaster={goRoaster} cur={displayCur} />
        ) : (
          <>
            {/* フィルタ */}
            <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, WebkitOverflowScrolling: "touch" }}>
              {ORIGINS.map((o) => (
                <button key={o} onClick={() => setOrigin(o)}
                  style={{
                    flexShrink: 0, padding: "6px 12px", borderRadius: 999, fontSize: 11.5, cursor: "pointer",
                    border: `1px solid ${origin === o ? INK : LINE}`,
                    background: origin === o ? INK : "transparent",
                    color: origin === o ? PAPER : INK,
                  }}>{o}</button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingTop: 8, paddingBottom: 4, WebkitOverflowScrolling: "touch" }}>
              {Object.entries(PRICE_BANDS).map(([k, band]) => (
                <button key={k} onClick={() => setPriceF(k)}
                  style={{
                    flexShrink: 0, padding: "5px 11px", borderRadius: 999, fontSize: 11, cursor: "pointer",
                    fontFamily: "ui-monospace, monospace",
                    border: `1px solid ${priceF === k ? INK : LINE}`,
                    background: priceF === k ? INK : "transparent",
                    color: priceF === k ? PAPER : GRAY,
                  }}>{band.label}</button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingTop: 6, paddingBottom: 4, WebkitOverflowScrolling: "touch" }}>
              {PROCESSES.map((p) => (
                <button key={p} onClick={() => setProcessF(p)}
                  style={{
                    flexShrink: 0, padding: "5px 11px", borderRadius: 999, fontSize: 11, cursor: "pointer",
                    fontFamily: p === "すべて" ? "inherit" : "ui-monospace, monospace",
                    letterSpacing: p === "すべて" ? 0 : "0.04em",
                    border: `1px solid ${processF === p ? GREEN : LINE}`,
                    background: processF === p ? GREEN : "transparent",
                    color: processF === p ? PAPER : GRAY,
                  }}>{p === "すべて" ? "全精製" : p}</button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 14, marginTop: 12, borderBottom: `1px solid ${LINE}`, paddingBottom: 8 }}>
              {[["all", "すべて"], ["now", "NOW"], ["sold", "SOLD OUT"], ["archive", "ARCHIVE"]].map(([k, l]) => (
                <button key={k} onClick={() => setStatusF(k)}
                  style={{
                    background: "none", border: "none", padding: 0, cursor: "pointer",
                    fontFamily: "ui-monospace, monospace", fontSize: 10.5, letterSpacing: "0.05em",
                    color: statusF === k ? INK : GRAY, fontWeight: statusF === k ? 700 : 400,
                    borderBottom: statusF === k ? `2px solid ${INK}` : "2px solid transparent", paddingBottom: 6,
                  }}>{l}</button>
              ))}
              <div style={{ marginLeft: "auto", fontFamily: "ui-monospace, monospace", fontSize: 10, color: GRAY, alignSelf: "center" }}>{filtered.length} 銘柄</div>
            </div>
            {statusF === "archive" ? (
              /* ARCHIVE: ロースターを選んで歴代ポートフォリオへ */
              <div style={{ marginTop: 18 }}>
                <div style={{ fontSize: 11, color: GRAY, marginBottom: 12 }}>
                  ロースターを選ぶと、その店の歴代ポートフォリオが開きます。
                </div>
                {Object.entries(ROASTERS).map(([rid, r]) => {
                  const arc = BEANS.filter((b) => b.r === rid && b.status === "archive");
                  if (arc.length === 0) return null;
                  const years = arc.map((b) => Number(b.year));
                  return (
                    <button key={rid} onClick={() => goRoaster(rid, "archive")}
                      style={{
                        display: "flex", alignItems: "center", width: "100%", gap: 12,
                        background: "none", border: "none", borderTop: `1px solid ${LINE}`,
                        padding: "14px 2px", cursor: "pointer", textAlign: "left",
                      }}>
                      {/* ミニ標本プレビュー */}
                      <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
                        {arc.slice(0, 3).map((b) => (
                          <div key={b.id} style={{ width: 20, height: 27, borderRadius: 2, background: b.color, filter: "grayscale(0.55)", opacity: 0.85 }} />
                        ))}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: INK }}>{r.name}</div>
                        <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, color: GRAY, marginTop: 2 }}>
                          {Math.min(...years)}–{Math.max(...years)} / {arc.length} 銘柄
                        </div>
                      </div>
                      <span style={{ color: GRAY, fontSize: 14 }}>→</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <>
                {/* グリッド図鑑 */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 16, marginTop: 18 }}>
                  {filtered.map((b) => <BeanCard key={b.id} bean={b} onOpen={setOpen} onRoaster={goRoaster} cur={displayCur} />)}
                </div>
                {filtered.length === 0 && (
                  <div style={{ textAlign: "center", color: GRAY, fontSize: 12, padding: "50px 0" }}>該当する豆がありません。フィルタを変えてみてください。</div>
                )}
              </>
            )}
            {/* フッター注記 */}
            <div style={{ marginTop: 36, borderTop: `1px solid ${LINE}`, paddingTop: 14, fontSize: 10.5, color: GRAY, lineHeight: 1.7 }}>
              パッケージは実画像の代わりの試作表示です。実装では巡回システムが取得した実際のパッケージ画像が入ります。
              評価機能はありません — この図鑑は探して辿り着くためのインフラです。 為替レートは試作用の固定値です（実装では日次取得）。
            </div>
          </>
        )}
      </main>

      <DetailSheet bean={open} onClose={() => setOpen(null)} onRoaster={goRoaster} cur={displayCur} />
    </div>
  );
}
