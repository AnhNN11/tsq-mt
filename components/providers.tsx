"use client";

import { App, ConfigProvider } from "antd";
import viVN from "antd/locale/vi_VN";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ConfigProvider
      locale={viVN}
      theme={{
        token: {
          colorPrimary: "#315b35",
          colorInfo: "#315b35",
          colorError: "#b33435",
          colorText: "#28392a",
          colorTextSecondary: "#798374",
          colorBorder: "#dbe1d5",
          borderRadius: 0,
          borderRadiusLG: 0,
          borderRadiusSM: 0,
          borderRadiusXS: 0,
          fontFamily: '"Segoe UI", Arial, sans-serif',
          fontSize: 14,
          controlHeight: 38,
        },
        components: {
          Table: {
            headerBg: "#f7f8f5",
            headerColor: "#7b857e",
            rowHoverBg: "#f5f8f4",
            cellPaddingBlock: 16,
          },
          Button: { primaryShadow: "none" },
          Tabs: { horizontalItemGutter: 28 },
        },
      }}
    >
      <App message={{ top: 24, duration: 3 }}>{children}</App>
    </ConfigProvider>
  );
}
