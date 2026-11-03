import { Alert, Box, Chip, Container, LinearProgress, Paper, Stack, Typography } from "@mui/material";
import { request } from "../../api/client";
import { useAsync } from "../../utils/useAsync";
import { formatDate } from "../../utils/format";
import { trainingStripe, utep } from "../../theme/tokens";
import PageError from "../../components/PageError";
import { usePageHeading } from "../../components/PageHeading";

interface PortalChart {
  patient: { name: string; dob: string; mrn: string };
  labs: { name: string; value: string; unit: string; reference_range: string; flag?: string; collected_at?: string }[];
  last_visit: { date?: string; type?: string; summary?: string | null };
  prescribed_medications: { name: string; dose: string; route: string; frequency: string }[];
  medication_list: { name: string; dose: string; route: string; frequency: string; prescribed: boolean }[];
}

const PREVIEW_CHART: PortalChart = {
  patient: { name: "Alex Morgan", dob: "1994-06-12", mrn: "DEMO-2048" },
  labs: [
    { name: "Lipid panel", value: "168", unit: "mg/dL", reference_range: "< 200", collected_at: "2026-10-21" },
    { name: "Hemoglobin A1c", value: "5.8", unit: "%", reference_range: "4.0–5.6", flag: "H", collected_at: "2026-08-13" },
    { name: "Potassium", value: "4.2", unit: "mmol/L", reference_range: "3.5–5.1", collected_at: "2026-05-02" },
  ],
  last_visit: {
    date: "2026-10-21",
    type: "Office visit",
    summary: "Reviewed home blood pressure readings. Continue current medication and follow up in three months.",
  },
  prescribed_medications: [
    { name: "Lisinopril", dose: "10 mg", route: "oral", frequency: "once daily" },
  ],
  medication_list: [
    { name: "Lisinopril", dose: "10 mg", route: "oral", frequency: "once daily", prescribed: true },
    { name: "Vitamin D3", dose: "1000 IU", route: "oral", frequency: "once daily", prescribed: false },
  ],
};

export default function PatientPortalPage({ previewMode = false }: { previewMode?: boolean }) {
  usePageHeading(previewMode ? "Patient portal preview" : "My chart");
  const chart = useAsync(
    () => previewMode ? Promise.resolve(PREVIEW_CHART) : request<PortalChart>("/portal", { query: { role: "patient" } }),
    [previewMode],
  );
  if (chart.error) return <PageError error={chart.error} />;
  if (!chart.data) return <LinearProgress aria-label="Loading chart" />;
  const data = chart.data;

  const content = (
    <Stack spacing={2}>
      <Box>
        <Typography component="h1" variant="h5" sx={{ fontWeight: 700 }}>{data.patient.name}</Typography>
        <Typography variant="body2" color="text.secondary">
          DOB {formatDate(data.patient.dob)} · MRN {data.patient.mrn}. This view is read only.
        </Typography>
      </Box>
      <Paper sx={{ p: 2.5 }}>
        <Typography component="h2" variant="h6">Last visit</Typography>
        <Typography variant="body2" color="text.secondary">{data.last_visit.type || "No visit on file"}{data.last_visit.date ? ` · ${formatDate(data.last_visit.date)}` : ""}</Typography>
        <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", mt: 1 }}>{data.last_visit.summary || "No signed note is on this chart yet."}</Typography>
      </Paper>
      <Paper sx={{ p: 2.5 }}>
        <Typography component="h2" variant="h6">Prescribed medications</Typography>
        {data.prescribed_medications.length === 0 ? <Typography variant="body2" color="text.secondary">None listed.</Typography> : data.prescribed_medications.map((item) => (
          <Typography key={item.name} variant="body2">{item.name} {item.dose} {item.route} {item.frequency}</Typography>
        ))}
      </Paper>
      <Paper sx={{ p: 2.5 }}>
        <Typography component="h2" variant="h6">Medication list</Typography>
        {data.medication_list.map((item) => (
          <Typography key={`${item.name}-${item.dose}`} variant="body2">{item.name} {item.dose} {item.route} {item.frequency}</Typography>
        ))}
      </Paper>
      <Paper sx={{ p: 2.5 }}>
        <Typography component="h2" variant="h6">Labs</Typography>
        {data.labs.length === 0 ? <Typography variant="body2" color="text.secondary">None on file.</Typography> : data.labs.map((lab) => (
          <Typography key={`${lab.name}-${lab.collected_at}`} variant="body2">
            {lab.name}: {lab.value} {lab.unit} {lab.reference_range ? `(${lab.reference_range})` : ""}
          </Typography>
        ))}
      </Paper>
    </Stack>
  );

  if (!previewMode) return content;
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Paper
        component="header"
        sx={{ mb: 2, overflow: "hidden", bgcolor: utep.orange, color: utep.navy, borderBottom: `4px solid ${utep.navy}` }}
      >
        <Box aria-hidden sx={{ height: 6, background: trainingStripe }} />
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ alignItems: { sm: "center" }, justifyContent: "space-between", p: { xs: 2, sm: 3 } }}>
          <Box>
            <Typography variant="overline" sx={{ fontWeight: 800, letterSpacing: 1.1 }}>Patient portal</Typography>
            <Typography component="h1" variant="h4" sx={{ fontWeight: 800, lineHeight: 1.15 }}>Your health, at a glance</Typography>
            <Typography variant="body2" sx={{ mt: 0.5 }}>Visit details, medications, and recent lab results.</Typography>
          </Box>
          <Chip label="SIMULATED DATA" sx={{ bgcolor: utep.navy, color: "#fff", fontWeight: 800, alignSelf: { xs: "flex-start", sm: "center" } }} />
        </Stack>
      </Paper>
      <Alert severity="info" sx={{ mb: 2 }}>
        This read-only preview uses simulated patient information and does not access or save a real chart.
      </Alert>
      {content}
    </Container>
  );
}
