import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AntdProvider } from "@/components/providers/antd-provider";
import { UsersProvider } from "@/lib/users-store";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "vietnamese"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "DNY CRM",
  description: "Hệ thống quản lý văn phòng luật",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className={`${inter.variable} h-full`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('app_theme');if(t==='dark'||t==='light'){document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t;}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full antialiased" suppressHydrationWarning>
        <AntdProvider>
          <UsersProvider>{children}</UsersProvider>
        </AntdProvider>
      </body>
    </html>
  );
}
