/* 記録が失われないことを確かめる。
 *
 *   node tests/test_store.mjs
 *
 * ■ なぜ要るのか
 *
 * 記録はこの図鑑で唯一「その人しか持っていないデータ」で、失うと取り返せない。
 * それなのに、記録の置き場所は「いまログインしているか」で名前が変わる仕組みで、
 * ログイン・ログアウト・別アカウント・同期・削除が絡むと壊れやすい。
 * 画面を見ても「消えた」のか「別の引き出しに入っている」のか区別がつかないので、
 * 起きうる筋道をここで一つずつ踏む。
 *
 * 下の5つは、どれも実際に起きていたもの。直す前に、この筋道で再現させてから直した。
 */
import assert from "node:assert/strict";

class FakeStorage {
  constructor() { this.m = new Map(); }
  get length() { return this.m.size; }
  key(i) { return [...this.m.keys()][i]; }
  getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { this.m.set(k, String(v)); }
  removeItem(k) { this.m.delete(k); }
}
global.localStorage = new FakeStorage();
Object.defineProperty(global, "navigator", { value: {}, configurable: true });

const store = await import("../frontend/components/lib/store.js");

const signIn = (uid) => localStorage.setItem("bt_session", JSON.stringify({ access_token: "t", user: { id: uid } }));
const signOut = () => localStorage.removeItem("bt_session");
const names = () => store.getTastings().map((t) => t.name).sort();
const drawers = () => [...localStorage.m.keys()].filter((k) => k.startsWith("bt_tastings"));

let ng = 0;
function check(title, fn) {
  try { fn(); console.log(`✓ ${title}`); }
  catch (e) { console.log(`✗ ${title}\n    ${e.message.split("\n")[0]}`); ng++; }
}

check("ログアウトしても、入り直せば記録は戻る", () => {
  localStorage.m.clear();
  signIn("A");
  store.upsertTasting({ beanId: 1, name: "豆1" });
  store.upsertTasting({ beanId: 2, name: "豆2" });
  signOut();
  assert.deepEqual(names(), [], "ログアウト中に他人の記録が見えてはいけない");
  signIn("A");
  assert.deepEqual(names(), ["豆1", "豆2"]);
});

check("ログアウト中に足した記録は、次にログインした人へ引き継がれる", () => {
  localStorage.m.clear();
  signIn("A");
  store.upsertTasting({ beanId: 1, name: "豆1" });
  signOut();
  store.upsertTasting({ beanId: 3, name: "ログアウト中の豆" });
  signIn("A");
  assert.deepEqual(names(), ["ログアウト中の豆", "豆1"]);
  // 引き出しは1つだけ。写して残すと、匿名側に足したぶんが二度と出てこなくなる
  assert.deepEqual(drawers(), ["bt_tastings:A"], `引き出しが複数ある: ${drawers()}`);
});

check("別のアカウントには、前の人の記録が混ざらない", () => {
  localStorage.m.clear();
  signIn("A");
  store.upsertTasting({ beanId: 1, name: "Aの豆" });
  signIn("B");
  assert.deepEqual(names(), []);
  store.upsertTasting({ beanId: 9, name: "Bの豆" });
  signIn("A");
  assert.deepEqual(names(), ["Aの豆"]);
});

check("消した記録は、同期で取ってきても復活しない", () => {
  localStorage.m.clear();
  signIn("A");
  store.upsertTasting({ beanId: 10, name: "消す豆" });
  store.removeTasting(10);
  // クラウドにはまだ消す前の行が残っている状態
  store.mergeTastings([{ beanId: 10, name: "消す豆", at: Date.now() - 1000, updatedAt: Date.now() - 1000 }]);
  assert.deepEqual(names(), []);
  // 消したことは、向こうへ伝えるまで覚えておく
  assert.deepEqual(store.getTombstones().map((d) => d.beanId), [10]);
  store.clearTombstones([10]);
  assert.deepEqual(store.getTombstones(), []);
});

check("消したあとに向こうで書き直された記録は、ちゃんと戻ってくる", () => {
  localStorage.m.clear();
  signIn("A");
  store.upsertTasting({ beanId: 11, name: "古い名前" });
  store.removeTasting(11);
  store.mergeTastings([{ beanId: 11, name: "別の端末で書き直した", at: Date.now(), updatedAt: Date.now() + 5000 }]);
  assert.deepEqual(names(), ["別の端末で書き直した"]);
});

check("評価を直しても、飲んだ日は動かない", () => {
  localStorage.m.clear();
  signIn("A");
  const jan = new Date("2026-01-15T00:00:00Z").getTime();
  store.upsertTasting({ beanId: 20, name: "1月の豆", rating: 3, at: jan });
  assert.equal(store.getTasting(20).at, jan);
  store.upsertTasting({ beanId: 20, name: "1月の豆", rating: 5 });
  assert.equal(store.getTasting(20).at, jan, "飲んだ日が書き換わっている");
  assert.equal(store.getTasting(20).rating, 5);
  assert.ok(store.getTasting(20).updatedAt > jan, "直した時刻は別に持つ");
});

check("同期で古い写しを取り込んでも、直した内容は上書きされない", () => {
  localStorage.m.clear();
  signIn("A");
  const jan = new Date("2026-01-15T00:00:00Z").getTime();
  store.upsertTasting({ beanId: 30, name: "豆", rating: 5, at: jan });   // いま直した
  store.mergeTastings([{ beanId: 30, name: "豆", rating: 1, at: jan, updatedAt: jan }]);  // 古い写し
  assert.equal(store.getTasting(30).rating, 5);
});

check("保存できなかったときは、黙って捨てずに知らせる", () => {
  localStorage.m.clear();
  signIn("A");
  const real = localStorage.setItem.bind(localStorage);
  localStorage.setItem = () => { throw new Error("QuotaExceededError"); };
  // 失敗しても必ず元に戻す。戻さないと、この壊れた setItem が次のテストまで効く
  try {
    assert.throws(() => store.upsertTasting({ beanId: 40, name: "入らない豆" }), /保存できませんでした/);
  } finally { localStorage.setItem = real; }
});

check("ログアウト中でも、この端末に何件しまってあるかは言える", () => {
  localStorage.m.clear();
  signIn("A");
  store.upsertTasting({ beanId: 1, name: "豆1" });
  store.upsertTasting({ beanId: 2, name: "豆2" });
  signOut();
  assert.deepEqual(names(), []);
  assert.equal(store.keptTastingCount(), 2, "0件の画面だけ見せると「消えた」と思わせる");
});

/* 豆番号の付け替え（昔の番号 → key から作った番号）。
   クラウドの行は bean_id が鍵なので、こちらで番号を変えても向こうには
   昔の番号の行が残る。取り込むと同じ豆が2件に並ぶ。実際に再現した。 */
check("番号を付け替えても、同じ豆が2件に増えない", () => {
  localStorage.m.clear();
  signIn("A");
  store.upsertTasting({ beanId: 100001, name: "Kenya Karatina AA", rating: 5, at: 1750000000000 });
  store.applyRelink([{ from: 100001, to: 2020077693920 }]);
  assert.deepEqual(store.getTastings().map((t) => t.beanId), [2020077693920]);
  // 次の同期で、クラウドに残っていた昔の番号の行が返ってくる
  store.mergeTastings([{ beanId: 100001, name: "Kenya Karatina AA", rating: 5, at: 1750000000000 }]);
  assert.deepEqual(store.getTastings().map((t) => t.beanId), [2020077693920],
    "昔の番号の行が復活して、同じ豆が2件に並んでいる");
});

check("付け替えたら、昔の番号をクラウドからも消せるようにする", () => {
  localStorage.m.clear();
  signIn("A");
  store.upsertTasting({ beanId: 100002, name: "豆", rating: 4 });
  store.applyRelink([{ from: 100002, to: 3007400960121 }]);
  // 同期はこの墓標を見て、向こうの行を消しにいく
  assert.deepEqual(store.getTombstones().map((d) => d.beanId), [100002]);
});

check("付け替えても、評価もメモも飲んだ日も残る", () => {
  localStorage.m.clear();
  signIn("A");
  store.upsertTasting({ beanId: 100003, name: "豆", rating: 5, notes: "ベリー", at: 1700000000000 });
  const before = store.getTastings()[0];
  store.applyRelink([{ from: 100003, to: 3844799830686 }]);
  const after = store.getTastings()[0];
  assert.equal(after.beanId, 3844799830686);
  assert.equal(after.rating, before.rating);
  assert.equal(after.notes, before.notes);
  assert.equal(after.at, before.at, "飲んだ日が動くと、カレンダーも一覧も別の日になる");
  assert.equal(after.updatedAt, before.updatedAt,
    "直した時刻が動くと、他の端末で直した内容を巻き戻す");
});

check("付け替えるものが無ければ、何も触らない", () => {
  localStorage.m.clear();
  signIn("A");
  store.upsertTasting({ beanId: 2020077693920, name: "豆", rating: 5 });
  assert.equal(store.applyRelink([]), 0);
  assert.equal(store.applyRelink(null), 0);
  assert.deepEqual(store.getTombstones(), [], "無関係な墓標を作ってはいけない");
});

if (ng) { console.log(`\n★ ${ng} 件おかしい。記録が失われる筋道が残っている。`); process.exit(1); }
console.log("\n記録の出入りは、すべて期待どおり。");
