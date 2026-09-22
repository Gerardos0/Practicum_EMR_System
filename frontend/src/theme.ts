import { createTheme } from "@mui/material/styles";

// Deliberately stock: default MUI palette, default type scale, default
// 4px shape radius. No custom brand theme for Sprint 1 — the point is
// that this looks like a boring enterprise app, because that's what an
// EMR is.
export const theme = createTheme({
  typography: {
    fontFamily: ["Roboto", "Helvetica", "Arial", "sans-serif"].join(","),
  },
});
