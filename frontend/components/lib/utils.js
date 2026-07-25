// 送客リンク（roaster の EC URL に utm パラメータを付与）
export function shopHref(roaster) {
  if (!roaster || !roaster.url) return null;
  const base = roaster.url.startsWith("http") ? roaster.url : "https://" + roaster.url;
  const sep = base.indexOf("?") === -1 ? "?" : "&";
  return base + sep + "utm_source=beantracker&utm_medium=referral&utm_campaign=go";
}

// 豆ダイレクト送客（EC の検索ページに豆名を渡して、その豆に直接辿り着けるようにする）
export function beanHref(roaster, bean) {
  if (!roaster || !roaster.url) return null;
  const raw = roaster.url.startsWith("http") ? roaster.url : "https://" + roaster.url;
  let origin;
  try { origin = new URL(raw).origin; } catch { origin = raw.replace(/\/+$/, ""); }
  const q = encodeURIComponent(bean && bean.name ? bean.name : "");
  return `${origin}/search?q=${q}&utm_source=beantracker&utm_medium=referral&utm_campaign=go`;
}
