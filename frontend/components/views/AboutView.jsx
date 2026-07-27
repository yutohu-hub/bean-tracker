"use client";
import { useState } from "react";
import { INK, PAPER, GRAY, LINE } from "../lib/theme";

const HOWTO = [
  ["図鑑", "世界中の豆をパッケージ図鑑で一覧。精製方法で色分けし、100g換算で価格を比較できます。"],
  ["地球", "本物の地球儀でロースターの所在地を表示。タップでECや Google マップへ。"],
  ["診断", "いくつかの質問と、あなたの「味の記録」をAIが分析して、相性の良いロースターを提案します。"],
  ["味わい", "いま買える豆を、明るさ×個性の座標にマッピング。系統で絞り込めます。"],
  ["レアロット", "ゲイシャ・シドラ・COE入賞ロットなど、少量で消えていく希少な豆を追跡。"],
  ["マイページ", "飲んだ味の記録、診断の記録、通知・プレミアムをまとめて管理。"],
];

const ARTICLES = [
  {
    t: "精製方法で色分けする理由",
    lead: "Washed / Natural / Honey / Anaerobic — 味の方向性は「精製」で大きく変わります。",
    body: [
      "コーヒーの果実から種子（生豆）を取り出す工程を「精製（プロセス）」と呼びます。同じ農園・品種でも、精製が違えば味は別物になります。",
      "・Washed（水洗）：果肉を除いてから発酵・乾燥。クリーンで明るい酸味、輪郭がはっきり。",
      "・Natural（ナチュラル）：果実ごと乾燥。ベリーや完熟果実のような甘さと個性。",
      "・Honey（ハニー）：粘液質を残して乾燥。washedとnaturalの中間、まろやかな甘み。",
      "・Anaerobic（嫌気性発酵）：酸素を遮断して発酵。ワインやトロピカルな独特の風味。",
      "図鑑ではこの精製方法でカードの色を統一しています。色を見るだけで味の方向性の当たりがつけられます。",
    ],
  },
  {
    t: "価格は「100gあたり」で比べる",
    lead: "¥1,800/150g と ¥2,640/250g、どちらが割安？— 単位を揃えないと比べられません。",
    body: [
      "ロースターごとに内容量（150g / 200g / 250g / 12oz …）はバラバラです。袋の値段だけでは高い/安いを判断できません。",
      "そこで図鑑では、すべての豆を「100gあたりの円換算価格」に正規化して表示・並び替えできるようにしています。",
      "さらに ¥3,000–5,000/100g、¥5,000+/100g といった上位価格帯は専用色で色分け。ハイエンドなロットがひと目で分かります。",
    ],
  },
  {
    t: "レアロットとは：ゲイシャ・シドラ・COE",
    lead: "少量で、すぐ消える。希少ロットだけを追いかけるタブ。",
    body: [
      "・ゲイシャ（Geisha/Gesha）：華やかな花・柑橘の香りで世界的に評価される品種。オークションで高値がつくことも。",
      "・シドラ（Sidra）：近年注目の品種。クリーンで甘く、複雑なアロマ。",
      "・COE（Cup of Excellence）：生産国ごとに開催される品評会。入賞ロットは品質の証で、数量も限られます。",
      "レアロットタブでは、いま世界で買えるこれらのロットを在庫の安い順に追跡します（無料は各10銘柄、プレミアムは30銘柄まで）。",
    ],
  },
  {
    t: "毎日更新される図鑑",
    lead: "巡回システムが公式ECを毎日巡回し、在庫・価格・新着を反映していきます。",
    body: [
      "バックエンドの巡回クローラが、対象ロースターの公式ECを毎日正午（JST）にチェックし、在庫状況（NOW / SOLD OUT / ARCHIVE）や価格、新着ロットを検知します。",
      "検知した結果は図鑑に自動反映される仕組みを実装済みです。更新から24時間以内の豆には「NEW」バッジが付きます。",
      "※ 現在のデータには、店名・都市・ECドメインは実在ベース、価格や在庫・説明は代表値を含みます。巡回対象の拡大に伴い、順次実データへ置き換わります。",
    ],
  },
];

function Article({ a, open, onToggle }) {
  return (
    <div style={{ borderTop: `1px solid ${LINE}` }}>
      <button onClick={onToggle}
        style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, width: "100%", background: "none", border: "none", padding: "16px 2px", cursor: "pointer", textAlign: "left" }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: INK }}>{a.t}</div>
          <div style={{ fontSize: 11.5, color: GRAY, marginTop: 4, lineHeight: 1.6 }}>{a.lead}</div>
        </div>
        <span style={{ color: GRAY, fontSize: 18, flexShrink: 0, transform: open ? "rotate(45deg)" : "none", transition: "transform 0.2s ease" }}>＋</span>
      </button>
      {open && (
        <div style={{ padding: "0 2px 16px", display: "grid", gap: 8 }}>
          {a.body.map((p, i) => (
            <p key={i} style={{ margin: 0, fontSize: 12.5, color: INK, lineHeight: 1.9 }}>{p}</p>
          ))}
        </div>
      )}
    </div>
  );
}

export function AboutView({ onNavigate }) {
  const [open, setOpen] = useState(0);
  return (
    <div>
      {/* ヒーロー */}
      <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, letterSpacing: "0.22em", color: GRAY }}>ABOUT</div>
      <div style={{ fontSize: 22, fontWeight: 800, marginTop: 6, lineHeight: 1.35 }}>Find any bean, anywhere.</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: GRAY, marginTop: 6, lineHeight: 1.4 }}>Log your coffees, find your perfect cup.</div>

      <p style={{ fontSize: 17, fontWeight: 800, color: INK, lineHeight: 1.75, marginTop: 18, marginBottom: 0 }}>
        あなたが飲んできたコーヒーを記録し、<br />次の一杯を探す。
      </p>
      <p style={{ fontSize: 13.5, color: INK, lineHeight: 2.1, marginTop: 14, marginBottom: 0 }}>
        Bean Tracker は、世界中で販売されている、または過去に販売されていたコーヒー豆を記録していく、あなただけのコーヒー図鑑です。
        マイページでは、これまでに飲んだコーヒーを記録できます。
      </p>

      {/* 3つの問い */}
      <div style={{ marginTop: 22, padding: "18px 20px", borderLeft: `4px solid ${INK}`, background: "#F7F5EF", borderRadius: "0 12px 12px 0" }}>
        <div style={{ fontSize: 15, color: INK, lineHeight: 2.2, fontWeight: 700 }}>
          どこのロースターの豆だったのか。<br />
          どんな産地だったのか。<br />
          どんな味わいだったのか。
        </div>
      </div>

      <p style={{ fontSize: 13.5, color: INK, lineHeight: 2.1, marginTop: 18, marginBottom: 0 }}>
        記録を重ねていくことで、「自分は今まで、どんなコーヒーを飲んできたのか」、<br />
        そして「次はどんなコーヒーを飲んでみたいのか」が少しずつ見えてきます。
      </p>
      <p style={{ fontSize: 13.5, color: INK, lineHeight: 2.1, marginTop: 10, marginBottom: 0 }}>
        図鑑をめくるように、世界中のコーヒーを探してみてください。
      </p>

      {/* 評価は、あなたのためだけに */}
      <div style={{ marginTop: 32, padding: "22px", background: "#F2F0E9", borderRadius: 14 }}>
        <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, letterSpacing: "0.2em", color: GRAY }}>PRIVACY</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: INK, marginTop: 8, lineHeight: 1.5 }}>評価は、あなたのためだけに。</div>
        <p style={{ fontSize: 13, color: INK, lineHeight: 2.1, marginTop: 12, marginBottom: 0 }}>
          Bean Tracker では、あなたの評価を他の人が見ることはできません。
        </p>
        <p style={{ fontSize: 13, color: INK, lineHeight: 2.1, marginTop: 12, marginBottom: 0 }}>
          コーヒーの「おいしい」は、人によって違うから。<br />
          誰かにとって最高の一杯が、あなたにとって最高とは限りません。
        </p>
        <p style={{ fontSize: 13, color: INK, lineHeight: 2.1, marginTop: 12, marginBottom: 0 }}>
          だから、他人の評価に左右されるのではなく、自分自身の記憶と感覚を残すことを大切にしています。
          自分だけのコーヒーの歴史を、少しずつ作っていきましょう。
        </p>
      </div>

      {/* PREMIUM */}
      <div style={{ marginTop: 22, padding: "24px 22px", background: "#141210", color: PAPER, borderRadius: 16 }}>
        <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, letterSpacing: "0.24em", color: "#E4B84A" }}>PREMIUM</div>
        <div style={{ fontSize: 18, fontWeight: 800, marginTop: 8, lineHeight: 1.5 }}>希少なコーヒーを、誰よりも早く。</div>
        <p style={{ fontSize: 13, color: "#D8D2C6", lineHeight: 2.1, marginTop: 12, marginBottom: 0 }}>
          Premium では、希少豆や限定豆の入荷情報をいち早く受け取れます。
          気になる豆が入荷したら通知を受け取り、そのまま購入へ。
        </p>
        <p style={{ fontSize: 13, color: "#D8D2C6", lineHeight: 2.1, marginTop: 12, marginBottom: 0 }}>
          「飲んでみたい」と思った一杯を、逃さない。<br />
          あなたのコーヒー図鑑に、まだ見ぬ一杯を加えてみてください。
        </p>
      </div>

      {/* クロージング */}
      <div style={{ marginTop: 32, textAlign: "center" }}>
        <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "0.08em" }}>記録する。探す。出会う。</div>
        <p style={{ fontSize: 13, color: GRAY, lineHeight: 2, marginTop: 12, marginBottom: 0 }}>
          世界中のコーヒーから、<br />あなたにとっての「最高の一杯」を探してみてください。
        </p>
      </div>

      <div style={{ height: 1, background: LINE, marginTop: 32 }} />

      {/* 使い方 */}
      <div style={{ marginTop: 24 }}>
        <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, letterSpacing: "0.15em", color: GRAY }}>HOW IT WORKS</div>
        <div style={{ marginTop: 8 }}>
          {HOWTO.map(([t, d]) => (
            <div key={t} style={{ display: "flex", gap: 12, padding: "10px 0", borderTop: `1px solid ${LINE}` }}>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: INK, width: 78, flexShrink: 0 }}>{t}</div>
              <div style={{ fontSize: 12, color: GRAY, lineHeight: 1.7 }}>{d}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 記事 */}
      <div style={{ marginTop: 26 }}>
        <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, letterSpacing: "0.15em", color: GRAY }}>JOURNAL — 記事</div>
        <div style={{ marginTop: 6 }}>
          {ARTICLES.map((a, i) => (
            <Article key={a.t} a={a} open={open === i} onToggle={() => setOpen(open === i ? -1 : i)} />
          ))}
        </div>
      </div>

      <div style={{ marginTop: 26, padding: "14px 16px", border: `1px dashed ${LINE}`, borderRadius: 10, fontSize: 11, color: GRAY, lineHeight: 1.8 }}>
        BEAN TRACKER はプロトタイプです。掲載データは実在ロースターをベースに、価格・在庫・説明の一部を代表値で補っています。
        巡回システムの拡大に伴い、順次実データへ置き換わります。
      </div>
    </div>
  );
}
