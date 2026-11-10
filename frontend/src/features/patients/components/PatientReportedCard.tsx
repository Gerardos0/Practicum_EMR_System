import { Alert, Box, LinearProgress, Paper, Stack, Typography } from "@mui/material";
import { getStaffIntake } from "../../../api/intake";
import { useSession } from "../../auth/useSession";
import { formatDateTime } from "../../../utils/format";
import { useAsync } from "../../../utils/useAsync";
import { utep } from "../../../theme/tokens";

function ValueRow({ label, value }: { label: string; value: string | boolean | string[] }) {
  const display = Array.isArray(value) ? value.join(", ") : typeof value === "boolean" ? (value ? "Yes" : "No") : value;
  return (
    <Typography variant="body2">
      <b>{label}:</b> {display || <Typography component="span" variant="body2" color="text.secondary">Not on file</Typography>}
    </Typography>
  );
}

export default function PatientReportedCard({ patientId }: { patientId: string }) {
  const { activeRole } = useSession();
  const intake = useAsync(() => getStaffIntake(patientId, activeRole), [patientId, activeRole]);

  if (intake.loading && !intake.data) return <LinearProgress aria-label="Loading patient-reported information" />;
  if (intake.error && !intake.data) return <Alert severity="error">{intake.error.message}</Alert>;
  if (!intake.data) return null;

  const card = { p: 2.5, borderRadius: "16px" } as const;
  const titleSx = { color: utep.navy, fontSize: 18, mb: 1.5 } as const;
  const data = intake.data.data;
  const group = (title: string, children: React.ReactNode) => (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>{title}</Typography>
      <Stack spacing={0.35}>{children}</Stack>
    </Box>
  );
  const list = (label: string, items: string[]) => (
    <Box>
      <Typography variant="subtitle2">{label}</Typography>
      {items.length ? items.map((item, index) => <Typography key={`${label}-${index}`} variant="body2">{item}</Typography>) : (
        <Typography variant="body2" color="text.secondary">Not on file</Typography>
      )}
    </Box>
  );

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
        <Stack spacing={2}>
          {group("Demographics", <>
            <ValueRow label="Preferred name" value={data?.preferredName ?? ""} />
            <ValueRow label="Pronouns" value={data?.pronouns ?? ""} />
            <ValueRow label="Gender identity" value={data?.genderIdentity ?? ""} />
            <ValueRow label="Race" value={data?.race ?? []} />
            <ValueRow label="Ethnicity" value={data?.ethnicity ?? ""} />
            <ValueRow label="Marital status" value={data?.maritalStatus ?? ""} />
            <ValueRow label="Preferred language" value={data?.preferredLanguage ?? ""} />
            <ValueRow label="Interpreter needed" value={data?.interpreterNeeded ?? false} />
          </>)}
          {group("Contact", <>
            <ValueRow label="Phone" value={data?.phone ?? ""} />
            <ValueRow label="Phone type" value={data?.phoneType ?? ""} />
            <ValueRow label="Email" value={data?.email ?? ""} />
            <ValueRow label="Street address" value={data?.address ?? ""} />
            <ValueRow label="City" value={data?.city ?? ""} />
            <ValueRow label="State" value={data?.state ?? ""} />
            <ValueRow label="ZIP code" value={data?.zipCode ?? ""} />
          </>)}
          {group("Insurance", <>
            <ValueRow label="Primary carrier" value={data?.insurancePayer ?? ""} />
            <ValueRow label="Plan type" value={data?.insurancePlanType ?? ""} />
            <ValueRow label="Member ID" value={data?.insuranceMemberId ?? ""} />
            <ValueRow label="Group number" value={data?.insuranceGroupNumber ?? ""} />
            <ValueRow label="Subscriber is patient" value={data?.insuranceSubscriberIsPatient ?? true} />
            <ValueRow label="Subscriber name" value={data?.insuranceSubscriberName ?? ""} />
            <ValueRow label="Subscriber date of birth" value={data?.insuranceSubscriberDob ?? ""} />
            <ValueRow label="Relationship" value={data?.insuranceRelationship ?? ""} />
            <ValueRow label="Effective date" value={data?.insuranceEffectiveDate ?? ""} />
            <ValueRow label="Secondary carrier" value={data?.secondaryInsurancePayer ?? ""} />
            <ValueRow label="Secondary member ID" value={data?.secondaryInsuranceMemberId ?? ""} />
            <ValueRow label="Secondary group number" value={data?.secondaryInsuranceGroupNumber ?? ""} />
            <ValueRow label="Secondary relationship" value={data?.secondaryInsuranceRelationship ?? ""} />
          </>)}
          {group("Medical history", <>
            {list("Conditions", (data?.conditions ?? []).map((item) => `${item.name}${item.year ? ` (${item.year})` : ""}`))}
            <ValueRow label="Other conditions" value={data?.pastMedicalHistory ?? ""} />
            {list("Surgeries", (data?.surgeries ?? []).map((item) => `${item.procedure}${item.year ? ` (${item.year})` : ""}`))}
            {list("Allergies", data?.noKnownAllergies && !data.allergies.length ? ["No known allergies"] : (data?.allergies ?? []).map((item) => `${item.agent}${item.reaction ? ` — ${item.reaction}` : ""}`))}
            {list("Medications", (data?.medications ?? []).map((item) => `${item.name}${item.dose ? ` ${item.dose}` : ""}${item.frequency ? ` ${item.frequency}` : ""}`))}
            <ValueRow label="Other surgeries or procedures" value={data?.surgicalHistory ?? ""} />
          </>)}
          {group("Family history", <>
            {(data?.familyMembers ?? []).map((item, index) => <Typography key={`${item.relative}-${index}`} variant="body2">{item.relative}{item.status ? ` · ${item.status}` : ""}{item.conditions ? `: ${item.conditions}` : ""}</Typography>)}
            <ValueRow label="Other family history" value={data?.familyHistory ?? ""} />
          </>)}
          {group("Social history", <>
            <ValueRow label="Tobacco use" value={data?.tobaccoUse ?? ""} />
            <ValueRow label="Tobacco details" value={data?.tobaccoDetail ?? ""} />
            <ValueRow label="Alcohol use" value={data?.alcoholUse ?? ""} />
            <ValueRow label="Alcohol details" value={data?.alcoholDetail ?? ""} />
            <ValueRow label="Drug use" value={data?.drugUse ?? ""} />
            <ValueRow label="Occupation" value={data?.occupation ?? ""} />
            <ValueRow label="Lives with" value={data?.livesWith ?? ""} />
            <ValueRow label="Exercise" value={data?.exercise ?? ""} />
            <ValueRow label="Other notes on lifestyle" value={data?.socialHistory ?? ""} />
          </>)}
          {group("Emergency contact and pharmacy", <>
            <ValueRow label="Name" value={data?.emergencyContactName ?? ""} />
            <ValueRow label="Phone" value={data?.emergencyContactPhone ?? ""} />
            <ValueRow label="Relationship" value={data?.emergencyContactRelationship ?? ""} />
            <ValueRow label="Preferred pharmacy" value={data?.preferredPharmacy ?? ""} />
          </>)}
        </Stack>
      )}
    </Paper>
  );
}
