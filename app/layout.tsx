// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import RouteLoader from "./_components/RouteLoader";
import { Noto_Sans_KR } from "next/font/google";

export const metadata: Metadata = {
  title: "Mediswitch",
  description: "health-check SaaS",
};

const noto = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  display: "swap",
  variable: "--font-sans",
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={noto.variable}>
      <body className="min-h-screen font-[var(--font-sans)] antialiased">
        {/* 전역 라우트 전환 로더 */}
        <RouteLoader />
        {children}
      </body>
    </html>
  );
}
