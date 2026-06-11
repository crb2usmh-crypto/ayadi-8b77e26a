import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import ar from "./locales/ar.json";
import en from "./locales/en.json";

// To add a new language:
//  1) Create src/lib/i18n/locales/<lang>.json with the same key shape.
//  2) Import it here and add it to the `resources` map and `supportedLngs`.
//  3) If it's RTL, also extend the RTL detection in `isRtl` below.
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

// NOTE: do NOT switch to a stored language at module load — even via
// queueMicrotask it can run before React hydrates and cause a
// hydration mismatch (server rendered "ar", client suddenly "en").
// The language switch happens inside an `useEffect` in <AppShell />.

export default i18n;

export const isRtl = (lng: string) => lng === "ar";