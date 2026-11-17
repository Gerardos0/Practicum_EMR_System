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
    display: "flex", flexDirection: "column", gap: 1, p: 2.25, borderRadius: 1,
    bgcolor: t.bg, color: t.ink, textDecoration: "none", minHeight: 128,
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
          width: 36, height: 36, borderRadius: 1, display: "grid", placeItems: "center",
          bgcolor: iconColor ?? t.iconBg, color: iconColor ? "#fff" : t.iconInk,
        }}
      >
        {icon}
      </Box>
      <Typography sx={{ fontSize: 14, fontWeight: 600, opacity: 0.92 }}>{label}</Typography>
      <Typography sx={{ fontSize: 28, fontWeight: 750, lineHeight: 1, letterSpacing: "-0.02em" }}>{value}</Typography>
    </>
  );
  return to ? <Box component={RouterLink} to={to} sx={sx}>{body}</Box> : <Box sx={sx}>{body}</Box>;
}

export function StatGrid({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box component="section" aria-label={title} sx={{ py: 0.5 }}>
      <Typography component="h2" variant="h6" sx={{ color: utep.navy, mb: 1.75 }}>{title}</Typography>
      <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
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
  children: ReactNode;
}

export function Panel({ title, subtitle, action, accent, flush, children }: PanelProps) {
  return (
    <Paper
      component="section" aria-label={title}
      sx={{
        borderRadius: "16px",
        boxShadow: "none",
        overflow: "hidden",
        px: flush ? 0 : 2.75,
        pt: flush ? 2.25 : 2.75,
        pb: flush ? 0 : 2.75,
        ...(accent && { borderTop: `5px solid ${utep.orange}` }),
      }}
    >
      <Box sx={{ display: "flex", alignItems: "baseline", gap: 2, mb: subtitle ? 0.5 : flush ? 1.25 : 1.5, px: flush ? 2.75 : 0 }}>
        <Typography component="h2" variant="h6" sx={{ flex: 1, color: utep.navy, fontSize: 18 }}>{title}</Typography>
        {action && (
          <Link component={RouterLink} to={action.to} underline="hover" sx={{ fontWeight: 600, fontSize: 14, color: utep.navy, whiteSpace: "nowrap" }}>
            {action.label}
          </Link>
        )}
      </Box>
      {subtitle && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, px: flush ? 2.75 : 0 }}>
          {subtitle}
        </Typography>
      )}
      {children}
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

