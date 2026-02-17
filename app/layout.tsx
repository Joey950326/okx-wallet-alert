import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme/theme-provider";

export const metadata: Metadata = {
  title: "OKX Wallet Alert",
  description: "OKX wallet monitor dashboard",
};

const themeInitScript = `
(() => {
  const storageKey = "okx-wallet-alert-theme";
  const root = document.documentElement;
  const fallbackTheme = "dark";

  try {
    const savedTheme = localStorage.getItem(storageKey);
    const resolvedTheme =
      savedTheme === "light" || savedTheme === "dark"
        ? savedTheme
        : fallbackTheme;

    root.classList.toggle("dark", resolvedTheme === "dark");
    root.style.colorScheme = resolvedTheme;
  } catch {
    root.classList.toggle("dark", fallbackTheme === "dark");
    root.style.colorScheme = fallbackTheme;
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
