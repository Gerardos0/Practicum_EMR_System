import {
  Box,
  Typography,
  Breadcrumbs,
  Link,
  Chip,
  Tabs,
  Tab,
  Paper,
  Divider,
  Button,
} from "@mui/material";
import { useNavigate, useParams, Link as RouterLink } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import { patients, submittedNotes } from "../data/mockData";

export default function PatientChart() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const patient = patients.find((p) => p.id === patientId) ?? patients[0];
  const notesForPatient = submittedNotes.filter((n) => n.patientId === patient.id);

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "grey.50" }}>
      <AppHeader />

      <Box sx={{ px: 4, pt: 1.5 }}>
        <Breadcrumbs sx={{ mb: 1.5 }}>
          <Link component={RouterLink} to="/patients" underline="hover">
            Patients
          </Link>
          <Typography color="text.primary">
            {patient.lastName}, {patient.firstName}
          </Typography>
        </Breadcrumbs>
      </Box>

      <Paper elevation={1} sx={{ mx: 4, p: 2.5, display: "flex", alignItems: "center", gap: 3 }}>
        <Box>
          <Typography variant="h6">
            {patient.lastName}, {patient.firstName}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            MRN {patient.mrn} &middot; {patient.ageYears} y &middot; {patient.sex} &middot; DOB {patient.dob}
          </Typography>
        </Box>
        <Box sx={{ flexGrow: 1 }} />
        {patient.allergy && (
          <Chip label={`Allergy: ${patient.allergy}`} color="error" size="small" />
        )}
        <Chip label={patient.encounterStatus} color="info" size="small" />
        <Chip label="Test / Training" color="warning" size="small" />
      </Paper>

      <Paper elevation={1} square sx={{ mx: 4, borderTop: "none" }}>
        <Tabs value={0}>
          <Tab label="Summary" />
          <Tab label="Notes" />
          <Tab label="Medications" />
          <Tab label="Labs" />
          <Tab label="Orders" disabled />
        </Tabs>
      </Paper>

      <Box sx={{ mx: 4, mb: 3, p: 2.5, bgcolor: "background.paper", display: "flex", gap: 2.5 }}>
        <Box sx={{ width: 380, flexShrink: 0, display: "flex", flexDirection: "column", gap: 2 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Medications</Typography>
            {patient.medications.map((m) => (
              <Typography variant="body2" key={m}>{m}</Typography>
            ))}
          </Paper>

          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Problem list</Typography>
            {patient.problems.map((pr) => (
              <Typography variant="body2" key={pr}>{pr}</Typography>
            ))}
          </Paper>

          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Recent labs</Typography>
            {patient.labs.map((l) => (
              <Box key={l.name} sx={{ display: "flex", justifyContent: "space-between" }}>
                <Typography variant="body2">{l.name}</Typography>
                <Typography variant="body2" color={l.flag ? "error" : "text.primary"} sx={{ fontWeight: l.flag ? 600 : 400 }}>
                  {l.value}{l.flag ? `  ${l.flag}` : ""}
                </Typography>
              </Box>
            ))}
          </Paper>

          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Vitals — today</Typography>
            {patient.vitals.map((v) => (
              <Box key={v.label} sx={{ display: "flex", justifyContent: "space-between" }}>
                <Typography variant="body2">{v.label}</Typography>
                <Typography variant="body2">{v.value}</Typography>
              </Box>
            ))}
          </Paper>
        </Box>

        <Box sx={{ flexGrow: 1, display: "flex", flexDirection: "column", gap: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Typography variant="subtitle1">Encounter — Office visit, 2026-09-22</Typography>
            <Box sx={{ flexGrow: 1 }} />
            <Button variant="contained" onClick={() => navigate(`/patients/${patient.id}/note`)}>
              Add SOAP note
            </Button>
          </Box>

          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Chief complaint</Typography>
            <Typography variant="body2">{patient.chiefComplaint}</Typography>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2, flexGrow: 1 }}>
            <Typography variant="subtitle2" sx={{ mb: 1.5 }}>Notes on this encounter</Typography>
            {notesForPatient.length === 0 ? (
              <Box sx={{ border: "1px dashed", borderColor: "divider", borderRadius: 1, p: 3.5, textAlign: "center" }}>
                <Typography variant="body2" color="text.secondary">
                  No notes have been written for this encounter.
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Use Add SOAP note to begin documentation.
                </Typography>
              </Box>
            ) : (
              notesForPatient.map((n) => (
                <Box key={n.id} sx={{ mb: 1.5 }}>
                  <Divider sx={{ mb: 1.5 }} />
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {n.authorName} &middot; {n.status.replace("_", " ")}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {n.icd10}
                  </Typography>
                </Box>
              ))
            )}
          </Paper>

          <Typography variant="caption" color="text.secondary">
            Chart opened 2026-09-22 16:41 — this view was written to the audit log.
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
