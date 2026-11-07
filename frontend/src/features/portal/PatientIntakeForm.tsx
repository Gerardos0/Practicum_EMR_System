import { useEffect, useState, type FormEvent } from "react";
import { Alert, Box, Button, LinearProgress, Paper, Stack, TextField, Typography } from "@mui/material";
import { getPortalIntake, savePortalIntake, type IntakeData } from "../../api/intake";
import { useAsync } from "../../utils/useAsync";

export default function PatientIntakeForm() {
  const intake = useAsync(getPortalIntake, []);
  const [draft, setDraft] = useState<IntakeData>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (intake.data) setDraft(intake.data.data);
  }, [intake.data]);

  if (intake.loading && !intake.data) return <LinearProgress aria-label="Loading intake" />;
  if (intake.error && !intake.data) return <Alert severity="error">{intake.error.message}</Alert>;
  if (!intake.data || !draft) return null;

  const editable = intake.data.editable;
  const set = (key: keyof IntakeData, value: string) => {
    setDraft((current) => current ? { ...current, [key]: value } : current);
    setError("");
    setSaved(false);
  };
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const result = await savePortalIntake(draft);
      intake.setData(result);
      setDraft(result.data);
      setSaved(true);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const input = (label: string, key: keyof IntakeData, options: { multiline?: boolean; minRows?: number; fullWidth?: boolean; type?: string } = {}) => (
    <TextField
      label={label}
      value={draft[key]}
      onChange={(event) => set(key, event.target.value)}
      disabled={!editable}
      {...options}
    />
  );

  return (
    <Stack component="form" spacing={2.5} onSubmit={save}>
      <Alert severity="info">Use fictional information only. Do not enter real personal, insurance, or health information.</Alert>
      {!editable && <Alert severity="info">{intake.data.notEditableReason}</Alert>}
      {error && <Alert severity="error">{error}</Alert>}
      {saved && <Alert severity="success">Saved.</Alert>}

      <Paper sx={{ p: { xs: 2, md: 2.5 } }}>
        <Typography component="h2" variant="h6" sx={{ mb: 1.5 }}>Demographics</Typography>
        <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" } }}>
          <TextField label="Legal first name" value={intake.data.identity.firstName} disabled />
          <TextField label="Legal last name" value={intake.data.identity.lastName} disabled />
          {input("Preferred name", "preferredName")}
          <TextField label="Date of birth" type="date" value={intake.data.identity.dob} disabled slotProps={{ inputLabel: { shrink: true } }} />
          <TextField label="Sex at birth" value={intake.data.identity.sexAtBirth} disabled />
          <TextField label="MRN" value={intake.data.identity.mrn} disabled />
          {input("Pronouns", "pronouns")}
          {input("Phone", "phone", { type: "tel" })}
          {input("Address", "address")}
          {input("Preferred language", "preferredLanguage")}
        </Box>
      </Paper>

      <Paper sx={{ p: { xs: 2, md: 2.5 } }}>
        <Typography component="h2" variant="h6" sx={{ mb: 1.5 }}>History</Typography>
        <Stack spacing={2}>
          {input("Past medical history", "pastMedicalHistory", { fullWidth: true, multiline: true, minRows: 2 })}
          {input("Surgical history", "surgicalHistory", { fullWidth: true, multiline: true, minRows: 2 })}
          {input("Family history", "familyHistory", { fullWidth: true, multiline: true, minRows: 2 })}
          {input("Social history", "socialHistory", { fullWidth: true, multiline: true, minRows: 2 })}
        </Stack>
      </Paper>

      <Paper sx={{ p: { xs: 2, md: 2.5 } }}>
        <Typography component="h2" variant="h6" sx={{ mb: 1.5 }}>Insurance</Typography>
        <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" } }}>
          {input("Payer", "insurancePayer")}
          {input("Member ID", "insuranceMemberId")}
          {input("Group number", "insuranceGroupNumber")}
        </Box>
      </Paper>

      <Paper sx={{ p: { xs: 2, md: 2.5 } }}>
        <Typography component="h2" variant="h6" sx={{ mb: 1.5 }}>Emergency contact</Typography>
        <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" } }}>
          {input("Name", "emergencyContactName")}
          {input("Phone", "emergencyContactPhone", { type: "tel" })}
          {input("Relationship", "emergencyContactRelationship")}
        </Box>
      </Paper>

      <Button type="submit" variant="contained" disabled={busy || !editable}>
        {busy ? "Saving…" : "Save information"}
      </Button>
    </Stack>
  );
}
