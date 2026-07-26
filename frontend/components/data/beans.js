// 豆データを地域別に分類して統合するインデックス
// 追加時は該当地域の components/data/beans/<地域>.js を編集する
import { nordicBeans } from "./beans/nordic";
import { ukBeans } from "./beans/uk";
import { europeBeans } from "./beans/europe";
import { northAmericaBeans } from "./beans/northAmerica";
import { oceaniaBeans } from "./beans/oceania";
import { eastAsiaBeans } from "./beans/eastAsia";
import { seAsiaIndiaBeans } from "./beans/seAsiaIndia";
import { latinAmericaBeans } from "./beans/latinAmerica";
import { africaMideastBeans } from "./beans/africaMideast";

import { LIVE_BEANS } from "./live";
import { isCoffeeBean, isWholesale } from "../lib/isCoffee";

const seedBeans = [...nordicBeans, ...ukBeans, ...europeBeans, ...northAmericaBeans, ...oceaniaBeans, ...eastAsiaBeans, ...seAsiaIndiaBeans, ...latinAmericaBeans, ...africaMideastBeans];

// 巡回実データはコーヒー豆以外（サブスク・器具・ミルク等）や業務用/卸(1kg以上)を含むため除外する
const liveBeans = LIVE_BEANS.filter((b) => isCoffeeBean(b) && !isWholesale(b));
// 巡回実データがあるロースターは、そのロースターの種の豆を実データで置き換える
const liveKeys = new Set(liveBeans.map((b) => b.r));
export const BEANS = [...seedBeans.filter((b) => !liveKeys.has(b.r)), ...liveBeans];
