import { Box, Button, Paper } from "@mui/material";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { PatientRow } from "../../api/patients";
import { useSession } from "../auth/useSession";
import { can } from "../../utils/permissions";
import CountTabs from "../../components/CountTabs";
import EmptyState from "../../components/EmptyState";
import { byPatientName, byRoom, isAssignedTo, isCheckedIn, isInRoom, isWaitingRoom } from "./tracker";
import TrackerRow from "./TrackerRow";

interface Props {
  rows: PatientRow[];
  query: string;
  onAssign: () => void;
  onReset: (row: PatientRow) => void;
  onUnassign: (row: PatientRow) => void;
}

type BoardList = "mine" | "checked" | "room" | "waiting";

const LISTS: BoardList[] = ["mine", "waiting", "checked", "room"];

function parseList(value: string | null): BoardList | undefined {
  return LISTS.find((id) => id === value);
}

export default function StatusBoard({ rows, query, onAssign, onReset, onUnassign }: Props) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { user, activeRole } = useSession();
  const isStudent = activeRole === "student";
  const canAssign = can(activeRole, "patient:create");
  const canReset = can(activeRole, "patient:reset_practice");
  const active = parseList(params.get("list")) ?? "mine";

  const waiting = rows.filter((row) => isWaitingRoom(row.patient)).sort(byPatientName);
  const checkedIn = rows.filter((row) => isCheckedIn(row.patient)).sort(byPatientName);
  const inRoom = rows.filter((row) => isInRoom(row.patient)).sort(byRoom);
  const mine = rows
    .filter((row) => (isStudent ? isAssignedTo(row.patient, user.id) : Boolean(row.patient.ownerId)))
    .sort(byPatientName);

  const lists: { id: BoardList; label: string; rows: PatientRow[]; emptyTitle: string; emptyBody: string }[] = [
    {
      id: "mine",
      label: isStudent ? "My list" : "Assigned",
      rows: mine,
      emptyTitle: isStudent ? "No patients are on your list yet" : "No patients are assigned yet",
      emptyBody: isStudent ? "Your instructor will assign charts here." : "Assign a case to put a student copy on this list.",
    },
    {
      id: "waiting",
      label: "Waiting room",
      rows: waiting,
      emptyTitle: "The waiting room is empty",
      emptyBody: "Patients show up here until they are checked in.",
    },
    {
      id: "checked",
      label: "Checked in",
      rows: checkedIn,
      emptyTitle: "No one is checked in",
      emptyBody: "Checking a patient in moves them here. Rooming them moves them to In a room.",
    },
    {
      id: "room",
      label: "In a room",
      rows: inRoom,
      emptyTitle: "No one is in a room",
      emptyBody: "Roomed and in-progress visits show up here.",
    },
  ];
  const current = lists.find((list) => list.id === active) ?? lists[0];

  const select = (id: BoardList) => {
    const next = new URLSearchParams(params);
    next.set("list", id);
    setParams(next, { replace: true });
  };

  return (
    <Paper sx={{ overflow: "hidden", borderRadius: "16px" }}>
      <CountTabs
        ariaLabel="Clinic lists"
        idPrefix="tracker-tab"
        panelId="tracker-panel"
        value={active}
        onChange={(id) => select(id as BoardList)}
        tabs={lists.map((list) => ({ id: list.id, label: list.label, count: list.rows.length }))}
        action={canAssign ? (
          <Button size="small" variant="contained" color="secondary" onClick={onAssign}>
            Assign case
          </Button>
        ) : undefined}
      />

      <Box
        role="tabpanel"
        id="tracker-panel"
        aria-labelledby={`tracker-tab-${current.id}`}
        sx={{ bgcolor: "#fff" }}
      >
        {current.rows.length === 0 ? (
          <Box sx={{ px: 2, py: 2.5 }}>
            <EmptyState
              title={query ? "No patients match that search" : current.emptyTitle}
              action={!query && current.id !== "room" && canAssign ? <Button variant="contained" onClick={onAssign}>Assign case</Button> : undefined}
            >
              {query ? "Try a last name, a date of birth, or the full MRN." : current.emptyBody}
            </EmptyState>
          </Box>
        ) : (
          <Box component="ul" aria-label={current.label} sx={{ listStyle: "none", m: 0, p: 0, containerType: "inline-size" }}>
            {current.rows.map((row) => (
              <TrackerRow
                key={row.patient.id}
                row={row}
                isStudent={isStudent}
                userId={user.id}
                canAssign={canAssign}
                canReset={canReset}
                onOpen={() => navigate(`/patients/${row.patient.id}`)}
                onReset={() => onReset(row)}
                onUnassign={() => onUnassign(row)}
              />
            ))}
          </Box>
        )}
      </Box>
    </Paper>
  );
}
