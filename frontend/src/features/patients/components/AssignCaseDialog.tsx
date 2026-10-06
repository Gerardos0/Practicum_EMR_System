import { useMemo, useState } from "react";
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography } from "@mui/material";
import type { Patient, User } from "../../../types";
import { assignCase, type PatientRow } from "../../../api/patients";
import { listRoster } from "../../../api/roster";
import { useSession } from "../../auth/AuthContext";
import { useAsync } from "../../../utils/useAsync";

interface Props {
  open: boolean;
  rows: PatientRow[];
  onClose: () => void;
  onAssigned: (patient: Patient) => void;
}

export default function AssignCaseDialog({ open, rows, onClose, onAssigned }: Props) {
  const { activeRole, courseId } = useSession();
  const roster = useAsync(() => listRoster(courseId), [courseId]);
  const templates = useMemo(() => templatesFrom(rows), [rows]);
  const [sourceId, setSourceId] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const students = roster.data ?? [];
  const owner = students.find((s) => s.id === ownerId);
  const source = templates.find((t) => t.id === sourceId);

  const submit = async () => {
    if (!sourceId || !ownerId) {
      setError("Choose a student and a case.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const patient = await assignCase(activeRole, courseId, sourceId, ownerId);
      onAssigned(patient);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Assign a case</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Creates a private assessment copy. The student will not see anyone else's notes on it.
        </Typography>
        <Stack spacing={2}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            select label="Student" value={ownerId} onChange={(e) => setOwnerId(e.target.value)}
            disabled={roster.loading}
          >
            {students.map((s: User) => (
              <MenuItem key={s.id} value={s.id}>{s.fullName}</MenuItem>
            ))}
          </TextField>
          <TextField select label="Case" value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
            {templates.map((t) => (
              <MenuItem key={t.id} value={t.id}>{t.label}</MenuItem>
            ))}
          </TextField>
          {owner && source && (
            <Typography variant="body2" color="text.secondary">
              {owner.fullName} will get {source.name} with a new MRN.
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={busy || !sourceId || !ownerId}>
          Assign case
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function templatesFrom(rows: PatientRow[]) {
  const byKey = new Map<string, PatientRow>();
  for (const row of rows) {
    const key = row.patient.caseTemplateId;
    const current = byKey.get(key);
    if (!current || (row.patient.mode === "practice" && current.patient.mode !== "practice")) {
      byKey.set(key, row);
    }
  }
  return [...byKey.values()].map((row) => {
    const p = row.patient;
    return {
      id: p.id,
      name: `${p.lastName}, ${p.firstName}`,
      label: `${p.lastName}, ${p.firstName}${p.practiceLabel ? ` (${p.practiceLabel})` : ""}`,
    };
  });
}
