import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { StudioThemePicker } from "../components/settings/StudioThemePicker";
import {
  getStudioThemeInitScript,
  resolveStudioTheme,
  STUDIO_THEME_KEY,
  studioThemes,
} from "./studio-themes";

const css = readFileSync(
  new URL("../studio-design.css", import.meta.url),
  "utf8",
);
function luminance(hsl: string) {
  const [h, s0, l0] = hsl.match(/[\d.]+/g)!.map(Number);
  const s = s0 / 100,
    l = l0 / 100;
  const a = s * Math.min(l, 1 - l);
  const rgb = [0, 8, 4].map((n) => {
    const k = (n + h / 30) % 12;
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
function contrast(a: string, b: string) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

describe("studio themes", () => {
  it("offers all eight named themes with an accessible native picker", () => {
    expect(studioThemes).toHaveLength(8);
    const html = renderToStaticMarkup(<StudioThemePicker />);
    expect(html).toContain('aria-label="テーマ"');
    for (const theme of studioThemes)
      expect(html).toContain(`value="${theme.id}"`);
  });
  it.each(studioThemes)(
    "bootstraps validated $id before hydration and supplies legible tokens",
    (theme) => {
      const attrs: Record<string, string> = { "data-theme": theme.mode };
      runInNewContext(getStudioThemeInitScript(), {
        localStorage: {
          getItem: (key: string) =>
            key === STUDIO_THEME_KEY ? theme.id : null,
        },
        document: {
          documentElement: {
            getAttribute: (key: string) => attrs[key],
            setAttribute: (key: string, value: string) => {
              attrs[key] = value;
            },
          },
        },
      });
      expect(attrs["data-studio-theme"]).toBe(theme.id);
      expect(resolveStudioTheme(theme.id, theme.mode)).toBe(theme.id);
      const block = css
        .split(`:root[data-studio-theme="${theme.id}"] {`)[1]
        .split("}")[0];
      const token = (name: string) =>
        block.match(new RegExp(`--studio-${name}: ([^;]+);`))![1];
      for (const background of ["bg", "surface"]) {
        expect(
          contrast(token("text"), token(background)),
        ).toBeGreaterThanOrEqual(4.5);
        expect(
          contrast(token("muted"), token(background)),
        ).toBeGreaterThanOrEqual(4.5);
      }
      expect(
        contrast(token("accent"), token("on-accent")),
      ).toBeGreaterThanOrEqual(4.5);
      for (const background of ["bg", "surface"])
        expect(
          contrast(token("border"), token(background)),
        ).toBeGreaterThanOrEqual(3);
    },
  );
  it("falls back to Core's mode for invalid or mode-mismatched preferences", () => {
    expect(resolveStudioTheme("unknown", "dark")).toBe("dark");
    expect(resolveStudioTheme("solarized-dark", "light")).toBe("light");
    for (const [value, mode, fallback] of [
      ["<script>example</script>", "light", "light"],
      ["solarized-dark", "light", "light"],
      ["unknown", "dark", "dark"],
    ]) {
      const setAttribute = vi.fn();
      runInNewContext(getStudioThemeInitScript(), {
        localStorage: { getItem: () => value },
        document: {
          documentElement: { getAttribute: () => mode, setAttribute },
        },
      });
      expect(setAttribute).toHaveBeenCalledWith("data-studio-theme", fallback);
    }
  });
  it("tolerates unavailable storage", () => {
    const attrs: Record<string, string> = { "data-theme": "dark" };
    expect(() =>
      runInNewContext(getStudioThemeInitScript(), {
        localStorage: {
          getItem: () => {
            throw new Error("blocked");
          },
        },
        document: {
          documentElement: {
            getAttribute: (key: string) => attrs[key],
            setAttribute: (key: string, value: string) => {
              attrs[key] = value;
            },
          },
        },
      }),
    ).not.toThrow();
    expect(attrs["data-studio-theme"]).toBe("dark");
  });
});
