/** One theme catalogue for settings, command menu and pre-hydration validation. */
export const studioThemes = [
  { id: "light", label: "ライト", mode: "light" },
  { id: "dark", label: "ダーク", mode: "dark" },
  { id: "high-contrast", label: "ハイコントラスト", mode: "dark" },
  { id: "solarized-light", label: "Solarized Light", mode: "light" },
  { id: "solarized-dark", label: "Solarized Dark", mode: "dark" },
  { id: "flexoki", label: "Flexoki", mode: "light" },
  { id: "github-light", label: "GitHub Light", mode: "light" },
  { id: "github-dark", label: "GitHub Dark", mode: "dark" },
] as const;
export type StudioThemeId = (typeof studioThemes)[number]["id"];
export const STUDIO_THEME_KEY = "ui-spec-studio.theme";
export function findStudioTheme(value: string | null | undefined) {
  return studioThemes.find((entry) => entry.id === value);
}
export function resolveStudioTheme(value: string | null, mode?: string) {
  const selected = findStudioTheme(value);
  return selected && selected.mode === mode
    ? selected.id
    : mode === "dark"
      ? "dark"
      : "light";
}

/** Runs after Core's mode bootstrap; only validated catalogue values reach DOM. */
export function getStudioThemeInitScript() {
  return `(function(){try{var themes=${JSON.stringify(studioThemes)};var selected=themes.find(function(t){return t.id===localStorage.getItem(${JSON.stringify(STUDIO_THEME_KEY)})});if(selected&&selected.mode===document.documentElement.getAttribute('data-theme'))document.documentElement.setAttribute('data-studio-theme',selected.id)}catch(e){}})();`;
}
