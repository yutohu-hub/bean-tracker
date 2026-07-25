import { LegalShell, Fill, H } from "@/components/legal/LegalShell";

export const metadata = { title: "特定商取引法に基づく表記 — BEAN TRACKER" };

const row = { borderTop: "1px solid #E4E1D8", verticalAlign: "top" };
const th = { textAlign: "left", padding: "10px 12px 10px 0", width: 150, color: "#8A857B", fontWeight: 700, fontSize: 12.5 };
const td = { padding: "10px 0" };

export default function Page() {
  return (
    <LegalShell title="特定商取引法に基づく表記" updated="2026-07-25">
      <div style={{ background: "#FFF9E6", border: "1px solid #F0E0A0", borderRadius: 8, padding: "12px 14px", fontSize: 12, lineHeight: 1.8, marginBottom: 18 }}>
        ⚠️ 公開前に、黄色の【要記入】箇所をすべて実際の情報に置き換えてください。ここが未記入のままの有料販売は特定商取引法に適合しません。
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <tbody>
          <tr style={row}><th style={th}>販売事業者名</th><td style={td}><Fill>事業者名（個人の場合は氏名）</Fill></td></tr>
          <tr style={row}><th style={th}>運営統括責任者</th><td style={td}><Fill>責任者氏名</Fill></td></tr>
          <tr style={row}><th style={th}>所在地</th><td style={td}><Fill>住所</Fill>（請求があった場合は遅滞なく開示します）</td></tr>
          <tr style={row}><th style={th}>電話番号</th><td style={td}><Fill>電話番号</Fill>（請求があった場合は遅滞なく開示します）</td></tr>
          <tr style={row}><th style={th}>メールアドレス</th><td style={td}><Fill>連絡先メール</Fill></td></tr>
          <tr style={row}><th style={th}>販売URL</th><td style={td}>https://yutohu-hub.github.io/bean-tracker/</td></tr>
          <tr style={row}><th style={th}>販売価格</th><td style={td}>PREMIUM 月額プラン ¥480（税込）／ 年額プラン ¥4,800（税込）。各ページに表示します。</td></tr>
          <tr style={row}><th style={th}>商品代金以外の必要料金</th><td style={td}>インターネット接続料・通信料等はお客様のご負担となります。</td></tr>
          <tr style={row}><th style={th}>お支払い方法</th><td style={td}>クレジットカード決済（Stripe）</td></tr>
          <tr style={row}><th style={th}>お支払い時期</th><td style={td}>お申し込み時に決済。サブスクリプションは以降、契約期間（月/年）ごとに自動更新・自動決済されます。</td></tr>
          <tr style={row}><th style={th}>サービスの提供時期</th><td style={td}>決済完了後、ただちにプレミアム機能をご利用いただけます。</td></tr>
          <tr style={row}><th style={th}>返品・キャンセル</th><td style={td}>デジタルサービスの性質上、提供開始後のご返金はいたしかねます。サブスクリプションはいつでも解約でき、解約後は次回更新日以降の課金が停止します（日割り返金は行いません）。<Fill>返金/解約条件に調整があれば記載</Fill></td></tr>
          <tr style={row}><th style={th}>解約方法</th><td style={td}><Fill>解約手順（例: お客様ポータルのURL、または連絡先メールへの連絡）</Fill></td></tr>
          <tr style={row}><th style={th}>動作環境</th><td style={td}>最新のモダンブラウザ（Chrome / Safari / Firefox / Edge の最新版）を推奨します。</td></tr>
        </tbody>
      </table>
      <H>補足</H>
      <p style={{ margin: 0, color: "#8A857B", fontSize: 12 }}>
        本表記は雛形です。開業形態（個人/法人）や決済・解約フローの確定に合わせて、上記【要記入】欄と返金・解約条件を必ず見直してください。
      </p>
    </LegalShell>
  );
}
