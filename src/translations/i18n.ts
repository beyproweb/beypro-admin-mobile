// src/translations/i18n.ts
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./en.json";
import tr from "./tr.json";
import fr from "./fr.json";
import de from "./de.json";

i18n.use(initReactI18next).init({
  lng: "en",
  fallbackLng: "en",
  resources: {
    en: { translation: en },
    tr: { translation: tr },
    fr: { translation: fr },
    de: { translation: de },
  },
  interpolation: {
    escapeValue: false, // React already protects from XSS
  },
});

export default i18n;
