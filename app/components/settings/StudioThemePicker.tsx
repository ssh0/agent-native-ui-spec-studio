import { useTheme } from "next-themes";
import { useEffect, useSyncExternalStore } from "react";

import {
  findStudioTheme,
  resolveStudioTheme,
  STUDIO_THEME_KEY,
  studioThemes,
  type StudioThemeId,
} from "@/lib/studio-themes";

let memoryPreference: string | null | undefined;
const CHANGE_EVENT = "studio:theme-preference";
function readPreference() {
  if (memoryPreference !== undefined) return memoryPreference;
  try {
    return localStorage.getItem(STUDIO_THEME_KEY);
  } catch {
    return null;
  }
}
function subscribe(callback: () => void) {
  const storageChanged = (event: StorageEvent) => {
    if (event.key !== null && event.key !== STUDIO_THEME_KEY) return;
    memoryPreference = undefined;
    callback();
  };
  window.addEventListener("storage", storageChanged);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", storageChanged);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}
export function useStudioTheme() {
  const { resolvedTheme, setTheme } = useTheme();
  const saved = useSyncExternalStore(subscribe, readPreference, () => null);
  const selected = resolveStudioTheme(saved, resolvedTheme);
  return {
    selected,
    select: (id: StudioThemeId) => {
      const entry = findStudioTheme(id);
      if (!entry) return;
      // Apply locally before persistence or any rendering/network work.
      document.documentElement.setAttribute("data-studio-theme", id);
      setTheme(entry.mode);
      memoryPreference = id;
      try {
        localStorage.setItem(STUDIO_THEME_KEY, id);
      } catch {
        /* Optional browser preference. */
      }
      window.dispatchEvent(new Event(CHANGE_EVENT));
    },
  };
}

/** The root is the only owner of palette/mode synchronization. */
export function StudioThemeSync() {
  const { resolvedTheme } = useTheme();
  const { selected } = useStudioTheme();
  useEffect(() => {
    if (resolvedTheme)
      document.documentElement.setAttribute("data-studio-theme", selected);
  }, [selected, resolvedTheme]);
  return null;
}

export function StudioThemePicker() {
  const { selected, select } = useStudioTheme();
  return (
    <select
      id="studio-theme"
      aria-label="テーマ"
      className="studio-theme-picker"
      value={selected}
      onChange={(event) => select(event.target.value as StudioThemeId)}
    >
      {studioThemes.map((theme) => (
        <option key={theme.id} value={theme.id}>
          {theme.label}
        </option>
      ))}
    </select>
  );
}
