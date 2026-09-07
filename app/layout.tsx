import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "MIS Hub | IT workspace",
  description:
    "Equipment, people, email accounts, and network inventory in one workspace.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
