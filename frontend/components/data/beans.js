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

const seedBeans = [...nordicBeans, ...ukBeans, ...europeBeans, ...northAmericaBeans, ...oceaniaBeans, ...eastAsiaBeans, ...seAsiaIndiaBeans, ...latinAmericaBeans, ...africaMideastBeans];

// 巡回実データがあるロースターは、そのロースターの種の豆を実データで置き換える
const liveKeys = new Set(LIVE_BEANS.map((b) => b.r));
export const BEANS = [...seedBeans.filter((b) => !liveKeys.has(b.r)), ...LIVE_BEANS];
