import {
  Outlet,
  Link,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
  useRouter,
} from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import appCss from "../styles.css?url";
// Arabic-first app — load only Tajawal (the RTL font used in styles.css).
// Latin fonts (Outfit/Figtree) fall back to system fonts to keep the bundle light.
import "@fontsource/tajawal/400.css";
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

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  if (typeof console !== "undefined") console.error(error);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-bold text-foreground">حدث خطأ غير متوقع</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          نعتذر، حدث خطأ أثناء عرض هذه الصفحة.
        </p>
        {import.meta.env.DEV && error?.message && (
          <pre className="mt-4 max-h-40 overflow-auto rounded-md bg-muted p-3 text-left font-mono text-xs text-destructive">
            {error.message}
          </pre>
        )}
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-full gradient-brand px-6 py-2.5 text-sm font-semibold text-white shadow-lg"
          >
            إعادة المحاولة
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-input bg-background px-6 py-2.5 text-sm font-medium text-foreground"
          >
            الصفحة الرئيسية
          </a>
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
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  // Inject Supabase config into the client at SSR time. This lets the published
  // worker pass non-prefixed SUPABASE_URL / SUPABASE_ANON_KEY (which are NOT
  // inlined into the client bundle at build time) through to the browser.
  const supabaseUrl =
    (typeof process !== "undefined" &&
      (process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL)) ||
    "";
  const supabaseAnon =
    (typeof process !== "undefined" &&
      (process.env.VITE_SUPABASE_ANON_KEY ??
        process.env.SUPABASE_ANON_KEY ??
        process.env.SUPABASE_PUBLISHABLE_KEY)) ||
    "";
  const configScript = `window.__SUPABASE_CONFIG__=${JSON.stringify({
    url: supabaseUrl,
    anon: supabaseAnon,
  })};`;
  return (
    <html lang="ar" dir="rtl">
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: configScript }} />
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
