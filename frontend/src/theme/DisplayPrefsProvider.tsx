import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { createAppTheme, type DisplayPrefs } from "./theme";

// ADA: adjustable text size and contrast, remembered per device.
const KEY = "emr.displayPrefs";
const defaults: DisplayPrefs = { textScale: 1, highContrast: false };

function load(): DisplayPrefs {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return defaults;
  }
}

interface Ctx {
  prefs: DisplayPrefs;
  setPrefs: (p: Partial<DisplayPrefs>) => void;
}
const DisplayPrefsContext = createContext<Ctx | null>(null);

export function DisplayPrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setState] = useState<DisplayPrefs>(load);
  const theme = useMemo(() => createAppTheme(prefs), [prefs]);

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

export function useDisplayPrefs() {
  const ctx = useContext(DisplayPrefsContext);
  if (!ctx) throw new Error("useDisplayPrefs must be used inside DisplayPrefsProvider");
  return ctx;
}
