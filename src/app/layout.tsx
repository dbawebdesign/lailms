import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "../styles/animations.css";
import { UIContextProvider } from "@/context/UIContext";
import { LunaContextRegistration } from "@/components/providers/LunaContextRegistration";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { Analytics } from "@vercel/analytics/react";
import { LogoPreloader } from "@/components/ui/logo-preloader";
import { QuickGuideProvider } from "@/components/layout/QuickGuideProvider";
import Script from "next/script";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.learnologyai.com"),
  title: {
    default: "Learnology AI | Smart Learning, Smarter You.",
    template: "%s | Learnology AI"
  },
  description:
    "Learnology AI is the first fully AI‑powered learning management system that generates complete courses in minutes and adapts to every student, subject, and curriculum.",
  alternates: { canonical: "/" },
  keywords: [
    "AI‑native LMS",
    "adaptive learning",
    "course generator",
    "homeschool AI",
    "K‑12 personalized education"
  ],
  robots: {
    index: true,
    follow: true,
    "max-image-preview": "large",
    "max-snippet": -1,
    "max-video-preview": -1
  },
  openGraph: {
    title: "Learnology AI | Smart Learning, Smarter You.",
    description:
      "Transform education with AI‑generated courses, adaptive tutoring, and predictive analytics — all in one platform.",
    url: "https://www.learnologyai.com/",
    siteName: "Learnology AI",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/hero.png",   // 1200×630 px recommended
        width: 1200,
        height: 630,
        alt: "Learnology AI hero image"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    site: "@LearnologyAI",
    creator: "@LearnologyAI",
    title: "Learnology AI | Smart Learning, Smarter You.",
    description:
      "AI‑generated courses, adaptive learning paths and instant analytics — discover Learnology AI.",
    images: ["/hero.png"]
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/web-app-manifest-512x512.png",
    other: {
      rel: "mask-icon",
      url: "/safari-pinned-tab.svg",
      color: "#0F172A"
    }
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "default"
  }
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover"
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const organizationLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Learnology AI",
    url: "https://www.learnologyai.com/",
    logo: "https://www.learnologyai.com/web-app-manifest-512x512.png",
    description:
      "The world's first AI‑native learning management system for K‑12, college, and homeschool.",
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "customer support",
        email: "zjones@learnologyai.com"
      }
    ]
  };

  const softwareLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Learnology AI",
    applicationCategory: "EducationApplication",
    operatingSystem: "Web",
    offers: {
      "@type": "Offer",
      price: "20",
      priceCurrency: "USD"
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.9",
      reviewCount: "127"
    }
  };

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Favicons and manifest for best compatibility */}
        <link rel="icon" type="image/png" href="/favicon-96x96.png" sizes="96x96" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="shortcut icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-title" content="Learnology AI" />
        <link rel="manifest" href="/site.webmanifest" />
        {/* FirstPromoter tracking scripts (loaded non-blocking) */}
        <Script src="/fprmain.js" strategy="afterInteractive" />
        <Script src="https://cdn.firstpromoter.com/fpr.js" strategy="afterInteractive" />
        {/* Structured-data scripts */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareLd) }}
        />
      </head>
      <body
        className={cn(
          "min-h-screen bg-background font-sans antialiased",
          geistSans.variable,
          geistMono.variable
        )}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <LogoPreloader />
          <UIContextProvider>
            <LunaContextRegistration>
              {children}
              <QuickGuideProvider />
            </LunaContextRegistration>
          </UIContextProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
