import { useState, type FormEvent } from "react";
import {
  Alert, Box, Breadcrumbs, Button, LinearProgress, Link, MenuItem, Paper, Stack, TextField, Typography,
} from "@mui/material";
import { Link as RouterLink, useNavigate, useParams } from "react-router-dom";
import { createCase, getCase, updateCase, type CaseInput } from "../../api/cases";
import { useSession } from "../auth/AuthContext";
import { useAsync } from "../../utils/useAsync";
import { usePageHeading } from "../../components/PageHeading";
import PageError from "../../components/PageError";
import AnswerKeyEditor from "./AnswerKeyEditor";
import EditableTable from "./EditableTable";
import type { AuthoredCase, CareSetting, EncounterStatus, LifecycleStatus } from "../../types";

const LIFECYCLE: LifecycleStatus[] = ["Active", "Inactive", "Prospective", "Discharged from practice", "Archived", "Deceased"];
const ENCOUNTER: EncounterStatus[] = ["Scheduled", "Checked in", "In progress", "Checked out", "Closed"];
const SETTING: CareSetting[] = ["Outpatient", "Inpatient", "Emergency", "Discharged"];

interface Draft {
  firstName: string;
  lastName: string;
  preferredName: string;
  dob: string;
  sexAtBirth: "Male" | "Female";
  pronouns: string;
  chiefComplaint: string;
  hpi: string;
  pastMedicalHistory: string;
  surgicalHistory: string;
  familyHistory: string;
  socialHistory: string;
  encounterType: string;
  careSetting: CareSetting;
  lifecycle: LifecycleStatus;
  encounterStatus: EncounterStatus;
  program: string;
  allergies: Record<string, string>[];
  medications: Record<string, string>[];
  problems: Record<string, string>[];
  labs: Record<string, string>[];
  vitals: Record<string, string>[];
}

function emptyDraft(): Draft {
  return {
    firstName: "", lastName: "", preferredName: "", dob: "", sexAtBirth: "Female", pronouns: "",
    chiefComplaint: "", hpi: "", pastMedicalHistory: "", surgicalHistory: "", familyHistory: "", socialHistory: "",
    encounterType: "Office visit", careSetting: "Outpatient", lifecycle: "Active", encounterStatus: "Scheduled",
    program: "", allergies: [], medications: [], problems: [], labs: [], vitals: [],
  };
}

function row(values: Record<string, string | undefined>): Record<string, string> {
  const out: Record<string, string> = { id: crypto.randomUUID() };
  for (const [key, value] of Object.entries(values)) out[key] = value ?? "";
  return out;
}

function draftFrom(item: AuthoredCase): Draft {
  return {
    firstName: item.firstName,
    lastName: item.lastName,
    preferredName: item.preferredName ?? "",
    dob: item.dob.slice(0, 10),
    sexAtBirth: item.sexAtBirth,
    pronouns: item.pronouns ?? "",
    chiefComplaint: item.chiefComplaint,
    hpi: item.hpi,
    pastMedicalHistory: item.pastMedicalHistory,
    surgicalHistory: item.surgicalHistory,
    familyHistory: item.familyHistory,
    socialHistory: item.socialHistory,
    encounterType: item.encounter.type,
    careSetting: item.status.careSetting,
    lifecycle: item.status.lifecycle,
    encounterStatus: item.status.encounter,
    program: item.status.program ?? "",
    allergies: item.allergies.map((a) => row({ substance: a.substance, reaction: a.reaction, severity: a.severity })),
    medications: item.medications.map((m) => row({
      name: m.name, dose: m.dose, route: m.route, frequency: m.frequency, indication: m.indication, adherence: m.adherence,
    })),
    problems: item.problems.map((p) => row({ code: p.code, description: p.description, since: p.since })),
    labs: item.labs.map((l) => row({
      name: l.name, value: l.value, unit: l.unit, referenceRange: l.referenceRange, flag: l.flag, collectedAt: l.collectedAt.slice(0, 10),
    })),
    vitals: item.vitals.map((v) => row({ label: v.label, value: v.value })),
  };
}

export default function CaseEditorPage() {
  const { caseId = "new" } = useParams();
  const isNew = caseId === "new";
  const navigate = useNavigate();
  const { activeRole, courseId } = useSession();
  const existing = useAsync(() => (isNew ? Promise.resolve(undefined) : getCase(activeRole, caseId)), [isNew, caseId, activeRole]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadedId, setLoadedId] = useState("");

  usePageHeading(isNew ? "New case" : "Edit case");

  if (existing.data && existing.data.id !== loadedId) {
    setLoadedId(existing.data.id);
    setDraft(draftFrom(existing.data));
  }

  const set = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }));

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft.firstName.trim() || !draft.lastName.trim() || !draft.dob) {
      setError("First name, last name, and date of birth are required.");
      return;
    }
    const body: CaseInput = {
      firstName: draft.firstName.trim(),
      lastName: draft.lastName.trim(),
      preferredName: draft.preferredName.trim() || undefined,
      dob: draft.dob,
      sexAtBirth: draft.sexAtBirth,
      pronouns: draft.pronouns.trim() || undefined,
      chiefComplaint: draft.chiefComplaint,
      hpi: draft.hpi,
      pastMedicalHistory: draft.pastMedicalHistory,
      surgicalHistory: draft.surgicalHistory,
      familyHistory: draft.familyHistory,
      socialHistory: draft.socialHistory,
      encounterType: draft.encounterType,
      careSetting: draft.careSetting,
      lifecycle: draft.lifecycle,
      encounterStatus: draft.encounterStatus,
      program: draft.program.trim() || undefined,
      allergies: draft.allergies.filter((r) => r.substance.trim()).map((r) => ({
        substance: r.substance, reaction: r.reaction || undefined, severity: (r.severity || undefined) as CaseInput["allergies"][number]["severity"],
      })),
      medications: draft.medications.filter((r) => r.name.trim()).map((r) => ({
        name: r.name, dose: r.dose, route: r.route, frequency: r.frequency, indication: r.indication || undefined, adherence: r.adherence || undefined,
      })),
      problems: draft.problems.filter((r) => r.description.trim()).map((r) => ({
        code: r.code || undefined, description: r.description, since: r.since || undefined,
      })),
      labs: draft.labs.filter((r) => r.name.trim()).map((r) => ({
        name: r.name, value: r.value, unit: r.unit, referenceRange: r.referenceRange,
        flag: (r.flag || undefined) as "H" | "L" | undefined,
        collectedAt: r.collectedAt,
      })),
      vitals: draft.vitals.filter((r) => r.label.trim()).map((r) => ({ label: r.label, value: r.value })),
    };
    setBusy(true);
    setError("");
    try {
      const saved = isNew ? await createCase(activeRole, courseId, body) : await updateCase(activeRole, caseId, body);
      navigate(`/cases/${saved.id}`, { replace: true });
      if (!isNew) existing.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (existing.error) return <PageError error={existing.error} />;
  if (!isNew && !existing.data) return <LinearProgress aria-label="Loading case" />;

  return (
    <Stack component="form" spacing={2.5} onSubmit={save}>
      <Breadcrumbs aria-label="Breadcrumb">
        <Link component={RouterLink} to="/cases" underline="hover">Cases</Link>
        <Typography color="text.primary">{isNew ? "New case" : `${draft.lastName}, ${draft.firstName}`}</Typography>
      </Breadcrumbs>
      <Box>
        <Typography component="h1" variant="h5" sx={{ fontWeight: 700 }}>{isNew ? "New case" : `${draft.lastName}, ${draft.firstName}`}</Typography>
        <Typography variant="body2" color="text.secondary">
          {isNew ? "Students cannot see this master." : `${existing.data?.mrn}. Saving changes the master only. Assigned copies stay as they were.`}
        </Typography>
      </Box>
      {error && <Alert severity="error">{error}</Alert>}

      <Paper sx={{ p: { xs: 2, md: 2.5 } }}>
        <Typography component="h2" variant="h6" sx={{ mb: 1.5 }}>Demographics</Typography>
        <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" } }}>
          <TextField label="First name" required value={draft.firstName} onChange={(e) => set({ firstName: e.target.value })} />
          <TextField label="Last name" required value={draft.lastName} onChange={(e) => set({ lastName: e.target.value })} />
          <TextField label="Preferred name" value={draft.preferredName} onChange={(e) => set({ preferredName: e.target.value })} />
          <TextField label="Date of birth" type="date" required value={draft.dob} onChange={(e) => set({ dob: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField select label="Sex at birth" value={draft.sexAtBirth} onChange={(e) => set({ sexAtBirth: e.target.value as Draft["sexAtBirth"] })}>
            <MenuItem value="Female">Female</MenuItem>
            <MenuItem value="Male">Male</MenuItem>
          </TextField>
          <TextField label="Pronouns" value={draft.pronouns} onChange={(e) => set({ pronouns: e.target.value })} />
          <TextField label="Discipline" value={draft.program} onChange={(e) => set({ program: e.target.value })} placeholder="Pharmacy" />
        </Box>
      </Paper>

      <Paper sx={{ p: { xs: 2, md: 2.5 } }}>
        <Typography component="h2" variant="h6" sx={{ mb: 1.5 }}>Story</Typography>
        <Stack spacing={2}>
          <TextField label="Chief complaint" value={draft.chiefComplaint} onChange={(e) => set({ chiefComplaint: e.target.value })} fullWidth />
          <TextField label="History of present illness" value={draft.hpi} onChange={(e) => set({ hpi: e.target.value })} fullWidth multiline minRows={3} />
          <TextField label="Past medical history" value={draft.pastMedicalHistory} onChange={(e) => set({ pastMedicalHistory: e.target.value })} fullWidth multiline minRows={2} />
          <TextField label="Surgical history" value={draft.surgicalHistory} onChange={(e) => set({ surgicalHistory: e.target.value })} fullWidth multiline minRows={2} />
          <TextField label="Family history" value={draft.familyHistory} onChange={(e) => set({ familyHistory: e.target.value })} fullWidth multiline minRows={2} />
          <TextField label="Social history" value={draft.socialHistory} onChange={(e) => set({ socialHistory: e.target.value })} fullWidth multiline minRows={2} />
        </Stack>
      </Paper>

      <Paper sx={{ p: { xs: 2, md: 2.5 } }}>
        <Typography component="h2" variant="h6" sx={{ mb: 1.5 }}>Encounter</Typography>
        <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" } }}>
          <TextField label="Encounter type" value={draft.encounterType} onChange={(e) => set({ encounterType: e.target.value })} />
          <TextField select label="Care setting" value={draft.careSetting} onChange={(e) => set({ careSetting: e.target.value as CareSetting })}>
            {SETTING.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
          </TextField>
          <TextField select label="Lifecycle" value={draft.lifecycle} onChange={(e) => set({ lifecycle: e.target.value as LifecycleStatus })}>
            {LIFECYCLE.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
          </TextField>
          <TextField select label="Visit status" value={draft.encounterStatus} onChange={(e) => set({ encounterStatus: e.target.value as EncounterStatus })}>
            {ENCOUNTER.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
          </TextField>
        </Box>
      </Paper>

      <Paper sx={{ p: { xs: 2, md: 2.5 }, overflowX: "auto" }}>
        <EditableTable
          label="Allergies" addLabel="allergy" rows={draft.allergies} onChange={(allergies) => set({ allergies })}
          blank={{ substance: "", reaction: "", severity: "" }}
          columns={[
            { key: "substance", label: "Substance" },
            { key: "reaction", label: "Reaction" },
            { key: "severity", label: "Severity", type: "select", options: ["mild", "moderate", "severe"] },
          ]}
        />
      </Paper>
      <Paper sx={{ p: { xs: 2, md: 2.5 }, overflowX: "auto" }}>
        <EditableTable
          label="Medications" addLabel="medication" rows={draft.medications} onChange={(medications) => set({ medications })}
          blank={{ name: "", dose: "", route: "", frequency: "", indication: "", adherence: "" }}
          columns={[
            { key: "name", label: "Name" }, { key: "dose", label: "Dose" }, { key: "route", label: "Route" },
            { key: "frequency", label: "Frequency" }, { key: "indication", label: "Indication" }, { key: "adherence", label: "Adherence" },
          ]}
        />
      </Paper>
      <Paper sx={{ p: { xs: 2, md: 2.5 }, overflowX: "auto" }}>
        <EditableTable
          label="Problems" addLabel="problem" rows={draft.problems} onChange={(problems) => set({ problems })}
          blank={{ code: "", description: "", since: "" }}
          columns={[{ key: "code", label: "Code" }, { key: "description", label: "Description" }, { key: "since", label: "Since" }]}
        />
      </Paper>
      <Paper sx={{ p: { xs: 2, md: 2.5 }, overflowX: "auto" }}>
        <EditableTable
          label="Labs" addLabel="lab" rows={draft.labs} onChange={(labs) => set({ labs })}
          blank={{ name: "", value: "", unit: "", referenceRange: "", flag: "", collectedAt: "" }}
          columns={[
            { key: "name", label: "Test" }, { key: "value", label: "Result" }, { key: "unit", label: "Unit" },
            { key: "referenceRange", label: "Range" },
            { key: "flag", label: "Flag", type: "select", options: ["H", "L"] },
            { key: "collectedAt", label: "Collected", type: "date" },
          ]}
        />
      </Paper>
      <Paper sx={{ p: { xs: 2, md: 2.5 }, overflowX: "auto" }}>
        <EditableTable
          label="Vitals" addLabel="vital" rows={draft.vitals} onChange={(vitals) => set({ vitals })}
          blank={{ label: "", value: "" }}
          columns={[{ key: "label", label: "Label" }, { key: "value", label: "Value" }]}
        />
      </Paper>

      {isNew ? (
        <Paper sx={{ p: { xs: 2, md: 2.5 } }}>
          <Typography component="h2" variant="h6">Answer key</Typography>
          <Typography variant="body2" color="text.secondary">Save the case first. Then you can add the expected diagnoses.</Typography>
        </Paper>
      ) : (
        <Paper sx={{ p: { xs: 2, md: 2.5 } }}>
          <AnswerKeyEditor role={activeRole} caseId={caseId} />
        </Paper>
      )}

      <Box sx={{ display: "flex", gap: 1 }}>
        <Button type="submit" variant="contained" disabled={busy}>{isNew ? "Create case" : "Save case"}</Button>
        <Button type="button" onClick={() => navigate("/cases")}>Cancel</Button>
      </Box>
    </Stack>
  );
}
