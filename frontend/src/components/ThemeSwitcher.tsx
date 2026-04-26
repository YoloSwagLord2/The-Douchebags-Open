import { useCallback, useState } from "react";
import { activeTheme, setTheme, type Theme } from "../lib/theme";
import { t } from "../lib/i18n";

export function ThemeSwitcher() {
  const [theme, setCurrentTheme] = useState<Theme>(activeTheme());

  const toggleTheme = useCallback(() => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setCurrentTheme(nextTheme);
    setTheme(nextTheme);
  }, [theme]);

  return (
    <button className="theme-switcher" type="button" onClick={toggleTheme}>
      {theme === "dark" ? t("theme.light") : t("theme.dark")}
    </button>
  );
}
