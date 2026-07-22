// 送客リンク（roaster の EC URL に utm パラメータを付与）
export function shopHref(roaster) {
  if (!roaster || !roaster.url) return null;
  const base = roaster.url.startsWith("http") ? roaster.url : "https://" + roaster.url;
  const sep = base.indexOf("?") === -1 ? "?" : "&";
  return base + sep + "utm_source=beantracker&utm_medium=referral&utm_campaign=go";
}
