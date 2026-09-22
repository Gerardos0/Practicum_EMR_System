import type { SxProps, Theme } from "@mui/material";

/** UTEP-derived palette for the glass UI. */
export const utep = {
  night: "#030B1A",
  navy: "#041E42", // UTEP blue
  orange: "#FF8200", // UTEP orange
  gold: "#FFB25B",
  sky: "#3E7CC9",
  ink: "#E8EDF5",
  ink2: "#9FAFC6",
  ink3: "#6F819C",
} as const;

export const fontFamily =
  '"Manrope", system-ui, -apple-system, "Segoe UI", sans-serif';

/** Navy glass panel (sits on the white page). */
export const glassCard: SxProps<Theme> = {
  position: "relative",
  width: "100%",
  maxWidth: 400,
  p: { xs: "22px 20px 20px", sm: "26px 28px 22px" },
  borderRadius: { xs: "20px", sm: "24px" },
  color: utep.ink,
  backgroundColor: "transparent",
  backgroundImage: "linear-gradient(160deg, #1B3A6B, #0E2250)",
  border: "1px solid rgba(255,255,255,0.08)",
  boxShadow:
    "inset 0 1px 0 rgba(255,255,255,0.18), 0 24px 60px rgba(14,34,80,0.25)",
  WebkitBackdropFilter: "blur(28px) saturate(140%)",
  backdropFilter: "blur(28px) saturate(140%)",
};

/** Glass input shell (apply to MUI InputBase). */
export const glassInput: SxProps<Theme> = {
  height: 44,
  px: "12px",
  gap: "10px",
  borderRadius: "12px",
  fontFamily,
  fontSize: 14,
  color: utep.ink,
  backgroundColor: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.10)",
  transition: "border-color 160ms, box-shadow 160ms, background-color 160ms",
  "& input::placeholder": { color: utep.ink3, opacity: 1 },
  "& .lead-icon": { color: utep.ink3, transition: "color 160ms" },
  "&:hover": { borderColor: "rgba(255,255,255,0.2)" },
  "&.Mui-focused": {
    borderColor: "rgba(255,130,0,0.75)",
    backgroundColor: "rgba(255,255,255,0.07)",
    boxShadow: "0 0 0 4px rgba(255,130,0,0.16)",
    "& .lead-icon": { color: utep.orange },
  },
  "&.Mui-error": { borderColor: "rgba(255,140,120,0.7)" },
};

export const fieldLabel: SxProps<Theme> = {
  display: "block",
  mb: 0.75,
  fontFamily,
  fontSize: 13,
  fontWeight: 600,
  color: utep.ink2,
};

const buttonBase: SxProps<Theme> = {
  height: 46,
  borderRadius: "12px",
  fontFamily,
  textTransform: "none",
  gap: 1.25,
  transition: "transform 120ms, filter 160ms, background-color 160ms, border-color 160ms",
  "&:active": { transform: "scale(0.985)" },
  "&.Mui-focusVisible": { outline: `2px solid ${utep.ink}`, outlineOffset: 3 },
};

export const primaryButton: SxProps<Theme> = {
  ...(buttonBase as object),
  fontSize: 15,
  fontWeight: 700,
  color: utep.navy,
  backgroundColor: utep.orange,
  boxShadow:
    "0 10px 30px rgba(255,130,0,0.28), inset 0 1px 0 rgba(255,255,255,0.35)",
  "&:hover": {
    backgroundColor: utep.orange,
    filter: "brightness(1.08)",
    boxShadow:
      "0 12px 34px rgba(255,130,0,0.34), inset 0 1px 0 rgba(255,255,255,0.35)",
  },
};

export const glassButton: SxProps<Theme> = {
  ...(buttonBase as object),
  fontSize: 14,
  fontWeight: 600,
  color: utep.ink,
  backgroundColor: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.12)",
  "&:hover": {
    backgroundColor: "rgba(255,255,255,0.09)",
    borderColor: "rgba(255,255,255,0.2)",
  },
};