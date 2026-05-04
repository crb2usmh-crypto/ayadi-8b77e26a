import {
  Outlet,
  Link,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import appCss from "../styles.css?url";
import "@fontsource/outfit/400.css";
import "@fontsource/outfit/600.css";
import "@fontsource/outfit/700.css";
import "@fontsource/figtree/400.css";
import "@fontsource/figtree/500.css";
import "@fontsource/figtree/600.css";
import "@fontsource/tajawal/400.css";
import "@fontsource/tajawal/500.css";
import "@fontsource/tajawal/700.css";

import "@/lib/i18n/config";
import { I18nextProvider, useTranslation } from "react-i18next";
import i18n from "@/lib/i18n/config";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { DirectionProvider } from "@/components/providers/DirectionProvider";
import { PiAuthProvider } from "@/components/providers/PiAuthProvider";
import { AppShell } from "@/components/layout/AppShell";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">
          {t("app.name")} — {t("common.noResults")}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-full gradient-brand px-6 py-2.5 text-sm font-semibold text-white shadow-lg transition-transform hover:scale-105"
          >
            {t("nav.home")}
          </Link>
        </div>
      </div>
    </div>
  );
}

interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "أيادي — سوق العمل اللامركزي" },
      {
        name: "description",
        content:
          "منصة أيادي تربط أصحاب المهام بالمستقلين في سوق عمل لامركزي عصري وآمن.",
      },
      { name: "author", content: "Ayadi" },
      { property: "og:title", content: "أيادي — سوق العمل اللامركزي" },
      {
        property: "og:description",
        content: "اعثر على من ينجز المهمة، أو كن أنت من ينجزها.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "أيادي — سوق العمل اللامركزي" },
      { name: "description", content: "Ayadi أيادي is a decentralized mini-job marketplace app." },
      { property: "og:description", content: "Ayadi أيادي is a decentralized mini-job marketplace app." },
      { name: "twitter:description", content: "Ayadi أيادي is a decentralized mini-job marketplace app." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/dq87gVW9Y5b6oIarEJ2kBivYq6o1/social-images/social-1777857239270-1000639727.webp" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/dq87gVW9Y5b6oIarEJ2kBivYq6o1/social-images/social-1777857239270-1000639727.webp" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
    scripts: [
      {
        src: "https://sdk.minepi.com/pi-sdk.js",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <I18nextProvider i18n={i18n}>
      <ThemeProvider>
        <DirectionProvider>
          <QueryClientProvider client={queryClient}>
            <PiAuthProvider>
              <AppShell>
                <Outlet />
              </AppShell>
              <Toaster position="top-center" richColors closeButton />
            </PiAuthProvider>
          </QueryClientProvider>
        </DirectionProvider>
      </ThemeProvider>
    </I18nextProvider>
  );
}
