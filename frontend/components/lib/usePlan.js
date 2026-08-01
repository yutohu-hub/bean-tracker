"use client";
// プラン状態を全画面で1つに保つ。
// 画面ごとに useEffect で読みに行くと、レアロットは無料・マイページはプレミアム、
// のようにズレる。購読者を1か所に集めて、確定したら全員に配る。

import { useEffect, useState } from "react";
import { cachedPlan, resolvePlan, isPremiumPlan, limitsFor, FREE_PLAN } from "./entitlements";

let current = FREE_PLAN;
let started = false;
let inflight = null;
const subs = new Set();

function publish(p) {
  current = p;
  subs.forEach((fn) => { try { fn(p); } catch {} });
}

// 権威に問い合わせて全員に配る。同時に複数画面から呼ばれても1回にまとめる。
export function refreshPlan() {
  if (!inflight) {
    inflight = resolvePlan()
      .then((p) => { publish(p); return p; })
      .catch(() => current)
      .finally(() => { inflight = null; });
  }
  return inflight;
}

export function usePlan() {
  const [plan, setPlan] = useState(current);
  // 初回は端末の写しで即座に描き、その裏で権威に確認して差し替える。
  // 起動のたびに全画面が「無料」で一瞬光るのを避けるため。
  const [checked, setChecked] = useState(started);

  useEffect(() => {
    subs.add(setPlan);
    if (!started) {
      started = true;
      publish(cachedPlan());
      refreshPlan().finally(() => setChecked(true));
    } else {
      setPlan(current);
      setChecked(true);
    }
    return () => subs.delete(setPlan);
  }, []);

  return { plan, premium: isPremiumPlan(plan), limits: limitsFor(plan), checked };
}
