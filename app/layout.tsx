import type { Metadata } from "next";
import { Archivo, Space_Mono } from "next/font/google";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
  weight: ["400", "500", "600", "700", "800", "900"],
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  variable: "--font-space-mono",
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "MegaChat - The Open Source Instagram Comment-to-DM Engine",
    template: "%s | MegaChat",
  },
  description:
    "Comment a keyword, get a DM. MegaChat is a free, self-hostable, open source Instagram comment-to-DM engine powered by Zernio.",
  metadataBase: new URL("https://github.com/rodneymanor/megachat"),
  openGraph: {
    title: "MegaChat - The Open Source Instagram Comment-to-DM Engine",
    description:
      "Comment a keyword, get a DM. MegaChat is a free, self-hostable, open source Instagram comment-to-DM engine powered by Zernio.",
    url: "https://github.com/rodneymanor/megachat",
    siteName: "MegaChat",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "MegaChat - The Open Source Instagram Comment-to-DM Engine",
    description:
      "Comment a keyword, get a DM. Free, self-hostable, open source.",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem("theme")==="dark"||(!localStorage.getItem("theme")&&matchMedia("(prefers-color-scheme:dark)").matches))document.documentElement.classList.add("dark")}catch(e){}`,
          }}
        />
      </head>
      <body className={`${archivo.variable} ${spaceMono.variable} font-sans antialiased`}>{children}</body>
    </html>
  );
}
