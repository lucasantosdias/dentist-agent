import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dentzi AI — Login",
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)",
        padding: 24,
      }}
    >
      {children}
    </div>
  );
}
