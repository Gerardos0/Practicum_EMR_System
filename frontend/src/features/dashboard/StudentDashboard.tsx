import { useState } from "react";
import { Box, LinearProgress } from "@mui/material";
import AssignmentOutlined from "@mui/icons-material/AssignmentOutlined";
import PeopleAltOutlined from "@mui/icons-material/PeopleAltOutlined";
import ReplayOutlined from "@mui/icons-material/ReplayOutlined";
import ScienceOutlined from "@mui/icons-material/ScienceOutlined";
import { useNavigate } from "react-router-dom";
import { listPatients, type PatientRow } from "../../api/patients";
import { caseloadHref, matchesCaseload } from "../patients/caseload";
import TrackerRow from "../patients/TrackerRow";
import { useSession } from "../auth/useSession";
import { useAsync } from "../../utils/useAsync";
import EmptyState from "../../components/EmptyState";
import { Panel, StatCard, StatGrid } from "./components/DashboardParts";
import { DAY_MS, since } from "./dashboardFormat";
const listSx = { listStyle: "none", m: 0, p: 0, containerType: "inline-size" } as const;

export default function StudentDashboard() {
  const navigate = useNavigate();
  const { user, activeRole, courseId } = useSession();
  const patients = useAsync(() => listPatients(activeRole, courseId), [activeRole, courseId]);
  const [now] = useState(() => Date.now());

  if (patients.loading && !patients.data) return <LinearProgress />;

  const rows = patients.data ?? [];
  const assessment = rows.filter((r) => matchesCaseload(r, "assigned", user.id));
  const practice = rows.filter((r) => matchesCaseload(r, "practice", user.id));
  const inProgress = rows.filter((r) => matchesCaseload(r, "in-clinic", user.id));
  const returned = rows.filter((r) => matchesCaseload(r, "returned"));
  const pending = rows.filter((r) => matchesCaseload(r, "awaiting"));
  const flagged = rows.filter((r) => r.patient.labs.some((l) => l.flag));
  const doseFlags = rows.filter((r) => (r.openFlagCount ?? 0) > 0);
  const recentNotes = [...rows]
    .filter((r) => r.latestNote)
    .sort((a, b) => new Date(b.latestNote!.updatedAt).getTime() - new Date(a.latestNote!.updatedAt).getTime())
    .slice(0, 6);
  const stale = assessment.filter((r) => {
    const note = r.latestNote;
    if (!note || note.status === "cosigned") return false;
    return now - new Date(note.updatedAt).getTime() >= DAY_MS;
  });
  const continueRows = (stale.length ? stale : assessment).slice(0, 8);

  const open = (row: PatientRow) => navigate(`/patients/${row.patient.id}`);

  return (
    <Box sx={{ display: "grid", gap: 2.5 }}>
      <StatGrid title="Your caseload">
        <StatCard
          label="Assigned patients"
          value={assessment.length}
          tone="navy"
          to={caseloadHref("assigned")}
          icon={<PeopleAltOutlined fontSize="small" />}
        />
        <StatCard
          label="In clinic now"
          value={inProgress.length}
          tone="orange"
          to={caseloadHref("in-clinic")}
          icon={<PeopleAltOutlined fontSize="small" />}
        />
        <StatCard
          label="Returned notes"
          value={returned.length}
          tone="orangeSoft"
          to={caseloadHref("returned")}
          icon={<ReplayOutlined fontSize="small" />}
        />
        <StatCard
          label="Needs review"
          value={pending.length}
          tone="navySoft"
          to={caseloadHref("awaiting")}
          icon={<AssignmentOutlined fontSize="small" />}
        />
        <StatCard
          label="Dose flags"
          value={doseFlags.length}
          tone="orange"
          to={caseloadHref("flags")}
          icon={<AssignmentOutlined fontSize="small" />}
        />
        <StatCard
          label="Practice cases"
          value={practice.length}
          tone="navy"
          to={caseloadHref("practice")}
          icon={<ScienceOutlined fontSize="small" />}
        />
      </StatGrid>

      <Box sx={{ display: "grid", gap: 2.5, gridTemplateColumns: { xs: "1fr", lg: "1.45fr 1fr" } }}>
        <Panel title="Assigned patients" accent flush={continueRows.length > 0}>
          {continueRows.length === 0 ? (
            <EmptyState title="No assigned patients yet">Assessment cases from your instructor show up here.</EmptyState>
          ) : (
            <Box component="ul" aria-label="Patients to continue" sx={listSx}>
              {continueRows.map((row) => (
                <TrackerRow
                  key={row.patient.id}
                  row={row}
                  isStudent
                  userId={user.id}
                  onOpen={() => open(row)}
                  noteCaption={row.latestNote ? since(row.latestNote.updatedAt, now) : undefined}
                />
              ))}
            </Box>
          )}
        </Panel>

        <Panel title="Recent notes" action={{ label: "All patients", to: "/patients" }} flush={recentNotes.length > 0}>
          {recentNotes.length === 0 ? (
            <EmptyState title="No notes yet">Open a chart and start one.</EmptyState>
          ) : (
            <Box component="ul" aria-label="Recent notes" sx={listSx}>
              {recentNotes.map((row) => (
                <TrackerRow
                  key={row.patient.id}
                  row={row}
                  isStudent
                  userId={user.id}
                  onOpen={() => open(row)}
                />
              ))}
            </Box>
          )}
        </Panel>
      </Box>

      {flagged.length > 0 && (
        <Panel title="Charts with flagged labs" flush>
          <Box component="ul" aria-label="Flagged labs" sx={listSx}>
            {flagged.slice(0, 6).map((row) => {
              const lab = row.patient.labs.find((item) => item.flag);
              return (
                <TrackerRow
                  key={row.patient.id}
                  row={row}
                  isStudent
                  userId={user.id}
                  onOpen={() => open(row)}
                  primary={lab ? `${lab.name} ${lab.value} ${lab.unit}` : row.patient.status.encounter}
                  secondary={lab?.flag ? `Flagged ${lab.flag}` : undefined}
                />
              );
            })}
          </Box>
        </Panel>
      )}
    </Box>
  );
}
