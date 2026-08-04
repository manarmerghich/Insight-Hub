import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

import { TopNav } from "./top-nav";

export const metadata: Metadata = {
  title: "Insight Hub",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <TopNav />
        {children}
      </body>
    </html>
  );
}
