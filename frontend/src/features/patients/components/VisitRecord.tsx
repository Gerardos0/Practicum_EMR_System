import { useState } from "react";
import { Alert, Box, Button, Paper, Stack, TextField, Typography } from "@mui/material";
import type { Patient } from "../../../types";
import { updateHistory, updatePlacement } from "../../../api/chart";
import { useSession } from "../../auth/useSession";
import { can } from "../../../utils/permissions";
import { canEditSection } from "../../chart/access";
import { formatDateTime } from "../../../utils/format";
import { utep } from "../../../theme/tokens";
import { placeLabel } from "../tracker";

const card = { p: 2.5, borderRadius: "16px" } as const;
const titleSx = { color: utep.navy, fontSize: 18, mb: 1.5 } as const;

export default function VisitRecord({ patient: p, onChange }: { patient: Patient; onChange: (patient: Patient) => void }) {
  const { user, activeRole } = useSession();
  const [error, setError] = useState("");
  const [medical, setMedical] = useState(p.pastMedicalHistory);
  const [surgical, setSurgical] = useState(p.surgicalHistory);
  const [unit, setUnit] = useState(p.unit ?? "");
  const [room, setRoom] = useState(p.room ?? "");
  const [bed, setBed] = useState(p.bed ?? "");
  const canMove = can(activeRole, "patient:update_status") || can(activeRole, "case:author");
  const editMedical = canEditSection(activeRole, p, "medical_history", user.id);
  const editSurgical = canEditSection(activeRole, p, "surgical_history", user.id);
  const finished = p.status.encounter === "Checked out" || p.status.encounter === "Closed";
  const current = p.visits?.find((visit) => visit.current);
  const location = placeLabel(p);

  async function saveHistory(section: "medical_history" | "surgical_history", value: string) {
    setError("");
    try {
      onChange(await updateHistory(activeRole, p.id, section, value));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function savePlace() {
    setError("");
    try {
      onChange(await updatePlacement(activeRole, p.id, { unit, room, bed }));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
      {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}

      <Paper sx={card}>
        <Typography component="h2" variant="h6" sx={titleSx}>Location</Typography>
        <Typography variant="body2">{location || "No room assigned"}</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.75 }}>
          A location change stays on this visit. A new encounter starts only when someone begins another visit.
        </Typography>
        {canMove && (
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 1.5, alignItems: "flex-start" }}>
            <TextField size="small" label="Unit" value={unit} onChange={(e) => setUnit(e.target.value)} />
            <TextField size="small" label="Room" value={room} onChange={(e) => setRoom(e.target.value)} />
            <TextField size="small" label="Bed" value={bed} onChange={(e) => setBed(e.target.value)} />
            <Button variant="outlined" onClick={savePlace}>Update location</Button>
          </Stack>
        )}
      </Paper>

      <Paper sx={card}>
        <Typography component="h2" variant="h6" sx={titleSx}>History</Typography>
        <HistoryField
          label="Past medical history"
          value={medical}
          stored={p.pastMedicalHistory}
          editable={editMedical}
          onChange={setMedical}
          onSave={() => saveHistory("medical_history", medical)}
        />
        <HistoryField
          label="Surgical history"
          value={surgical}
          stored={p.surgicalHistory}
          editable={editSurgical}
          onChange={setSurgical}
          onSave={() => saveHistory("surgical_history", surgical)}
        />
        <ReadRow label="Family history" value={p.familyHistory} />
        <ReadRow label="Social history" value={p.socialHistory} />
      </Paper>

      {finished && (
        <Paper sx={card}>
          <Typography component="h2" variant="h6" sx={titleSx}>Discharge</Typography>
          <Typography variant="body2">
            {p.status.encounter}
            {current?.closedAt ? ` · ${formatDateTime(current.closedAt)}` : ""}
          </Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            This visit stays on the chart. Signed notes stay as written. A later correction is an addendum.
          </Typography>
        </Paper>
      )}
    </Box>
  );
}

function HistoryField({
  label, value, stored, editable, onChange, onSave,
}: {
  label: string;
  value: string;
  stored: string;
  editable: boolean;
  onChange: (value: string) => void;
  onSave: () => void;
}) {
  if (!editable) return <ReadRow label={label} value={stored} />;
  return (
    <Stack spacing={1} sx={{ mb: 2 }}>
      <TextField label={label} value={value} onChange={(e) => onChange(e.target.value)} fullWidth multiline minRows={2} />
      <Box>
        <Button variant="outlined" onClick={onSave} disabled={value.trim() === stored.trim()}>Save {label.toLowerCase()}</Button>
      </Box>
    </Stack>
  );
}

function ReadRow({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ mb: 1.5 }}>
      <Typography variant="subtitle2">{label}</Typography>
      <Typography variant="body2">{value.trim() || "Not documented"}</Typography>
    </Box>
  );
}
