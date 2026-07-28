// 送客リンク（roaster の EC URL に utm パラメータを付与）
export function shopHref(roaster) {
  if (!roaster || !roaster.url) return null;
  const base = roaster.url.startsWith("http") ? roaster.url : "https://" + roaster.url;
  const sep = base.indexOf("?") === -1 ? "?" : "&";
  return base + sep + "utm_source=beantracker&utm_medium=referral&utm_campaign=go";
}

// Google マップで店を開く（店名＋都市で検索。座標は都市レベルのため名称検索が正確）
export function mapHref(roaster) {
  if (!roaster) return null;
  const q = [roaster.name, (roaster.city || "").replace(/\s*\/\s*/g, " ")].filter(Boolean).join(" ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

// 更新から24時間以内なら NEW（巡回システムが bean.updatedAt を ISO/epoch で設定）
export function isNew(bean, now = Date.now()) {
  if (!bean || !bean.updatedAt) return false;
  const t = typeof bean.updatedAt === "number" ? bean.updatedAt : Date.parse(bean.updatedAt);
  if (isNaN(t)) return false;
  const diff = now - t;
  return diff < 24 * 60 * 60 * 1000 && diff >= -60 * 60 * 1000; // 直近24h（軽微な未来ズレ許容）
}

// 豆ダイレクト送客（EC の検索ページに豆名を渡して、その豆に直接辿り着けるようにする）
// Shopify は /search?q= が共通で使えるが、他プラットフォーム（STORES.jp 等）は
// 検索パスが異なるため、壊れたディープリンクを避けてトップページ送客にフォールバックする。
export function beanHref(roaster, bean) {
  if (!roaster || !roaster.url) return null;
  const raw = roaster.url.startsWith("http") ? roaster.url : "https://" + roaster.url;
  const utm = "utm_source=beantracker&utm_medium=referral&utm_campaign=go";
  // 実在を確認した商品ページのURLがあれば、検索フォールバックより優先して直リンクする
  if (bean && bean.link) {
    const sep = bean.link.indexOf("?") === -1 ? "?" : "&";
    return bean.link + sep + utm;
  }
  if (roaster.platform !== "Shopify") return shopHref(roaster); // トップへ安全に送客（utm付き）
  let origin;
  try { origin = new URL(raw).origin; } catch { origin = raw.replace(/\/+$/, ""); }
  const q = encodeURIComponent(bean && bean.name ? bean.name : "");
  return `${origin}/search?q=${q}&${utm}`;
}
