import { useState } from "react";
import { Alert, Box, Button, Stack, Typography } from "@mui/material";
import type { ClinicalNote, Patient } from "../../../types";
import { startVisit } from "../../../api/patients";
import { useSession } from "../../auth/useSession";
import { can } from "../../../utils/permissions";
import { canChartPatient } from "../../chart/access";
import { formatDateTime } from "../../../utils/format";
import { utep } from "../../../theme/tokens";

const FINISHED = new Set(["Checked out", "Closed"]);

interface Props {
  patient: Patient;
  notes: ClinicalNote[];
  onChange: (next: Patient) => void;
}

export default function VisitsTab({ patient, notes, onChange }: Props) {
  const { activeRole, user } = useSession();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const visits = [...(patient.visits ?? [])].reverse();
  const open = (patient.visits ?? []).find((visit) => visit.current);
  const finished = open ? FINISHED.has(open.status) : true;
  const allowed = activeRole === "student"
    ? canChartPatient(activeRole, patient, user.id)
    : can(activeRole, "patient:update_status");

  const start = async () => {
    setBusy(true);
    setError("");
    try {
      onChange(await startVisit(activeRole, patient.id));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack spacing={1.5}>
      {error && <Alert severity="error">{error}</Alert>}
      {allowed && finished && (
        <Box>
          <Button variant="contained" disabled={busy} onClick={start}>
            {busy ? "Starting…" : "Start another visit"}
          </Button>
        </Box>
      )}
      {visits.length === 0 && (
        <Typography color="text.secondary">No visits on this chart yet.</Typography>
      )}
      {visits.map((visit) => {
        const where = [visit.unit, visit.room ? `Room ${visit.room}` : "", visit.bed ? `Bed ${visit.bed}` : ""].filter(Boolean).join(" · ");
        const onVisit = notes.filter((note) => note.encounterId === visit.id);
        return (
          <Box key={visit.id} sx={{ border: `1px solid ${utep.lineSoft}`, borderRadius: 1, p: 1.5 }}>
            <Typography sx={{ fontWeight: 700 }}>
              {visit.type} · {visit.status}{visit.current ? " · Current" : ""}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {visit.date}
              {where ? ` · ${where}` : ""}
              {visit.chiefComplaint ? ` · ${visit.chiefComplaint}` : ""}
            </Typography>
            {visit.checkedInByName && (
              <Typography variant="body2">
                Checked in by {visit.checkedInByName}{visit.checkedInAt ? ` · ${formatDateTime(visit.checkedInAt)}` : ""}
              </Typography>
            )}
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              {onVisit.length === 0
                ? "No notes on this visit."
                : onVisit.map((note) => note.templateId).join(", ")}
            </Typography>
          </Box>
        );
      })}
    </Stack>
  );
}
