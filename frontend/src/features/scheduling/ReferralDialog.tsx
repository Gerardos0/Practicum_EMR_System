import { useState } from "react";
import {
  Alert, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, FormControlLabel,
  MenuItem, Radio, RadioGroup, Stack, TextField,
} from "@mui/material";
import type { Discipline, Referral } from "../../types";
import { disciplineLabel } from "../../utils/labels";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (r: Pick<Referral, "toDiscipline" | "reason" | "urgency">) => Promise<void>;
}

export default function ReferralDialog({ open, onClose, onCreate }: Props) {
  const [toDiscipline, setTo] = useState<Discipline>("physical_therapy");
  const [reason, setReason] = useState("");
  const [urgency, setUrgency] = useState<Referral["urgency"]>("routine");
  const [error, setError] = useState("");

  const submit = async () => {
    if (reason.trim().length < 10) return setError("Give the receiving clinician a reason they can act on.");
    try {
      await onCreate({ toDiscipline, reason: reason.trim(), urgency });
      setReason("");
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Create referral</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>The receiving discipline will see this referral on the patient's chart.</DialogContentText>
        <Stack spacing={2}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField select label="Refer to" value={toDiscipline} onChange={(e) => setTo(e.target.value as Discipline)}>
            {(Object.keys(disciplineLabel) as Discipline[]).map((d) => (
              <MenuItem key={d} value={d}>{disciplineLabel[d]}</MenuItem>
            ))}
          </TextField>
          <TextField
            label="Reason for referral" multiline minRows={3} value={reason}
            onChange={(e) => { setReason(e.target.value); setError(""); }}
            placeholder="Relevant history, what you're asking them to evaluate or treat"
          />
          <RadioGroup row value={urgency} onChange={(e) => setUrgency(e.target.value as Referral["urgency"])} aria-label="Urgency">
            <FormControlLabel value="routine" control={<Radio />} label="Routine" />
            <FormControlLabel value="urgent" control={<Radio />} label="Urgent" />
          </RadioGroup>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={submit}>Send referral</Button>
      </DialogActions>
    </Dialog>
  );
}
