import { useState } from "react";
import { Box, Button, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
import PatientBanner from "./PatientBanner";
import type { AllergyCategory, Patient } from "../../../types";
import { addAllergy, removeAllergy } from "../../../api/chart";
import { utep } from "../../../theme/tokens";
import { useSession } from "../../auth/useSession";
import { canEditSection } from "../../chart/access";
import { pharmacyFacts } from "../measures";

interface Props {
  patient: Patient;
  compact?: boolean;
  onChange?: (patient: Patient) => void;
  onEditStatus?: () => void;
}

const CATEGORIES: { id: AllergyCategory; label: string }[] = [
  { id: "medication", label: "Allergy" },
  { id: "food", label: "Food" },
  { id: "environmental", label: "Environmental" },
];

export default function PharmacyProfile({ patient: p, compact, onChange, onEditStatus }: Props) {
  const { user, activeRole } = useSession();
  const facts = pharmacyFacts(p);
  const canEditAllergies = Boolean(onChange) && canEditSection(activeRole, p, "allergies", user.id);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ substance: "", category: "medication" as AllergyCategory, reaction: "", severity: "" as "" | "mild" | "moderate" | "severe" });
  const [error, setError] = useState("");
  const meds = p.medications.filter((item) => item.status !== "discontinued" && item.status !== "entered_in_error");
  const diagnosis = p.problems.map((item) => item.description).filter(Boolean).join("; ") || p.chiefComplaint || "Not recorded";
  const card = { p: 2.5, borderRadius: "16px" } as const;

  return (
    <Stack spacing={2}>
      <PatientBanner
        patient={p}
        compact={compact}
        onEditStatus={onEditStatus}
        extraStatus={compact ? [] : [
          ["BMI", facts.bmi],
          ["BSA", facts.bsa],
          ["IBW", facts.ibw],
          ["CrCl, actual weight", facts.crclActual],
          ["CrCl, ideal weight", facts.crclIbw],
          ["Serum creatinine", facts.scr],
          ["Diagnosis", diagnosis],
        ]}
      />

      {!compact && (
        <>
          <Paper sx={card}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, mb: 1.5 }}>
              <Typography component="h2" variant="h6" sx={{ color: utep.navy }}>Allergies</Typography>
              {canEditAllergies && (
                <Button size="small" variant="outlined" onClick={() => setEditing((open) => !open)}>
                  {editing ? "Done" : "Edit"}
                </Button>
              )}
            </Box>
          <Table size="small" aria-label="Allergies">
            <TableHead>
              <TableRow sx={{ "& th": { color: utep.navy, fontWeight: 700 } }}>
                <TableCell>Allergy</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Severity</TableCell>
                {editing && <TableCell />}
              </TableRow>
            </TableHead>
            <TableBody>
              {p.allergies.length === 0 && (
                <TableRow>
                  <TableCell colSpan={editing ? 4 : 3}>No allergies recorded</TableCell>
                </TableRow>
              )}
              {p.allergies.map((item) => (
                <TableRow key={item.id ?? item.substance}>
                  <TableCell>{item.substance}{item.reaction ? ` (${item.reaction})` : ""}</TableCell>
                  <TableCell>{CATEGORIES.find((category) => category.id === (item.category ?? "medication"))?.label ?? "Allergy"}</TableCell>
                  <TableCell sx={{ textTransform: "capitalize" }}>{item.severity || "Not recorded"}</TableCell>
                  {editing && (
                    <TableCell align="right">
                      {item.id && (
                        <Button size="small" color="error" onClick={async () => {
                          try { onChange?.(await removeAllergy(activeRole, p.id, item.id!)); }
                          catch (e) { setError((e as Error).message); }
                        }}>Remove</Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {editing && (
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ px: 1.5, py: 1.25 }}>
              <TextField size="small" label="Substance" value={draft.substance} onChange={(e) => setDraft({ ...draft, substance: e.target.value })} />
              <TextField size="small" label="Reaction" value={draft.reaction} onChange={(e) => setDraft({ ...draft, reaction: e.target.value })} />
              <TextField select size="small" label="Type" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value as AllergyCategory })} sx={{ minWidth: 140 }}>
                {CATEGORIES.map((item) => <MenuItem key={item.id} value={item.id}>{item.label}</MenuItem>)}
              </TextField>
              <TextField select size="small" label="Severity" value={draft.severity} onChange={(e) => setDraft({ ...draft, severity: e.target.value as typeof draft.severity })} sx={{ minWidth: 130 }}>
                <MenuItem value="">Not recorded</MenuItem>
                <MenuItem value="mild">Mild</MenuItem>
                <MenuItem value="moderate">Moderate</MenuItem>
                <MenuItem value="severe">Severe</MenuItem>
              </TextField>
              <Button variant="contained" onClick={async () => {
                try {
                  onChange?.(await addAllergy(activeRole, p.id, {
                    substance: draft.substance,
                    category: draft.category,
                    reaction: draft.reaction || undefined,
                    severity: draft.severity || undefined,
                  }));
                  setDraft({ substance: "", category: "medication", reaction: "", severity: "" });
                  setError("");
                } catch (e) { setError((e as Error).message); }
              }}>Add</Button>
            </Stack>
          )}
          {error && <Typography variant="body2" sx={{ color: utep.alert, mt: 1 }}>{error}</Typography>}
          </Paper>

          <Paper sx={card}>
            <Typography component="h2" variant="h6" sx={{ color: utep.navy, mb: 1.5 }}>Current orders</Typography>
          <Table size="small" aria-label="Current orders">
            <TableHead>
              <TableRow sx={{ "& th": { color: utep.navy, fontWeight: 700 } }}>
                <TableCell>Medication</TableCell>
                <TableCell>Instructions</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {meds.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3}>No active medications</TableCell>
                </TableRow>
              )}
              {meds.map((med) => (
                <TableRow key={med.id}>
                  <TableCell sx={{ fontWeight: 700, color: utep.navy }}>{med.name}</TableCell>
                  <TableCell>{med.sig || [med.dose, med.route, med.frequency].filter(Boolean).join(" ")}</TableCell>
                  <TableCell sx={{ textTransform: "capitalize" }}>{med.status || "active"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </Paper>
        </>
      )}
    </Stack>
  );
}
