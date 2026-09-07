import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AntdProvider } from "@/components/providers/antd-provider";
import { SessionProvider } from "@/lib/session/session-provider";
import { UsersProvider } from "@/lib/users-store";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "vietnamese"],
  display: "swap",
});

function apiOrigin() {
  const raw = process.env.NEXT_PUBLIC_API_URL ?? "https://apidyn.otcayxe.com/api/v1";
  try {
    return new URL(raw).origin;
  } catch {
    return "https://apidyn.otcayxe.com";
  }
}

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
        <link rel="preconnect" href={apiOrigin()} crossOrigin="anonymous" />
      </head>
      <body className="min-h-full antialiased" suppressHydrationWarning>
        <AntdProvider>
          <SessionProvider>
            <UsersProvider>{children}</UsersProvider>
          </SessionProvider>
        </AntdProvider>
      </body>
    </html>
  );
}
