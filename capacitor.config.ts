import type { CapacitorConfig } from "@capacitor/cli";

// この設定を .ts のまま読むために typescript が要る（package.json の devDependencies）。
// 入っていないと npx cap add ios が
// 「Could not find installation of TypeScript」で止まる。

/* iOSアプリの殻の設定。中身は frontend の静的書き出しをそのまま入れる。
   注意: アプリの中では capacitor://localhost が起点になるので、
   GitHub Pages 用の /bean-tracker というサブパスは付けない
   （scripts/build-app.sh は NEXT_PUBLIC_BASE_PATH を空にして書き出す）。 */
const config: CapacitorConfig = {
  appId: "io.github.yutohu.beantracker",
  appName: "BEAN TRACKER",
  webDir: "frontend/out",

  ios: {
    // 上下の余白は Web 側で env(safe-area-inset-*) を見て自分で付けている
    contentInset: "never",
    // 引っ張って画面全体が跳ねるのを止める（アプリらしく見せるため）
    scrollEnabled: true,
    backgroundColor: "#FAFAF7",
  },

  server: {
    // 豆を買うリンク（外部EC）は、アプリの中に閉じ込めず外のブラウザで開く。
    // ここに書いたホストだけがアプリ内で遷移でき、それ以外は外に出る。
    allowNavigation: [],
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 600,
      backgroundColor: "#17150F",
      showSpinner: false,
    },
  },
};

export default config;
