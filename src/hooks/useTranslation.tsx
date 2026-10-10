import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import vi from '../locales/vi.json';
import en from '../locales/en.json';

export type SupportedLocale = 'vi' | 'en';

type Dictionary = Record<string, any>;

const dictionaries: Record<SupportedLocale, Dictionary> = {
  vi,
  en,
};

interface LocaleContextType {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const LocaleContext = createContext<LocaleContextType | undefined>(undefined);

const STORAGE_KEY = 'cypherguide_locale';

let currentLocale: SupportedLocale = (() => {
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'en' || saved === 'vi') {
        return saved;
      }
    }
  } catch {
    // ignore localStorage errors
  }
  return 'en';
})();

export function getGlobalLocale(): SupportedLocale {
  return currentLocale;
}

export function setGlobalLocale(newLocale: SupportedLocale) {
  currentLocale = newLocale;
}

const warnedMissingKeys = new Set<string>();

const getNestedValue = (obj: any, path: string): string | undefined => {
  const keys = path.split('.');
  let current = obj;
  for (const k of keys) {
    if (current && typeof current === 'object' && k in current) {
      current = current[k];
    } else {
      return undefined;
    }
  }
  return typeof current === 'string' ? current : undefined;
};

function formatTranslation(
  dictLocale: SupportedLocale,
  key: string,
  params?: Record<string, string | number>
): string {
  const dict = dictionaries[dictLocale] || dictionaries.vi;
  let text = getNestedValue(dict, key);

  // Fallback to Vietnamese if string not found in selected locale
  if (text === undefined && dictLocale !== 'vi') {
    text = getNestedValue(dictionaries.vi, key);
  }

  if (text === undefined) {
    if (import.meta.env.DEV) {
      if (!warnedMissingKeys.has(key)) {
        warnedMissingKeys.add(key);
        console.warn(`[i18n] Missing translation key: "${key}" in locales (tried "${dictLocale}" and fallback "vi").`);
      }
    }
    // Note for production: Returning raw key as graceful degradation fallback,
    // but this represents a missing translation key that must be resolved in vi.json and en.json.
    return key;
  }

  if (params) {
    Object.entries(params).forEach(([paramKey, paramVal]) => {
      text = text!.replace(new RegExp(`{\\s*${paramKey}\\s*}`, 'g'), String(paramVal));
    });
  }

  return text;
}

/**
 * Non-hook translation function for utils, background services, and error handlers
 */
export function translate(key: string, params?: Record<string, string | number>): string {
  return formatTranslation(currentLocale, key, params);
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<SupportedLocale>(() => {
    return currentLocale;
  });

  const setLocale = (newLocale: SupportedLocale) => {
    setLocaleState(newLocale);
    setGlobalLocale(newLocale);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, newLocale);
      }
    } catch {
      // ignore localStorage errors
    }
  };

  const t = (key: string, params?: Record<string, string | number>): string => {
    return formatTranslation(locale, key, params);
  };

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error('useTranslation must be used within a LocaleProvider');
  }
  return context;
}
