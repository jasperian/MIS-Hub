import type { Metadata } from "next";
import PwaSupport from "@/components/pwa-support";
import "./globals.css";
export const metadata: Metadata = {
  title: "MIS Hub | IT workspace",
  description:
    "Equipment, people, email accounts, and network inventory in one workspace.",
  applicationName: "MIS Hub",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "MIS Hub",
  },
  formatDetection: { telephone: false },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <PwaSupport />
        {children}
      </body>
    </html>
  );
}
