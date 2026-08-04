"use client";
// いま App Store 版のアプリの中で動いているかどうか。
//
// 見分けが要る理由は課金の規則にある。Apple は「アプリの中でデジタルな権利を
// 売るなら自社の課金を使え」と定めていて（App Store Review Guideline 3.1.1）、
// 外部の決済ページへ誘導すると審査で落ちる。手数料15〜30%を払って Apple の
// 課金を実装するか、アプリの中では売らないかの二択になる。
//
// ここでは後者を採る。アプリの中では申し込みボタンを出さず、
// 「すでに契約している人は、そのまま使える」状態にする。
// 豆を買うリンク（物理商品・外部EC）は 3.1.1 の対象外なので、そのまま出す。
//
// Capacitor は capacitor:// で始まる場所からページを開く。
// Web（ブラウザ・ホーム画面PWA）では常に false になる。

export function isNativeApp() {
  if (typeof window === "undefined") return false;
  if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
    return true;
  }
  return /^capacitor:/.test(window.location.protocol);
}
