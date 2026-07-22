// ロースターを地域別に分類して統合するインデックス
// 追加時は該当地域の components/data/roasters/<地域>.js を編集する
import { nordic } from "./roasters/nordic";
import { uk } from "./roasters/uk";
import { europe } from "./roasters/europe";
import { northAmerica } from "./roasters/northAmerica";
import { oceania } from "./roasters/oceania";
import { eastAsia } from "./roasters/eastAsia";
import { seAsiaIndia } from "./roasters/seAsiaIndia";
import { latinAmerica } from "./roasters/latinAmerica";
import { africaMideast } from "./roasters/africaMideast";

// 地域ごとのまとまり（地図・地域フィルタ等で利用可能）
export const ROASTER_GROUPS = { nordic, uk, europe, northAmerica, oceania, eastAsia, seAsiaIndia, latinAmerica, africaMideast };

// 全ロースターを統合（キー衝突がないことが前提）
export const ROASTERS = { ...nordic, ...uk, ...europe, ...northAmerica, ...oceania, ...eastAsia, ...seAsiaIndia, ...latinAmerica, ...africaMideast };
