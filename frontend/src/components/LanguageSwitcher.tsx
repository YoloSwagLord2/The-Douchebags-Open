import { useState, useCallback } from "react";
import { getLanguage, setLanguage, type Language } from "../lib/i18n";

let currentLang = getLanguage();

type LanguageSwitcherProps = {
  className?: string;
  compact?: boolean;
  onLanguageChange?: (lang: Language) => void;
};

export function LanguageSwitcher({ className = "", compact = false, onLanguageChange }: LanguageSwitcherProps) {
  const [language, setCurrentLanguage] = useState<Language>(currentLang);

  const handleChange = useCallback((newLang: Language) => {
    currentLang = newLang;
    setCurrentLanguage(newLang);
    setLanguage(newLang);
    window.dispatchEvent(new CustomEvent('languageChange', { detail: newLang }));
    onLanguageChange?.(newLang);
  }, [onLanguageChange]);

  return (
    <div className={`language-switcher ${className}`.trim()}>
      <select
        value={language}
        onChange={(e) => handleChange(e.target.value as Language)}
      >
        <option value="en">{compact ? "EN" : "English"}</option>
        <option value="nl">{compact ? "NL" : "Nederlands"}</option>
      </select>
    </div>
  );
}
