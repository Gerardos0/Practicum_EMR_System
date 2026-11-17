import { Box, Button, Typography } from "@mui/material";
import type { PatientRow } from "../../api/patients";
import type { Patient } from "../../types";
import { canChartPatient } from "../chart/access";
import NoteStatusChip from "../../components/NoteStatusChip";
import CensusRow from "../../components/CensusRow";
import { isAssignedTo, isInRoom, placeLabel } from "./tracker";

const WIDE = "@container (min-width: 720px)";

interface Props {
  row: PatientRow;
  isStudent: boolean;
  userId: string;
  canAssign?: boolean;
  canReset?: boolean;
  onOpen: () => void;
  onReset?: () => void;
  onUnassign?: () => void;
  primary?: string;
  secondary?: string;
  noteCaption?: string;
}

export default function TrackerRow({
  row, isStudent, userId, canAssign = false, canReset = false, onOpen, onReset, onUnassign, primary, secondary, noteCaption,
}: Props) {
  const p = row.patient;
  const chartable = canChartPatient(isStudent ? "student" : "instructor", p, userId);
  const viewOnly = isStudent && !chartable;
  const mine = isAssignedTo(p, userId);
  const initials = `${p.firstName[0] ?? ""}${p.lastName[0] ?? ""}`.toUpperCase();
  const sex = p.sexAtBirth === "Male" ? "M" : p.sexAtBirth === "Female" ? "F" : p.sexAtBirth;

  return (
    <CensusRow
      initials={initials}
      title={`${p.lastName}, ${p.firstName}`}
      meta={`${p.ageYears}y ${sex} · ${assignmentLabel(p, row.ownerName)}`}
      primary={primary ?? (isInRoom(p) ? placeLabel(p) : p.status.encounter)}
      secondary={secondary ?? (p.chiefComplaint || "No chief complaint")}
      highlight={mine}
      onOpen={onOpen}
      ariaLabel={`Open chart for ${p.lastName}, ${p.firstName}`}
      note={(
        <Box>
          <NoteStatusChip status={row.latestNote?.status} />
          {noteCaption && (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25 }}>
              {noteCaption}
            </Typography>
          )}
        </Box>
      )}
      actions={(
        <>
          {p.mode === "practice" && canReset && onReset && (
            <Button size="small" color="inherit" onClick={onReset} sx={{ display: "none", [WIDE]: { display: "inline-flex" } }}>
              Reset
            </Button>
          )}
          {p.mode === "assessment" && canAssign && row.patient.ownerId && onUnassign && (
            <Button size="small" color="inherit" onClick={onUnassign} sx={{ display: "none", [WIDE]: { display: "inline-flex" } }}>
              Remove
            </Button>
          )}
          <Button
            size="small"
            variant={viewOnly ? "outlined" : "contained"}
            color={viewOnly ? "primary" : "secondary"}
            onClick={onOpen}
          >
            {viewOnly ? "Review" : "Open"}
          </Button>
        </>
      )}
    />
  );
}

function assignmentLabel(patient: Patient, ownerName?: string) {
  if (ownerName) return ownerName;
  if (patient.mode === "practice") return patient.practiceLabel || "Practice";
  if (!patient.ownerId) return "Unassigned";
  return "Assigned";
}
