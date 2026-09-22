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

/** Always-visible identity + allergy header, the way real EMRs pin it above every chart view. */
export default function PatientBanner({ patient: p, ownerName, onEditStatus, compact }: Props) {
  const statusItems: [string, string][] = [
    ["Visit", p.status.encounter],
    ["Setting", p.status.careSetting],
    ["Record", p.status.lifecycle],
    ...(p.status.program ? ([["Program", p.status.program]] as [string, string][]) : []),
  ];

  return (
    <Paper component="section" aria-label="Patient" sx={{ overflow: "hidden" }}>
      <Box sx={{ p: compact ? 2 : 2.5, display: "flex", gap: 3, flexWrap: "wrap", alignItems: "flex-start" }}>
        <Box sx={{ minWidth: 240, flex: "1 1 280px" }}>
          <Typography component="h1" variant={compact ? "h6" : "h5"}>
            {p.lastName}, {p.firstName}
            {p.preferredName && (
              <Typography component="span" variant="body1" color="text.secondary"> ({p.preferredName})</Typography>
            )}
          </Typography>
          <Typography variant="body2" color="text.secondary">
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
          <Box component="dl" sx={{ m: 0, display: "flex", flexWrap: "wrap", columnGap: 3.5, rowGap: 1, alignItems: "flex-end" }}>
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
