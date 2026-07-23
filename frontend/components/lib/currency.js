// 為替（対円）・価格フォーマッタ・ライブレート取得
/* 為替（対円）— 既定は固定値。起動時にライブ値を取得して上書きし、
   一定間隔＋タブ復帰時に再取得して変動を自動反映する。 */
export const FX_CURRENCIES = ["USD", "NOK", "DKK", "EUR", "AUD", "GBP", "SEK", "CAD", "NZD", "SGD", "ISK", "KRW", "HKD", "THB", "CNY", "IDR", "MYR", "PHP", "INR", "BRL", "MXN", "ZAR", "TRY", "CZK", "CHF", "PLN", "HUF", "ILS"];
export const FX_DEFAULT = { JPY: 1, USD: 150, NOK: 14.5, DKK: 22, EUR: 165, AUD: 100, GBP: 195, SEK: 14, CAD: 108, NZD: 90, SGD: 112, ISK: 1.1, KRW: 0.11, HKD: 19, THB: 4.3, CNY: 21, TWD: 4.7, VND: 0.006, IDR: 0.0092, MYR: 33, PHP: 2.6, INR: 1.8, COP: 0.037, BRL: 27, MXN: 8.3, CRC: 0.29, ZAR: 8.2, ETB: 1.25, KES: 1.15, RWF: 0.11, AED: 41, TRY: 3.75, CZK: 6.8, CHF: 185, PLN: 41, HUF: 0.43, PEN: 40, GTQ: 19.5, SAR: 40, ILS: 40 };
export const RATES_TO_JPY = { ...FX_DEFAULT };
export const CUR_SYMBOL = { JPY: "¥", USD: "$", NOK: "kr ", DKK: "kr ", EUR: "€", AUD: "A$", GBP: "£", SEK: "kr ", CAD: "C$", NZD: "NZ$", SGD: "S$", ISK: "kr ", KRW: "₩", HKD: "HK$", THB: "฿", CNY: "CN¥", TWD: "NT$", VND: "₫", IDR: "Rp ", MYR: "RM ", PHP: "₱", INR: "₹", COP: "$", BRL: "R$", MXN: "MX$", CRC: "₡", ZAR: "R ", ETB: "Br ", KES: "KSh ", RWF: "FRw ", AED: "AED ", TRY: "₺", CZK: "Kč ", CHF: "CHF ", PLN: "zł ", HUF: "Ft ", PEN: "S/ ", GTQ: "Q", SAR: "SR ", ILS: "₪" };

/* ライブ為替の取得（キー不要・CORS対応の無料APIを順に試す）。
   返り値は「1通貨あたり何円か」= 対円レート。失敗時は例外。 */
export async function fetchLiveRates() {
  // 1) Frankfurter（ECBデータ）。base=JPY で各通貨レートを得て逆数化。
  try {
    const res = await fetch(
      `https://api.frankfurter.app/latest?base=JPY&symbols=${FX_CURRENCIES.join(",")}`,
      { cache: "no-store" }
    );
    if (res.ok) {
      const data = await res.json();
      const raw = (data && data.rates) || {};
      const out = { JPY: 1 };
      for (const c of FX_CURRENCIES) {
        const v = Number(raw[c]);
        if (v > 0) out[c] = 1 / v;
      }
      if (Object.keys(out).length > 1) return { rates: out, date: data.date, source: "Frankfurter (ECB)" };
    }
  } catch {}
  // 2) フォールバック: open.er-api.com（base=JPY, rates は JPY→各通貨）。
  const res2 = await fetch("https://open.er-api.com/v6/latest/JPY", { cache: "no-store" });
  if (!res2.ok) throw new Error(`fx http ${res2.status}`);
  const data2 = await res2.json();
  const raw2 = (data2 && data2.rates) || {};
  const out2 = { JPY: 1 };
  for (const c of FX_CURRENCIES) {
    const v = Number(raw2[c]);
    if (v > 0) out2[c] = 1 / v;
  }
  if (Object.keys(out2).length <= 1) throw new Error("fx empty");
  const date = data2.time_last_update_utc ? new Date(data2.time_last_update_utc).toISOString().slice(0, 10) : null;
  return { rates: out2, date, source: "open.er-api.com" };
}

export function toJPY(bean) { return bean.amount * RATES_TO_JPY[bean.cur]; }
export function fmtPrice(bean, disp) {
  const jpy = toJPY(bean);
  if (disp === "JPY") return `¥${Math.round(jpy).toLocaleString()}`;
  return `$${(jpy / RATES_TO_JPY.USD).toFixed(2)}`;
}
export function perGrams(bean) {
  if (bean.per.endsWith("oz")) return Math.round(parseFloat(bean.per) * 28.35);
  return parseInt(bean.per);
}
export function fmtLocal(bean) {
  return `${CUR_SYMBOL[bean.cur]}${bean.amount.toLocaleString()}${bean.cur !== "JPY" && bean.cur !== "USD" ? ` ${bean.cur}` : ""}`;
}
