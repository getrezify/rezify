"use client";

import { getT, type Lang, type TranslationKey } from "@/lib/i18n";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type LanguageContextValue = {
  lang: Lang;
  dir: "ltr" | "rtl";
  t: (key: TranslationKey) => string;
  toggle: () => void;
};

const LanguageContext = createContext<LanguageContextValue>({
  lang: "en",
  dir: "ltr",
  t: (key) => key,
  toggle: () => {},
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>("en");

  useEffect(() => {
    const stored = localStorage.getItem("rezify_lang");
    if (stored === "ar" || stored === "en") setLang(stored);
  }, []);

  function toggle() {
    const next: Lang = lang === "en" ? "ar" : "en";
    setLang(next);
    localStorage.setItem("rezify_lang", next);
  }

  const dir = lang === "ar" ? "rtl" : "ltr";
  const t = getT(lang);

  return (
    <LanguageContext.Provider value={{ lang, dir, t, toggle }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
