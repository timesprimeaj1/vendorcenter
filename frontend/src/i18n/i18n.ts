import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

// English namespaces
import enCommon from "./en/common.json";
import enHome from "./en/home.json";
import enAuth from "./en/auth.json";
import enServices from "./en/services.json";
import enVendor from "./en/vendor.json";
import enAdmin from "./en/admin.json";
import enChat from "./en/chat.json";
import enMessages from "./en/messages.json";
import enCategories from "./en/categories.json";
import enAccount from "./en/account.json";
import enLegal from "./en/legal.json";

// Marathi namespaces
import mrCommon from "./mr/common.json";
import mrHome from "./mr/home.json";
import mrAuth from "./mr/auth.json";
import mrServices from "./mr/services.json";
import mrVendor from "./mr/vendor.json";
import mrAdmin from "./mr/admin.json";
import mrChat from "./mr/chat.json";
import mrMessages from "./mr/messages.json";
import mrCategories from "./mr/categories.json";
import mrAccount from "./mr/account.json";
import mrLegal from "./mr/legal.json";

export const supportedLanguages = {
  en: "English",
  mr: "मराठी",
} as const;

export type SupportedLanguage = keyof typeof supportedLanguages;

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        common: enCommon,
        home: enHome,
        auth: enAuth,
        services: enServices,
        vendor: enVendor,
        admin: enAdmin,
        chat: enChat,
        messages: enMessages,
        categories: enCategories,
        account: enAccount,
        legal: enLegal,
      },
      mr: {
        common: mrCommon,
        home: mrHome,
        auth: mrAuth,
        services: mrServices,
        vendor: mrVendor,
        admin: mrAdmin,
        chat: mrChat,
        messages: mrMessages,
        categories: mrCategories,
        account: mrAccount,
        legal: mrLegal,
      },
    },
    fallbackLng: "en",
    defaultNS: "common",
    ns: [
      "common",
      "home",
      "auth",
      "services",
      "vendor",
      "admin",
      "chat",
      "messages",
      "categories",
      "account",
      "legal",
    ],
    interpolation: {
      escapeValue: false, // React already escapes
    },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "vc_language",
      caches: ["localStorage"],
    },
  });

export default i18n;
