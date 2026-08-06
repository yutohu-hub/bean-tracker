// eslint の設定。.json ではなく .js にしているのは、なぜその判断なのかを
// ルールの隣に書き残すため（.json はコメントを書けない）。

module.exports = {
  extends: "next/core-web-vitals",
  rules: {
    // 使っていない変数・引数は消す。残すなら _ で始める（意図が読める）
    "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],

    // next/image は使わない。output: export で書き出していて最適化サーバが無く、
    // next.config.mjs でも images.unoptimized を立てている。さらに味の記録の写真は
    // IndexedDB から読む data: URL で、next/image が扱えない。
    // 素の <img> が正しい選択なので、この警告は出さない。
    "@next/next/no-img-element": "off",
  },
};
