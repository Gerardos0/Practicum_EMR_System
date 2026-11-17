import { Fragment, useState } from "react";
import { Box, Button, Paper, Typography } from "@mui/material";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { PatientRow } from "../../api/patients";
import { useSession } from "../auth/useSession";
import { can } from "../../utils/permissions";
import { utep } from "../../theme/tokens";
import CountTabs from "../../components/CountTabs";
import EmptyState from "../../components/EmptyState";
import { byPatientName, byRoom, isAssignedTo, isCheckedIn, isInRoom, isWaitingRoom, placeLabel } from "./tracker";

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

export default function PharmacyWorklist({ rows, query, onAssign, onReset, onUnassign }: Props) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { user, activeRole } = useSession();
  const isStudent = activeRole === "student";
  const canAssign = can(activeRole, "patient:create");
  const canReset = can(activeRole, "patient:reset_practice");
  const active = parseList(params.get("list")) ?? "mine";
  const [picked, setPicked] = useState<string | null>(null);

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
  const selected = current.rows.find((row) => row.patient.id === picked) ?? current.rows[0];

  const select = (id: BoardList) => {
    const next = new URLSearchParams(params);
    next.set("list", id);
    setParams(next, { replace: true });
  };

  return (
    <Paper sx={{ overflow: "hidden", borderRadius: "16px" }}>
      <CountTabs
        ariaLabel="Pharmacy lists"
        idPrefix="pharmacy-tab"
        panelId="pharmacy-panel"
        value={active}
        onChange={(id) => select(id as BoardList)}
        tabs={lists.map((list) => ({ id: list.id, label: list.label, count: list.rows.length }))}
        action={canAssign ? (
          <Button size="small" variant="contained" color="secondary" onClick={onAssign}>
            Assign case
          </Button>
        ) : undefined}
      />

      <Box role="tabpanel" id="pharmacy-panel" aria-labelledby={`pharmacy-tab-${current.id}`} sx={{ bgcolor: "#fff" }}>
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
          <Box sx={{ overflowX: "auto" }}>
            <Box
              component="table"
              sx={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: 720,
                "& th, & td": {
                  borderBottom: `1px solid ${utep.line}`,
                  px: 1.5,
                  py: 1,
                  textAlign: "left",
                  verticalAlign: "top",
                  fontSize: 14,
                  color: utep.ink,
                },
              }}
            >
              <Box component="thead">
                <Box component="tr" sx={{ "& th": { color: utep.navy, fontWeight: 800, bgcolor: utep.page } }}>
                  <Box component="th">Room</Box>
                  <Box component="th">Name</Box>
                  <Box component="th">Reason for visit</Box>
                  <Box component="th">Visit</Box>
                  <Box component="th" />
                </Box>
              </Box>
              <Box component="tbody">
                {current.rows.map((row) => {
                  const patient = row.patient;
                  const open = selected?.patient.id === patient.id;
                  const meds = patient.medications.filter((item) => item.status !== "discontinued" && item.status !== "entered_in_error");
                  const diagnosis = patient.problems[0]?.description || patient.chiefComplaint || "Not recorded";
                  return (
                    <Fragment key={patient.id}>
                      <Box
                        component="tr"
                        onClick={() => setPicked(patient.id)}
                        sx={{ bgcolor: open ? utep.orangeSoft : "#fff", cursor: "pointer" }}
                      >
                        <Box component="td">{placeLabel(patient) || "—"}</Box>
                        <Box component="td">
                          <Typography sx={{ fontWeight: 800, color: utep.navy, fontSize: 14 }}>
                            {patient.lastName}, {patient.firstName}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {row.ownerName || patient.practiceLabel || "Unassigned"}
                          </Typography>
                        </Box>
                        <Box component="td">{diagnosis}</Box>
                        <Box component="td">{patient.status.encounter}</Box>
                        <Box component="td" align="right">
                          <Button
                            size="small"
                            variant="contained"
                            color="secondary"
                            onClick={(event) => {
                              event.stopPropagation();
                              navigate(`/patients/${patient.id}`);
                            }}
                          >
                            Open
                          </Button>
                        </Box>
                      </Box>
                      {open && (
                        <Box component="tr" sx={{ bgcolor: utep.orangeSoft }}>
                          <Box component="td" colSpan={5} sx={{ pt: 0 }}>
                            {meds.length === 0 ? (
                              <Typography variant="body2" sx={{ py: 0.5 }}>No active medications.</Typography>
                            ) : (
                              <Box
                                component="table"
                                sx={{
                                  width: "100%",
                                  borderCollapse: "collapse",
                                  bgcolor: "#fff",
                                  "& th, & td": {
                                    border: `1px solid ${utep.line}`,
                                    px: 1,
                                    py: 0.75,
                                    fontSize: 13,
                                    textAlign: "left",
                                    color: utep.ink,
                                  },
                                }}
                              >
                                <Box component="thead">
                                  <Box component="tr" sx={{ "& th": { color: utep.navy, fontWeight: 800, bgcolor: utep.page } }}>
                                    <Box component="th">Medication</Box>
                                    <Box component="th">Instructions</Box>
                                    <Box component="th">Status</Box>
                                  </Box>
                                </Box>
                                <Box component="tbody">
                                  {meds.map((med) => (
                                    <Box component="tr" key={med.id}>
                                      <Box component="td" sx={{ fontWeight: 700 }}>{med.name}</Box>
                                      <Box component="td">{med.sig || [med.dose, med.route, med.frequency].filter(Boolean).join(" ")}</Box>
                                      <Box component="td" sx={{ textTransform: "capitalize" }}>{med.status || "active"}</Box>
                                    </Box>
                                  ))}
                                </Box>
                              </Box>
                            )}
                            <Box sx={{ display: "flex", gap: 1, pt: 1 }}>
                              {patient.mode === "practice" && canReset && (
                                <Button size="small" onClick={() => onReset(row)}>Reset</Button>
                              )}
                              {patient.mode === "assessment" && canAssign && patient.ownerId && (
                                <Button size="small" onClick={() => onUnassign(row)}>Remove</Button>
                              )}
                              {patient.mode === "simulation" && canAssign && (
                                <Button size="small" onClick={() => onUnassign(row)}>End</Button>
                              )}
                            </Box>
                          </Box>
                        </Box>
                      )}
                    </Fragment>
                  );
                })}
              </Box>
            </Box>
          </Box>
        )}
      </Box>
    </Paper>
  );
}
