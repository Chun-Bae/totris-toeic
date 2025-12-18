import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const baseUrl =
  process.env.NEXT_PUBLIC_SITE_URL
    ? new URL(process.env.NEXT_PUBLIC_SITE_URL)
    : process.env.VERCEL_URL
      ? new URL(`https://${process.env.VERCEL_URL}`)
      : new URL("http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: baseUrl,
  title: "Totris",
  description: "테트리스 하면서 토익 단어 외우는 게임, Totris",
  openGraph: {
    title: "Totris",
    description: "테트리스 하면서 토익 단어 외우는 게임, Totris",
    url: baseUrl,
    siteName: "Totris",
    locale: "ko_KR",
    // 일부 크롤러(카톡 포함)는 절대 URL을 더 안정적으로 처리함
    images: [
      {
        url: new URL("/og.png", baseUrl),
        width: 1200,
        height: 630,
        alt: "Totris",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Totris",
    description: "테트리스 하면서 토익 단어 외우는 게임, Totris",
    images: [new URL("/og.png", baseUrl)],
  },
};
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
