// app/layout.tsx
import "./globals.css";
import type { ReactNode, CSSProperties } from "react";
import Link from "next/link"; // ✅ 반드시 default import

export const metadata = { title: "TTS & YouTube Analyzer" };

const tabStyle: CSSProperties = {
  padding: "8px 12px",
  border: "1px solid #333",
  borderRadius: 10,
  background: "#111",
  color: "#fff",
  textDecoration: "none",
  fontWeight: 700,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body style={{ background: "#0b0b0b", color: "#eee" }}>
        <nav style={{ display: "flex", gap: 8, padding: "12px 16px", borderBottom: "1px solid #222" }}>
          <Link href="/" style={tabStyle}>TTS</Link>
          <Link href="/youtube" style={tabStyle}>YouTube 분석</Link>
        </nav>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>{children}</div>
      </body>
    </html>
  );
}