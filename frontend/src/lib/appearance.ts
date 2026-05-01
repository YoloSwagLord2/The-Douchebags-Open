import { api } from "./api";
import type { AppearanceResponse } from "./types";

const setBackgroundVar = (name: string, url?: string | null) => {
  if (url) {
    document.documentElement.style.setProperty(name, `url("${url}")`);
  } else {
    document.documentElement.style.removeProperty(name);
  }
};

export function applyAppearance(appearance: AppearanceResponse) {
  setBackgroundVar("--login-background-image", appearance.login_background_url);
  setBackgroundVar("--admin-hero-background-image", appearance.admin_hero_background_url);
}

export async function loadAppearance() {
  try {
    applyAppearance(await api.appearance());
  } catch {
    // The app remains usable with CSS fallbacks.
  }
}
