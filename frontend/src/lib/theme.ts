export type Theme = "dark" | "light";

const STORAGE_KEY = "theme";

let currentTheme: Theme = "dark";

export function setTheme(theme: Theme) {
  currentTheme = theme;
  localStorage.setItem(STORAGE_KEY, theme);
  document.documentElement.dataset.theme = theme;
}

export function getTheme(): Theme {
  const saved = localStorage.getItem(STORAGE_KEY) as Theme | null;
  return saved === "light" || saved === "dark" ? saved : "dark";
}

export function initTheme() {
  const theme = getTheme();
  currentTheme = theme;
  document.documentElement.dataset.theme = theme;
  return theme;
}

export function activeTheme() {
  return currentTheme;
}
