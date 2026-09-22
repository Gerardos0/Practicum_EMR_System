import { useState } from "react";
import {
  Box,
  Typography,
  Breadcrumbs,
  Link,
  Paper,
  TextField,
  MenuItem,
  Button,
  Divider,
  Alert,
} from "@mui/material";
import { useNavigate, useParams, Link as RouterLink } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import {
  patients,
  submittedNotes,
  currentUser,
  type ClinicalNote,
} from "../data/mockData";

const ICD_OPTIONS = [
  "E11.65 — T2DM with hyperglycemia",
  "E11.9 — T2DM without complications",
  "Z79.84 — Long term use of oral hypoglycemics",
];

export default function NoteForm() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const patient = patients.find((p) => p.id === patientId) ?? patients[0];

  const [icd10, setIcd10] = useState("");
  const [subjective, setSubjective] = useState("");
  const [objective, setObjective] = useState("");
  const [assessment, setAssessment] = useState("");
  const [plan, setPlan] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const canSubmit =
    icd10.trim() !== "" &&
    subjective.trim() !== "" &&
    objective.trim() !== "" &&
    assessment.trim() !== "" &&
    plan.trim() !== "";

  const handleSubmit = () => {
    const note: ClinicalNote = {
      id: `n_${Date.now()}`,
      patientId: patient.id,
      authorName: currentUser.fullName,
      authorDiscipline: currentUser.discipline,
      submittedAt: new Date().toLocaleString(),
      status: "pending_review",
      icd10,
      subjective,
      objective,
      assessment,
      plan,
    };
    submittedNotes.unshift(note);
    setSubmitted(true);
  };

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "grey.50" }}>
      <AppHeader />

      <Box sx={{ px: 4, pt: 1.5, pb: 1 }}>
        <Breadcrumbs>
          <Link component={RouterLink} to="/patients" underline="hover">
            Patients
          </Link>
          <Link component={RouterLink} to={`/patients/${patient.id}`} underline="hover">
            {patient.lastName}, {patient.firstName}
          </Link>
          <Typography color="text.primary">New note</Typography>
        </Breadcrumbs>
      </Box>

      <Box sx={{ mx: 4, mb: 3, display: "flex", gap: 2.5 }}>
        <Paper elevation={1} sx={{ flexGrow: 1, p: 3, display: "flex", flexDirection: "column", gap: 2.5 }}>
          <Box sx={{ display: "flex", alignItems: "baseline", gap: 1.5 }}>
            <Typography variant="h6">SOAP note</Typography>
            <Typography variant="body2" color="text.secondary">
              Pharmacy template &middot; draft
            </Typography>
          </Box>

          {submitted && (
            <Alert severity="success">
              Submitted for signature. Status is now Pending review — see the
              instructor review queue.
            </Alert>
          )}

          <TextField
            label="Subjective"
            placeholder="Chief complaint, HPI, relevant history as reported by the patient..."
            multiline
            minRows={4}
            fullWidth
            value={subjective}
            onChange={(e) => setSubjective(e.target.value)}
            disabled={submitted}
          />
          <TextField
            label="Objective"
            placeholder="Vitals, exam findings, labs relevant to this visit..."
            multiline
            minRows={3}
            fullWidth
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            disabled={submitted}
          />

          <Box sx={{ display: "flex", gap: 2 }}>
            <TextField
              select
              label="ICD-10 code"
              placeholder="Select a code"
              sx={{ width: 300, flexShrink: 0 }}
              value={icd10}
              onChange={(e) => setIcd10(e.target.value)}
              disabled={submitted}
            >
              {ICD_OPTIONS.map((opt) => (
                <MenuItem key={opt} value={opt}>
                  {opt}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Assessment — clinical rationale"
              placeholder="Why this diagnosis, what the data supports..."
              multiline
              minRows={2}
              fullWidth
              value={assessment}
              onChange={(e) => setAssessment(e.target.value)}
              disabled={submitted}
            />
          </Box>

          <TextField
            label="Plan"
            placeholder="Numbered next steps: medications, education, follow-up, referrals..."
            multiline
            minRows={4}
            fullWidth
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            disabled={submitted}
          />

          <Divider />

          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Typography variant="caption" color="text.secondary">
              {submitted ? "Submitted" : "Autosaved as draft"}
            </Typography>
            <Box sx={{ flexGrow: 1 }} />
            <Button
              variant="outlined"
              onClick={() => navigate(`/patients/${patient.id}`)}
            >
              Save draft
            </Button>
            <Button
              variant="contained"
              disabled={submitted || !canSubmit}
              onClick={handleSubmit}
            >
              Submit for signature
            </Button>
            {submitted && (
              <Button variant="text" onClick={() => navigate("/review")}>
                Go to review queue
              </Button>
            )}
          </Box>
        </Paper>

        <Paper elevation={1} sx={{ width: 300, flexShrink: 0, p: 2.5, display: "flex", flexDirection: "column", gap: 2 }}>
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Encounter</Typography>
            <Typography variant="body2" color="text.secondary">
              {patient.lastName}, {patient.firstName} &middot; MRN {patient.mrn}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Office visit &middot; 2026-09-22
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Author: {currentUser.fullName}, {currentUser.discipline}
            </Typography>
          </Box>

          <TextField select label="Route for co-signature" defaultValue="mejia" disabled={submitted}>
            <MenuItem value="mejia">Mejía, Daniel — Instructor</MenuItem>
            <MenuItem value="unassigned">Unassigned</MenuItem>
          </TextField>

          <Alert severity="warning" sx={{ fontSize: 13 }}>
            You can sign this note as its author, but it stays Pending
            review until an instructor co-signs. Prescribing actions are
            simulated.
          </Alert>

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Note status</Typography>
            <StatusRow label="Draft" active={!submitted} done={submitted} />
            <StatusRow label="Pending review" active={submitted} />
            <StatusRow label="Co-signed" />
          </Box>
        </Paper>
      </Box>
    </Box>
  );
}

function StatusRow({ label, active, done }: { label: string; active?: boolean; done?: boolean }) {
  const color = active || done ? "primary.main" : "action.disabled";
  const textColor = active || done ? "text.primary" : "text.disabled";
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
      <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: color }} />
      <Typography variant="body2" color={textColor}>
        {label}
      </Typography>
    </Box>
  );
}