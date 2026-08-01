// 図鑑に並ぶ豆。手で確認した分（seedBeans）に巡回の実データを重ねる。
import { seedBeans } from "./seedBeans";
import { LIVE_BEANS } from "./live";
import { isCoffeeBean, isWholesale } from "../lib/isCoffee";

// 巡回実データはコーヒー豆以外（サブスク・器具・ミルク等）や業務用/卸(1kg以上)を含むため除外する
const liveBeans = LIVE_BEANS.filter((b) => isCoffeeBean(b) && !isWholesale(b));
// 巡回実データがあるロースターは、そのロースターの種の豆を実データで置き換える
const liveKeys = new Set(liveBeans.map((b) => b.r));
export const BEANS = [...seedBeans.filter((b) => !liveKeys.has(b.r)), ...liveBeans];
