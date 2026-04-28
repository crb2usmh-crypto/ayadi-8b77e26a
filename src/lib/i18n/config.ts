import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import ar from "./locales/ar.json";
import en from "./locales/en.json";

if (!i18n.isInitialized) {
  i18n
    .use(initReactI18next)
    .init({
      resources: {
        ar: { translation: ar },
        en: { translation: en },
      },
      lng: "ar", // Always start in Arabic to match SSR HTML lang="ar"
      fallbackLng: "ar",
      supportedLngs: ["ar", "en"],
      interpolation: { escapeValue: false },
      react: { useSuspense: false },
    });
}

// After hydration on the client, switch to the user's preferred language.
if (typeof window !== "undefined") {
  try {
    const stored = window.localStorage.getItem("ayadi-lang");
    if (stored && stored !== i18n.language && (stored === "ar" || stored === "en")) {
      // Defer so initial render matches SSR; then change.
      queueMicrotask(() => i18n.changeLanguage(stored));
    }
  } catch {
    // ignore
  }
}

export default i18n;

export const isRtl = (lng: string) => lng === "ar";