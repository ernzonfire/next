import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Sora, Work_Sans } from "next/font/google";

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-display",
});

const workSans = Work_Sans({
  subsets: ["latin"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "NEXT",
  description: "Company hub for events, announcements, engagement, and rewards.",
  icons: {
    icon: "/nextapp.svg",
    shortcut: "/nextapp.svg",
    apple: "/nextapp.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#002E6D",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${sora.variable} ${workSans.variable}`}>
        {children}
      </body>
    </html>
  );
}
