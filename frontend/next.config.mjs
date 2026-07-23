/** @type {import('next').NextConfig} */

// GitHub Pages のプロジェクトサイトはサブパス配信（例: /bean-tracker）。
// CIで NEXT_PUBLIC_BASE_PATH を渡す。ローカル(空)ではルート配信。
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig = {
  reactStrictMode: true,
  output: "export",            // 静的サイトとして out/ に書き出し（GitHub Pages用）
  trailingSlash: true,         // /index.html を各ディレクトリに生成
  images: { unoptimized: true },
  basePath,
  assetPrefix: basePath || undefined,
};

export default nextConfig;
