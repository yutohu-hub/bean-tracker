// 配色パレット・文字の大きさ・在庫ステータスの表示定義

/* 文字の大きさ。
 *
 * ここに集める前は、指定が 450 か所あって大きさが 24 種類（8px〜26px）あった。
 * 階段ではなく、その場その場で決めた結果の寄せ集めで、9.5px と 10px と 10.5px が
 * 隣り合って並んでいた。読む側にはこの差は伝わらず、作る側は次に何を選べばいいか
 * 分からない。
 *
 * いちばん小さいのは 11px にした。実測で 8px が 54 か所、9px が 61 か所あり、
 * そこに値段やロースター名が入っていた。携帯で 8px は読めない
 * （iOS の目安も 11pt 以上）。
 *
 * 5段。迷ったら1つ上か下を選ぶ。ここに無い大きさは足さない。 */
export const FS = {
  meta: 11,   // 状態・単位・注記など、本文に添える文字。これより小さくしない
  body: 13,   // 本文
  lead: 15,   // 強めの本文・小見出し
  head: 19,   // 見出し
  title: 24,  // 画面の題
};

export const INK = "#17150F";
export const PAPER = "#FAFAF7";
export const GRAY = "#8A857B";
export const LINE = "#E4E1D8";
export const GREEN = "#2F5233";
export const AMBER = "#A87B2E";

export const STATUS = {
  now: { label: "NOW", jp: "在庫あり", dot: GREEN },
  sold: { label: "SOLD OUT", jp: "売り切れ", dot: AMBER },
  archive: { label: "ARCHIVE", jp: "記録", dot: GRAY },
};
