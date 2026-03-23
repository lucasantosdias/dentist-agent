import type { Metadata } from "next";
import "./globals.css";
import { AntdProvider } from "@/components/providers/AntdProvider";

export const metadata: Metadata = {
  title: "Dentzi - Backoffice",
  description: "AI-powered dental clinic management",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <AntdProvider>{children}</AntdProvider>
      </body>
    </html>
  );
}
