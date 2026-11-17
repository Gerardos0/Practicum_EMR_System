import { Box, Button, LinearProgress, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { listCoursesForUser } from "../../api/courses";
import { listPatients, type PatientRow } from "../../api/patients";
import { useSession } from "../auth/useSession";
import { useAsync } from "../../utils/useAsync";
import { usePageHeading } from "../../components/usePageHeading";
import { utep } from "../../theme/tokens";
import CensusRow from "../../components/CensusRow";
import EmptyState from "../../components/EmptyState";
import { Panel } from "../dashboard/components/DashboardParts";
import { byPatientName, hasAbnormalResults, placeLabel } from "../patients/tracker";
import type { Course, Patient } from "../../types";

const listSx = { listStyle: "none", m: 0, p: 0, containerType: "inline-size" } as const;

function assignmentLabel(patient: Patient, ownerName?: string) {
  if (ownerName) return ownerName;
  if (patient.mode === "practice") return patient.practiceLabel || "Practice";
  if (patient.mode === "simulation") return "Simulation";
  if (!patient.ownerId) return "Unassigned";
  return "Assigned";
}

function sexLetter(patient: Patient) {
  if (patient.sexAtBirth === "Male") return "M";
  if (patient.sexAtBirth === "Female") return "F";
  return patient.sexAtBirth;
}

export default function AdminHomePage() {
  usePageHeading("Administration");
  const { user } = useSession();
  const board = useAsync(async () => {
    const courses = await listCoursesForUser();
    const batches = await Promise.all(courses.map(async (course) => {
      const rows = await listPatients("admin", course.id);
      return rows
        .filter((row) => row.patient.status.encounter === "Checked in" && row.patient.mode !== "case")
        .map((row) => ({ row, course }));
    }));
    const checkedIn = batches.flat().sort((a, b) => {
      const course = a.course.code.localeCompare(b.course.code);
      return course || byPatientName(a.row, b.row);
    });
    return { courses, checkedIn };
  }, [user.id]);

  if (board.loading && !board.data) return <LinearProgress aria-label="Loading administration" />;

  const courses = board.data?.courses ?? [];
  const checkedIn = board.data?.checkedIn ?? [];

  return (
    <Box sx={{ display: "grid", gap: 2.5 }}>
      <Box sx={{ display: "grid", gap: 2.5, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" } }}>
        <Panel title="Classes" accent action={{ label: "Manage classes", to: "/admin/courses" }}>
          <Typography sx={{ fontSize: 40, fontWeight: 800, color: utep.navy, lineHeight: 1 }}>
            {courses.length}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Planned, active, ended, and archived classes.
          </Typography>
        </Panel>
        <Panel title="People" action={{ label: "Manage people", to: "/admin/people" }}>
          <Typography sx={{ color: utep.ink, maxWidth: "42ch" }}>
            Enroll students, add instructors, and add course coordinators for a class.
          </Typography>
        </Panel>
      </Box>

      <Panel title="Checked in" flush={checkedIn.length > 0}>
        {board.error ? (
          <Typography color="error">The checked-in list could not be loaded.</Typography>
        ) : checkedIn.length === 0 ? (
          <EmptyState title="No one is checked in">Patients show here when their visit status is Checked in.</EmptyState>
        ) : (
          <Box component="ul" aria-label="Patients checked in" sx={listSx}>
            {checkedIn.map(({ row, course }) => (
              <CheckedInRow key={row.patient.id} row={row} course={course} />
            ))}
          </Box>
        )}
      </Panel>
    </Box>
  );
}

function CheckedInRow({ row, course }: { row: PatientRow; course: Course }) {
  const navigate = useNavigate();
  const patient = row.patient;
  const initials = `${patient.firstName[0] ?? ""}${patient.lastName[0] ?? ""}`.toUpperCase();
  const abnormal = hasAbnormalResults(patient);
  const location = placeLabel(patient);
  const open = () => navigate(`/patients/${patient.id}`);
  return (
    <CensusRow
      initials={initials}
      title={`${patient.lastName}, ${patient.firstName}`}
      meta={`${patient.ageYears}y ${sexLetter(patient)} · ${assignmentLabel(patient, row.ownerName)}${location ? ` · ${location}` : ""}${abnormal ? " · Abnormal results" : ""}`}
      primary={course.code}
      secondary={patient.chiefComplaint || "No chief complaint"}
      highlight={abnormal}
      onOpen={open}
      ariaLabel={`Open chart for ${patient.lastName}, ${patient.firstName}${abnormal ? ", abnormal results" : ""}`}
      actions={(
        <Button size="small" variant="contained" color="secondary" onClick={open}>
          Open
        </Button>
      )}
    />
  );
}
