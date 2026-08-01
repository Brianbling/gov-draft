import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './en.json'
import zhCN from './zh-CN.json'

const LOCALE_STORAGE_KEY = 'ezdoc-locale'
const SUPPORTED_LOCALES = ['en', 'zh-CN'] as const
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]

function resolveInitialLocale(): SupportedLocale {
  const saved = window.localStorage.getItem(LOCALE_STORAGE_KEY)
  if (saved && SUPPORTED_LOCALES.includes(saved as SupportedLocale)) {
    return saved as SupportedLocale
  }
  return 'zh-CN'
}

const initialLocale = resolveInitialLocale()

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    'zh-CN': { translation: zhCN },
  },
  lng: initialLocale,
  fallbackLng: 'zh-CN',
  interpolation: { escapeValue: false },
})

export function setLocale(locale: SupportedLocale): void {
  void i18n.changeLanguage(locale)
  window.localStorage.setItem(LOCALE_STORAGE_KEY, locale)
  document.documentElement.lang = locale
}

document.documentElement.lang = initialLocale

export default i18n
