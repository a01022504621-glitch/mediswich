/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false, // 보안상 X-Powered-By 제거

  async headers() {
    const isProd = process.env.NODE_ENV === "production";

    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          // HSTS는 HTTPS 환경에서만, 운영에서만 적용
          ...(isProd
            ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" }]
            : []),
          // ⚠️ CSP는 middleware.ts에서 통합 관리 (중복 방지)
        ],
      },
    ];
  },
};

module.exports = nextConfig;

