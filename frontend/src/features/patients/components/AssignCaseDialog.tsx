import { useMemo, useState } from "react";
import { Alert, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, ListItemText, MenuItem, Stack, TextField, Typography } from "@mui/material";
import type { Patient, User } from "../../../types";
import { assignCase, type PatientRow } from "../../../api/patients";
import { listRoster } from "../../../api/roster";
import { useSession } from "../../auth/AuthContext";
import { useAsync } from "../../../utils/useAsync";

interface Props {
  open: boolean;
  rows: PatientRow[];
  onClose: () => void;
  onAssigned: (patients: Patient[]) => void;
}

export default function AssignCaseDialog({ open, rows, onClose, onAssigned }: Props) {
  const { activeRole, courseId } = useSession();
  const roster = useAsync(() => listRoster(courseId), [courseId]);
  const templates = useMemo(() => templatesFrom(rows), [rows]);
  const [sourceId, setSourceId] = useState("");
  const [ownerIds, setOwnerIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const students = roster.data ?? [];
  const selected = students.filter((s) => ownerIds.includes(s.id));
  const source = templates.find((t) => t.id === sourceId);

  const submit = async () => {
    if (!sourceId || ownerIds.length === 0) {
      setError("Choose at least one student and a case.");
      return;
    }
    setBusy(true);
    setError("");
    const created: Patient[] = [];
    const problems: string[] = [];
    for (const ownerId of ownerIds) {
      try {
        created.push(await assignCase(activeRole, courseId, sourceId, ownerId));
      } catch (e) {
        const name = students.find((s) => s.id === ownerId)?.fullName ?? "A student";
        problems.push(`${name}: ${(e as Error).message}`);
      }
    }
    setBusy(false);
    if (created.length) onAssigned(created);
    if (problems.length) {
      setError(problems.join(" "));
      return;
    }
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Assign a case</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Each selected student gets a private assessment copy. They will not see anyone else's notes on it.
        </Typography>
        <Stack spacing={2}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            select label="Students" value={ownerIds}
            onChange={(e) => setOwnerIds(typeof e.target.value === "string" ? e.target.value.split(",") : e.target.value)}
            disabled={roster.loading}
            slotProps={{ select: { multiple: true, renderValue: (v) => (v as string[]).map((id) => students.find((s) => s.id === id)?.fullName ?? id).join(", ") } }}
          >
            {students.map((s: User) => (
              <MenuItem key={s.id} value={s.id}>
                <Checkbox checked={ownerIds.includes(s.id)} />
                <ListItemText primary={s.fullName} />
              </MenuItem>
            ))}
          </TextField>
          <TextField select label="Case" value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
            {templates.map((t) => (
              <MenuItem key={t.id} value={t.id}>{t.label}</MenuItem>
            ))}
          </TextField>
          {selected.length > 0 && source && (
            <Typography variant="body2" color="text.secondary">
              {selected.map((s) => s.fullName).join(" and ")} will each get {source.name} with a new MRN.
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={busy || !sourceId || ownerIds.length === 0}>
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
