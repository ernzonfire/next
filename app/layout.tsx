import "./globals.css";
import type { Metadata } from "next";
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
  themeColor: "#002E6D",
  icons: {
    icon: "/nextapp.svg",
    shortcut: "/nextapp.svg",
    apple: "/nextapp.svg",
  },
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
