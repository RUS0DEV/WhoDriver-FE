import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "whodriver.local";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
  const origin = `${protocol}://${host}`;

  return {
    metadataBase: new URL(origin),
    title: "WhoDriver — отзывы о водителях по номеру",
    description: "Анонимные оценки и отзывы о поведении водителей на дороге.",
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: {
      title: "WhoDriver — отзывы о водителях",
      description: "Узнайте, как водят рядом. Анонимные отзывы по госномеру.",
      images: [{ url: "/og.png", width: 1672, height: 941, alt: "WhoDriver — отзывы о водителях" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "WhoDriver — отзывы о водителях",
      description: "Анонимные отзывы по госномеру.",
      images: ["/og.png"],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru"><body>{children}</body></html>;
}
