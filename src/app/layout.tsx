import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GameRef",
  description: "Reference board for game development",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-neutral-900 text-neutral-100 antialiased">
        {children}
      </body>
    </html>
  );
}
