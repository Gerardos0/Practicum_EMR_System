import { Alert, LinearProgress, Paper, Stack, Typography } from "@mui/material";
import { getStaffIntake } from "../../../api/intake";
import { useSession } from "../../auth/AuthContext";
import { formatDateTime } from "../../../utils/format";
import { useAsync } from "../../../utils/useAsync";
import { utep } from "../../../theme/tokens";

export default function PatientReportedCard({ patientId }: { patientId: string }) {
  const { activeRole } = useSession();
  const intake = useAsync(() => getStaffIntake(patientId, activeRole), [patientId, activeRole]);

  if (intake.loading && !intake.data) return <LinearProgress aria-label="Loading patient-reported information" />;
  if (intake.error && !intake.data) return <Alert severity="error">{intake.error.message}</Alert>;
  if (!intake.data) return null;

  const card = { p: 2.5, borderRadius: "16px" } as const;
  const titleSx = { color: utep.navy, fontSize: 18, mb: 1.5 } as const;
  const fields: [string, string][] = intake.data.data ? [
    ["Preferred name", intake.data.data.preferredName],
    ["Pronouns", intake.data.data.pronouns],
    ["Phone", intake.data.data.phone],
    ["Address", intake.data.data.address],
    ["Preferred language", intake.data.data.preferredLanguage],
    ["Past medical history", intake.data.data.pastMedicalHistory],
    ["Surgical history", intake.data.data.surgicalHistory],
    ["Family history", intake.data.data.familyHistory],
    ["Social history", intake.data.data.socialHistory],
    ["Insurance payer", intake.data.data.insurancePayer],
    ["Insurance member ID", intake.data.data.insuranceMemberId],
    ["Insurance group number", intake.data.data.insuranceGroupNumber],
    ["Emergency contact", intake.data.data.emergencyContactName],
    ["Emergency contact phone", intake.data.data.emergencyContactPhone],
    ["Emergency contact relationship", intake.data.data.emergencyContactRelationship],
  ] : [];

  return (
    <Paper sx={card}>
      <Typography component="h2" variant="h6" sx={titleSx}>Patient-reported information</Typography>
      {intake.data.updatedAt && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Updated {formatDateTime(intake.data.updatedAt)}
        </Typography>
      )}
      {!intake.data.submitted ? (
        <Typography variant="body2" color="text.secondary">The patient has not submitted information yet.</Typography>
      ) : (
        <Stack spacing={0.5}>
          {fields.map(([label, value]) => (
            <Typography key={label} variant="body2">
              <b>{label}:</b> {value || <Typography component="span" variant="body2" color="text.secondary">Not on file</Typography>}
            </Typography>
          ))}
        </Stack>
      )}
    </Paper>
  );
}
