// 配色パレットと在庫ステータスの表示定義
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
