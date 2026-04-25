import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { DirectionProvider as RadixDirectionProvider } from "@radix-ui/react-direction";
import { isRtl } from "@/lib/i18n/config";

export function DirectionProvider({ children }: { children: React.ReactNode }) {
  const { i18n } = useTranslation();
  const dir = isRtl(i18n.language) ? "rtl" : "ltr";

  useEffect(() => {
    const html = document.documentElement;
    html.setAttribute("dir", dir);
    html.setAttribute("lang", i18n.language);
  }, [dir, i18n.language]);

  return <RadixDirectionProvider dir={dir}>{children}</RadixDirectionProvider>;
}