import { Box, LinearProgress, Paper, Stack, Typography } from "@mui/material";
import { request } from "../../api/client";
import { useAsync } from "../../utils/useAsync";
import { formatDate } from "../../utils/format";
import PageError from "../../components/PageError";
import { usePageHeading } from "../../components/PageHeading";

interface PortalChart {
  patient: { name: string; dob: string; mrn: string };
  labs: { name: string; value: string; unit: string; reference_range: string; flag?: string; collected_at?: string }[];
  last_visit: { date?: string; type?: string; summary?: string | null };
  prescribed_medications: { name: string; dose: string; route: string; frequency: string }[];
  medication_list: { name: string; dose: string; route: string; frequency: string; prescribed: boolean }[];
}

export default function PatientPortalPage() {
  usePageHeading("My chart");
  const chart = useAsync(() => request<PortalChart>("/portal", { query: { role: "patient" } }), []);
  if (chart.error) return <PageError error={chart.error} />;
  if (!chart.data) return <LinearProgress aria-label="Loading chart" />;
  const data = chart.data;

  return (
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
}
