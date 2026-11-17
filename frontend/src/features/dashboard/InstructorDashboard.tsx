import { useState } from "react";
import { Box, Button, LinearProgress } from "@mui/material";
import AssignmentOutlined from "@mui/icons-material/AssignmentOutlined";
import PeopleAltOutlined from "@mui/icons-material/PeopleAltOutlined";
import ReplayOutlined from "@mui/icons-material/ReplayOutlined";
import ScienceOutlined from "@mui/icons-material/ScienceOutlined";
import { useNavigate } from "react-router-dom";
import { listPatients } from "../../api/patients";
import { listReviewQueue } from "../../api/notes";
import { listAudit } from "../../api/audit";
import { getAtRisk } from "../../api/courses";
import { useSession } from "../auth/useSession";
import { useAsync } from "../../utils/useAsync";
import { formatRelativeShort } from "../../utils/format";
import CensusRow, { nameInitials } from "../../components/CensusRow";
import EmptyState from "../../components/EmptyState";
import TrackerRow from "../patients/TrackerRow";
import { Panel, StatCard, StatGrid } from "./components/DashboardParts";
import { DAY_MS, patientName, since } from "./dashboardFormat";

const listSx = { listStyle: "none", m: 0, p: 0, containerType: "inline-size" } as const;

function actionLabel(action: string) {
  return action.replace(/[._]/g, " ");
}

export default function InstructorDashboard() {
  const navigate = useNavigate();
  const { user, activeRole, courseId } = useSession();
  const patients = useAsync(() => listPatients(activeRole, courseId), [activeRole, courseId]);
  const queue = useAsync(() => listReviewQueue(courseId, activeRole), [courseId, activeRole]);
  const audit = useAsync(() => listAudit(courseId, activeRole), [courseId, activeRole]);
  const risk = useAsync(() => getAtRisk(courseId, activeRole), [courseId, activeRole]);
  const [now] = useState(() => Date.now());

  if (patients.loading && !patients.data) return <LinearProgress />;

  const rows = patients.data ?? [];
  const items = queue.data ?? [];

  const pending = items.filter((q) => q.note.status === "pending_review");
  const returned = items.filter((q) => q.note.status === "returned");
  const stale = pending.filter((q) => now - new Date(q.note.updatedAt).getTime() >= DAY_MS);
  const flagged = rows.filter((r) => r.patient.labs.some((l) => l.flag));
  const inClinic = rows.filter((r) => r.patient.status.encounter === "Checked in" || r.patient.status.encounter === "Roomed" || r.patient.status.encounter === "In progress");
  const recent = (audit.data ?? []).slice(0, 8);
  const flaggedRows = flagged.slice(0, 8);
  const riskStudents = risk.data?.students.slice(0, 12) ?? [];

  return (
    <Box sx={{ display: "grid", gap: 2.5 }}>
      <StatGrid title="Today">
        <StatCard
          label="Notes to review"
          value={pending.length}
          tone="navy"
          to="/review?status=pending_review"
          icon={<AssignmentOutlined fontSize="small" />}
        />
        <StatCard
          label="Waiting over a day"
          value={stale.length}
          tone="orange"
          to="/review?status=pending_review"
          icon={<AssignmentOutlined fontSize="small" />}
        />
        <StatCard
          label="Returned to students"
          value={returned.length}
          tone="orangeSoft"
          to="/review?status=returned"
          icon={<ReplayOutlined fontSize="small" />}
        />
        <StatCard
          label="Patients in clinic"
          value={inClinic.length}
          tone="navySoft"
          to="/patients"
          icon={<PeopleAltOutlined fontSize="small" />}
        />
        <StatCard
          label="Flagged labs"
          value={flagged.length}
          tone="navy"
          to="/patients"
          icon={<ScienceOutlined fontSize="small" />}
        />
      </StatGrid>

      <Box sx={{ display: "grid", gap: 2.5, gridTemplateColumns: { xs: "1fr", lg: "1.4fr 1fr" } }}>
        <Panel title="Review queue" action={{ label: "Open queue", to: "/review?status=pending_review" }} accent flush={pending.length > 0}>
          {queue.loading && !queue.data ? <LinearProgress /> : pending.length === 0 ? (
            <EmptyState title="Nothing waiting">Students' assessment notes will land here after they submit for signature.</EmptyState>
          ) : (
            <Box component="ul" aria-label="Notes awaiting review" sx={listSx}>
              {pending.slice(0, 8).map((q) => (
                <CensusRow
                  key={q.note.id}
                  initials={nameInitials(q.note.authorName)}
                  title={q.note.authorName}
                  meta={patientName(q.patient)}
                  primary="Waiting for review"
                  secondary={since(q.note.updatedAt, now)}
                  onOpen={() => navigate(`/review/${q.note.id}`)}
                  ariaLabel={`Review note by ${q.note.authorName}`}
                  actions={(
                    <Button size="small" variant="contained" color="secondary" onClick={() => navigate(`/review/${q.note.id}`)}>
                      Review
                    </Button>
                  )}
                />
              ))}
            </Box>
          )}
        </Panel>

        <Panel title="Recent activity" action={{ label: "Full log", to: "/audit" }} flush={recent.length > 0}>
          {audit.loading && !audit.data ? <LinearProgress /> : recent.length === 0 ? (
            <EmptyState title="No events yet">Chart views and note actions will show here.</EmptyState>
          ) : (
            <Box component="ul" aria-label="Recent activity" sx={listSx}>
              {recent.map((event) => (
                <CensusRow
                  key={event.id}
                  initials={nameInitials(event.actorName)}
                  title={event.actorName}
                  meta={actionLabel(event.action)}
                  primary={event.entity}
                  secondary={`${formatRelativeShort(event.timestamp)}${event.result === "denied" ? " · denied" : ""}`}
                  ariaLabel={`${event.actorName} ${actionLabel(event.action)}`}
                />
              ))}
            </Box>
          )}
        </Panel>
      </Box>

      <Panel
        title="Students to check in with"
        subtitle={
          risk.data
            ? `A student is flagged for no chart activity for ${risk.data.days} days, or an assigned chart with no submitted note.`
            : "A student is flagged for no chart activity for 7 days, or an assigned chart with no submitted note."
        }
        action={{ label: "Activity report", to: "/teaching" }}
        flush={riskStudents.length > 0}
      >
        {risk.loading && !risk.data ? <LinearProgress /> : riskStudents.length === 0 ? (
          <EmptyState title="No one is flagged">Students show up here after a week without opening a chart, or when an assigned chart has no submitted note.</EmptyState>
        ) : (
          <Box component="ul" aria-label="Students to check in with" sx={listSx}>
            {riskStudents.map((student) => (
              <CensusRow
                key={student.userId}
                initials={nameInitials(student.student)}
                title={student.student}
                primary={student.reasons.join(". ")}
                ariaLabel={student.student}
                wrap
              />
            ))}
          </Box>
        )}
      </Panel>

      <Panel title="Patients with flagged labs" subtitle="High or low results on the current chart" action={{ label: "All patients", to: "/patients" }} flush={flaggedRows.length > 0}>
        {flaggedRows.length === 0 ? (
          <EmptyState title="No flagged labs">Out-of-range results will appear here.</EmptyState>
        ) : (
          <Box component="ul" aria-label="Flagged labs" sx={listSx}>
            {flaggedRows.map((row) => {
              const lab = row.patient.labs.find((item) => item.flag);
              return (
                <TrackerRow
                  key={row.patient.id}
                  row={row}
                  isStudent={false}
                  userId={user.id}
                  onOpen={() => navigate(`/patients/${row.patient.id}`)}
                  primary={lab ? `${lab.name} ${lab.value} ${lab.unit}` : row.patient.status.encounter}
                  secondary={lab?.flag ? `${lab.flag} · ${row.patient.status.encounter}` : row.patient.status.encounter}
                />
              );
            })}
          </Box>
        )}
      </Panel>
    </Box>
  );
}
