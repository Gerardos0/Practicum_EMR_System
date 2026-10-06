import { Box, Button, Chip, Paper, Typography } from "@mui/material";
import WarningAmberRounded from "@mui/icons-material/WarningAmberRounded";
import type { Patient } from "../../../types";
import { formatDate } from "../../../utils/format";
import { utep } from "../../../theme/tokens";

interface Props {
  patient: Patient;
  ownerName?: string;
  onEditStatus?: () => void;
  compact?: boolean;
}

const card = { borderRadius: "16px", overflow: "hidden" } as const;

export default function PatientBanner({ patient: p, ownerName, onEditStatus, compact }: Props) {
  const initials = `${p.firstName[0] ?? ""}${p.lastName[0] ?? ""}`;
  const statusItems: [string, string][] = [
    ["Visit", p.status.encounter],
    ["Setting", p.status.careSetting],
    ["Record", p.status.lifecycle],
    ...(p.status.program ? ([["Program", p.status.program]] as [string, string][]) : []),
  ];

  return (
    <Paper component="section" aria-label="Patient" sx={card}>
      <Box
        sx={{
          p: compact ? 2 : 2.5,
          display: "grid",
          gap: 2,
          gridTemplateColumns: "auto minmax(0, 1fr)",
          alignItems: "start",
        }}
      >
        <Box
          aria-hidden
          sx={{
            width: compact ? 44 : 52, height: compact ? 44 : 52, borderRadius: "50%",
            bgcolor: utep.navy, color: "#fff", display: "grid", placeItems: "center",
            fontWeight: 800, fontSize: compact ? 16 : 18,
          }}
        >
          {initials}
        </Box>

        <Box sx={{ minWidth: 0 }}>
          {!compact && (
            <Typography variant="overline" sx={{ color: utep.ink2, fontWeight: 700, letterSpacing: 0 }}>
              Patient profile
            </Typography>
          )}
          <Typography component={compact ? "p" : "h1"} variant={compact ? "h6" : "h5"} sx={{ color: utep.navy, lineHeight: 1.2 }}>
            {p.lastName}, {p.firstName}
            {p.preferredName && (
              <Typography component="span" variant="body1" color="text.secondary"> ({p.preferredName})</Typography>
            )}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {p.ageYears} y, {p.sexAtBirth}{p.pronouns ? ` (${p.pronouns})` : ""}, DOB {formatDate(p.dob)}, MRN {p.mrn}
          </Typography>
          <Box sx={{ display: "flex", gap: 1, mt: 1, flexWrap: "wrap" }}>
            {p.mode === "assessment" ? (
              <Chip size="small" label={ownerName ? `Assessment case: ${ownerName}` : "Assessment case: only your work appears here"} sx={{ bgcolor: utep.navy, color: "#fff" }} />
            ) : (
              <Chip size="small" label={`${p.practiceLabel ?? "Practice patient"}: shared, not graded`} variant="outlined" />
            )}
            <Chip size="small" label="Simulated patient" sx={{ bgcolor: utep.orangeSoft, color: utep.navy }} />
          </Box>
        </Box>

        {!compact && (
          <Box
            component="dl"
            sx={{ m: 0, display: "flex", flexWrap: "wrap", columnGap: 3.5, rowGap: 1, alignItems: "flex-end", gridColumn: "1 / -1" }}
          >
            {statusItems.map(([k, v]) => (
              <Box key={k}>
                <Typography component="dt" variant="caption" color="text.secondary">{k}</Typography>
                <Typography component="dd" variant="body2" sx={{ m: 0, fontWeight: 700 }}>{v}</Typography>
              </Box>
            ))}
            {onEditStatus && (
              <Button size="small" variant="outlined" onClick={onEditStatus}>Change status</Button>
            )}
          </Box>
        )}
      </Box>

      <Box
        role="note"
        aria-label="Allergies"
        sx={{
          px: compact ? 2 : 2.5, py: 1, display: "flex", alignItems: "center", gap: 1,
          bgcolor: p.allergies.length ? utep.alertSoft : "action.hover",
          borderTop: 1, borderColor: p.allergies.length ? "#F4C7C3" : "divider",
          color: p.allergies.length ? utep.alert : "text.secondary",
        }}
      >
        {p.allergies.length > 0 && <WarningAmberRounded fontSize="small" />}
        <Typography variant="body2" sx={{ fontWeight: 700 }}>
          {p.allergies.length
            ? `Allergies: ${p.allergies.map((a) => `${a.substance}${a.reaction ? ` (${a.reaction.toLowerCase()})` : ""}`).join("; ")}`
            : "No known drug allergies"}
        </Typography>
      </Box>
    </Paper>
  );
}
