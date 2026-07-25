// 巡回システムが生成する実データのオーバーレイ（scripts/build_frontend_data.py が更新）。
// 種データ(手書き)に対し、キー一致で豆を実データに置換し、新規店は追加する。
import gen from "./live.generated.json";

export const LIVE_ROASTERS = (gen && gen.roasters) || {};
export const LIVE_BEANS = (gen && gen.beans) || [];
