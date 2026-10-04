"use client";

type ThemePreference = "light" | "dark" | "system";
const STORAGE_KEY = "vde:theme:v1";
const NEXT_THEME: Record<ThemePreference, ThemePreference> = { system: "light", light: "dark", dark: "system" };

function applyTheme(preference: ThemePreference) {
  document.documentElement.dataset.theme = preference;
}

export function ThemeToggle() {
  return (
    <button
      type="button"
      className="icon-button theme-toggle"
      aria-label="Cambiar tema: sistema, claro u oscuro"
      title="Cambiar tema"
      onClick={() => {
        const stored = document.documentElement.dataset.theme;
        const preference: ThemePreference = stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
        const next = NEXT_THEME[preference];
        localStorage.setItem(STORAGE_KEY, next);
        applyTheme(next);
      }}
    >
      <span aria-hidden="true">◐</span>
    </button>
  );
}
