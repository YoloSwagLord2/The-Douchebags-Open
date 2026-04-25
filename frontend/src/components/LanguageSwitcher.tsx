import { useState, useCallback } from "react";
import { getLanguage, setLanguage, type Language } from "../lib/i18n";

let currentLang = getLanguage();

export function LanguageSwitcher({ onLanguageChange }: { onLanguageChange?: (lang: Language) => void }) {
  const [language, setCurrentLanguage] = useState<Language>(currentLang);

  const handleChange = useCallback((newLang: Language) => {
    currentLang = newLang;
    setCurrentLanguage(newLang);
    setLanguage(newLang);
    window.dispatchEvent(new CustomEvent('languageChange', { detail: newLang }));
    onLanguageChange?.(newLang);
  }, [onLanguageChange]);

  return (
    <div style={{ position: 'fixed', top: '1rem', right: '1rem', zIndex: 1000 }}>
      <select
        value={language}
        onChange={(e) => handleChange(e.target.value as Language)}
        style={{
          padding: '0.5rem',
          borderRadius: '0.5rem',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          background: 'rgba(8, 17, 23, 0.8)',
          color: '#f4eee4',
          cursor: 'pointer',
          minHeight: '44px',
        }}
      >
        <option value="en">English</option>
        <option value="nl">Nederlands</option>
      </select>
    </div>
  );
}
