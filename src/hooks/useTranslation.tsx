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

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<SupportedLocale>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'en' || saved === 'vi') {
        return saved;
      }
    } catch {
      // ignore localStorage errors
    }
    return 'en';
  });

  const setLocale = (newLocale: SupportedLocale) => {
    setLocaleState(newLocale);
    try {
      localStorage.setItem(STORAGE_KEY, newLocale);
    } catch {
      // ignore localStorage errors
    }
  };

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

  const t = (key: string, params?: Record<string, string | number>): string => {
    const dict = dictionaries[locale] || dictionaries.vi;
    let text = getNestedValue(dict, key);

    // Fallback to Vietnamese if string not found in selected locale
    if (text === undefined && locale !== 'vi') {
      text = getNestedValue(dictionaries.vi, key);
    }

    if (text === undefined) {
      return key;
    }

    if (params) {
      Object.entries(params).forEach(([paramKey, paramVal]) => {
        text = text!.replace(new RegExp(`{\\s*${paramKey}\\s*}`, 'g'), String(paramVal));
      });
    }

    return text;
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
