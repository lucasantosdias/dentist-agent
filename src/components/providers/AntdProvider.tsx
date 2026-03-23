"use client";
import { ConfigProvider, App } from "antd";
import ptBR from "antd/locale/pt_BR";

const theme = {
  token: {
    colorPrimary: "#2563eb",
    colorInfo: "#2563eb",
    borderRadius: 8,
    colorBgLayout: "#f8fafc",
    colorBgContainer: "#ffffff",
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    colorSuccess: "#16a34a",
    colorWarning: "#f59e0b",
    colorError: "#ef4444",
  },
  components: {
    Menu: {
      darkItemBg: "transparent",
      darkSubMenuItemBg: "transparent",
      darkItemSelectedBg: "rgba(37, 99, 235, 0.2)",
      darkItemSelectedColor: "#ffffff",
      darkItemColor: "rgba(255, 255, 255, 0.65)",
      darkItemHoverColor: "#ffffff",
      darkItemHoverBg: "rgba(255, 255, 255, 0.08)",
      itemBorderRadius: 8,
      itemMarginInline: 8,
      iconSize: 16,
    },
    Card: {
      borderRadiusLG: 12,
      boxShadowTertiary: "0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 1px 2px -1px rgba(0, 0, 0, 0.04)",
    },
    Table: {
      borderRadius: 12,
      headerBg: "#f8fafc",
      headerColor: "#64748b",
      headerSplitColor: "transparent",
      rowHoverBg: "#f1f5f9",
    },
    Button: {
      borderRadius: 8,
      controlHeight: 36,
    },
    Input: {
      borderRadius: 8,
    },
    Select: {
      borderRadius: 8,
    },
    Tag: {
      borderRadiusSM: 6,
    },
    Statistic: {
      titleFontSize: 13,
      contentFontSize: 28,
    },
  },
};

export function AntdProvider({ children }: { children: React.ReactNode }) {
  return (
    <ConfigProvider theme={theme} locale={ptBR}>
      <App>{children}</App>
    </ConfigProvider>
  );
}
