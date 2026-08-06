// eslint の設定。.json ではなく .js にしているのは、なぜその判断なのかを
// ルールの隣に書き残すため（.json はコメントを書けない）。

module.exports = {
  extends: "next/core-web-vitals",

  // no-undef を効かせるために、どこで動くコードなのかを教える必要がある。
  // これが無いと window や console まで「未定義」と言われて使い物にならない。
  env: { browser: true, node: true, es2022: true },
  parserOptions: { ecmaVersion: 2022, sourceType: "module" },

  rules: {
    // 存在しない名前を書いたら止める。
    //
    // 2026-08-06、レアロットの画面が開かなくなった。
    //   const maxP = Math.max(...ladder.map(per100));   ← per100 はもう無い
    // 整理のときに per100( を per100JPY( へ文字列置換したが、括弧が続かない
    // map(per100) だけが取り残された。ビルドは通る（最初に描く画面には
    // 含まれないため）。この規則があれば書いた時点で分かる。
    "no-undef": "error",

    // 使っていない変数・引数は消す。残すなら _ で始める（意図が読める）
    "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],

    // next/image は使わない。output: export で書き出していて最適化サーバが無く、
    // next.config.mjs でも images.unoptimized を立てている。さらに味の記録の写真は
    // IndexedDB から読む data: URL で、next/image が扱えない。
    // 素の <img> が正しい選択なので、この警告は出さない。
    "@next/next/no-img-element": "off",
  },
};
