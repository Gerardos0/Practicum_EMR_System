import type { ReactNode } from "react";
import { Box, Chip, Link, Paper, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import type { EncounterStatus } from "../../../types";
import { utep } from "../../../theme/tokens";

const NAVY_SOFT = "#E8ECF5";

type Tone = "navy" | "orange" | "orangeSoft" | "navySoft";

const TONES: Record<Tone, { bg: string; ink: string; iconBg: string; iconInk: string }> = {
  navy: { bg: utep.navy, ink: "#fff", iconBg: utep.orange, iconInk: utep.navy },
  orange: { bg: utep.orange, ink: utep.navy, iconBg: utep.navy, iconInk: "#fff" },
  orangeSoft: { bg: utep.orangeSoft, ink: utep.navy, iconBg: utep.navy, iconInk: "#fff" },
  navySoft: { bg: NAVY_SOFT, ink: utep.navy, iconBg: utep.navy, iconInk: "#fff" },
};

interface StatProps {
  label: string;
  value: number | string;
  icon: ReactNode;
  tone: Tone;
  iconColor?: string;
  to?: string;
}

export function StatCard({ label, value, icon, tone, iconColor, to }: StatProps) {
  const t = TONES[tone];
  const sx = {
    display: "flex", alignItems: "center", gap: 1.25, px: 1.5, py: 1.15, borderRadius: 1,
    bgcolor: t.bg, color: t.ink, textDecoration: "none", minHeight: 64,
    transition: "transform 160ms ease",
    "&:hover": { transform: "translateY(-1px)" },
    "@media (prefers-reduced-motion: reduce)": { transition: "none", "&:hover": { transform: "none" } },
    "&:focus-visible": { outline: `3px solid ${tone === "navy" ? utep.orange : utep.navy}`, outlineOffset: 2 },
  } as const;
  const body = (
    <>
      <Box
        aria-hidden
        sx={{
          width: 32, height: 32, borderRadius: 1, display: "grid", placeItems: "center", flexShrink: 0,
          bgcolor: iconColor ?? t.iconBg, color: iconColor ? "#fff" : t.iconInk,
        }}
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: 22, fontWeight: 750, lineHeight: 1, letterSpacing: "-0.02em" }}>{value}</Typography>
        <Typography noWrap sx={{ fontSize: 13, fontWeight: 600, opacity: 0.92, mt: 0.35 }}>{label}</Typography>
      </Box>
    </>
  );
  return to ? <Box component={RouterLink} to={to} sx={sx}>{body}</Box> : <Box sx={sx}>{body}</Box>;
}

export function StatGrid({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box component="section" aria-label={title}>
      <Typography component="h2" variant="h6" sx={{ color: utep.navy, mb: 1, fontSize: 16 }}>{title}</Typography>
      <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
        {children}
      </Box>
    </Box>
  );
}

interface PanelProps {
  title: string;
  subtitle?: string;
  action?: { label: string; to: string };
  accent?: boolean;
  flush?: boolean;
  /** Stretch to the row and scroll the body instead of the page. */
  fill?: boolean;
  children: ReactNode;
}

export function Panel({ title, subtitle, action, accent, flush, fill, children }: PanelProps) {
  return (
    <Paper
      component="section" aria-label={title}
      sx={{
        borderRadius: "16px",
        boxShadow: "none",
        overflow: "hidden",
        px: flush ? 0 : 2,
        pt: flush ? 1.5 : 2,
        pb: flush ? 0 : 2,
        ...(accent && { borderTop: `4px solid ${utep.orange}` }),
        ...(fill && {
          height: { md: "100%" },
          minHeight: { md: 0 },
          display: "flex",
          flexDirection: "column",
        }),
      }}
    >
      <Box sx={{ display: "flex", alignItems: "baseline", gap: 2, flexShrink: 0, mb: subtitle ? 0.25 : 1, px: flush ? 2 : 0 }}>
        <Typography component="h2" variant="h6" sx={{ flex: 1, color: utep.navy, fontSize: 16 }}>{title}</Typography>
        {action && (
          <Link component={RouterLink} to={action.to} underline="hover" sx={{ fontWeight: 600, fontSize: 14, color: utep.navy, whiteSpace: "nowrap" }}>
            {action.label}
          </Link>
        )}
      </Box>
      {subtitle && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1, flexShrink: 0, px: flush ? 2 : 0 }}>
          {subtitle}
        </Typography>
      )}
      <Box sx={fill ? { flex: 1, minHeight: { md: 0 }, overflow: { md: "auto" } } : undefined}>
        {children}
      </Box>
    </Paper>
  );
}

const VISIT: Record<EncounterStatus, { bgcolor: string; color: string }> = {
  "In progress": { bgcolor: "#E8F1FF", color: "#175CD3" },
  "Checked in": { bgcolor: "#E6F7F4", color: "#0E7C66" },
  Roomed: { bgcolor: "#E6F7F4", color: "#0E7C66" },
  Scheduled: { bgcolor: "#F2F4F7", color: "#46536A" },
  "Checked out": { bgcolor: "#F2F4F7", color: "#46536A" },
  Closed: { bgcolor: "#F2F4F7", color: "#46536A" },
};

export function VisitChip({ status }: { status: EncounterStatus }) {
  return (
    <Chip
      size="small"
      label={status}
      sx={{ ...VISIT[status], fontWeight: 600, height: 24, borderRadius: "999px" }}
    />
  );
}

