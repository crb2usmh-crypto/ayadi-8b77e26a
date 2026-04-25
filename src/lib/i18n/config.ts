import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import ar from "./locales/ar.json";
import en from "./locales/en.json";

if (!i18n.isInitialized) {
  i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources: {
        ar: { translation: ar },
        en: { translation: en },
      },
      fallbackLng: "ar",
      supportedLngs: ["ar", "en"],
      interpolation: { escapeValue: false },
      detection: {
        order: ["localStorage", "navigator"],
        caches: ["localStorage"],
        lookupLocalStorage: "ayadi-lang",
      },
    });
}

export default i18n;

export const isRtl = (lng: string) => lng === "ar";