import { useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { createAppTheme, type DisplayPrefs, type TextScale } from "./theme";
import { applyContrast } from "./tokens";
import { DisplayPrefsContext } from "./useDisplayPrefs";

const KEY = "emr.displayPrefs";
const defaults: DisplayPrefs = { textScale: 1, highContrast: false, navCollapsed: false };

function textScaleOf(value: unknown): TextScale {
  if (value === 1 || value === 1.25 || value === 1.5) return value;
  if (value === 1.15) return 1.25;
  if (value === 1.3) return 1.5;
  return 1;
}

function load(): DisplayPrefs {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<DisplayPrefs>;
    return { ...defaults, ...saved, textScale: textScaleOf(saved.textScale) };
  } catch {
    return defaults;
  }
}

export function DisplayPrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setState] = useState<DisplayPrefs>(load);
  applyContrast(prefs.highContrast);
  const theme = useMemo(() => createAppTheme(prefs), [prefs]);

  useLayoutEffect(() => {
    document.body.style.zoom = prefs.textScale === 1 ? "" : String(prefs.textScale);
    return () => {
      document.body.style.zoom = "";
    };
  }, [prefs.textScale]);

  const setPrefs = (p: Partial<DisplayPrefs>) =>
    setState((prev) => {
      const next = { ...prev, ...p };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable: prefs last for this session */
      }
      return next;
    });

  return (
    <DisplayPrefsContext.Provider value={{ prefs, setPrefs }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </DisplayPrefsContext.Provider>
  );
}
