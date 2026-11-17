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
import CensusRow from "../../components/CensusRow";
import { nameInitials } from "../../components/census";
import EmptyState from "../../components/EmptyState";
import TrackerRow from "../patients/TrackerRow";
import { Panel, StatCard, StatGrid } from "./components/DashboardParts";
import { DAY_MS, patientName, since } from "./dashboardFormat";
import { actionLabel } from "../admin/auditLabels";
const listSx = { listStyle: "none", m: 0, p: 0, containerType: "inline-size" } as const;

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
    <Box
      sx={{
        display: "grid",
        gap: 1.5,
        flex: { lg: "1 1 auto" },
        minHeight: { lg: 0 },
        overflow: { lg: "hidden" },
        gridTemplateRows: { lg: "auto minmax(0, 1.15fr) minmax(0, 0.85fr)" },
      }}
    >
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

      <Box sx={{ display: "grid", gap: 1.5, minHeight: 0, gridTemplateColumns: { xs: "1fr", lg: "1.35fr 1fr" } }}>
        <Panel fill title="Review queue" action={{ label: "Open queue", to: "/review?status=pending_review" }} accent flush={pending.length > 0}>
          {queue.loading && !queue.data ? <LinearProgress /> : pending.length === 0 ? (
            <EmptyState title="Nothing waiting">Submitted notes show up here.</EmptyState>
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

        <Panel fill title="Recent activity" action={{ label: "Full log", to: "/audit" }} flush={recent.length > 0}>
          {audit.loading && !audit.data ? <LinearProgress /> : recent.length === 0 ? (
            <EmptyState title="No events yet">Chart opens and note changes show up here.</EmptyState>
          ) : (
            <Box component="ul" aria-label="Recent activity" sx={listSx}>
              {recent.map((event) => (
                <CensusRow
                  key={event.id}
                  initials={nameInitials(event.actorName)}
                  title={event.actorName}
                  meta={actionLabel(event.action, event.detail)}
                  primary={event.entity}
                  secondary={`${formatRelativeShort(event.timestamp)}${event.result === "denied" ? " · denied" : ""}`}
                  ariaLabel={`${event.actorName} ${actionLabel(event.action)}`}
                />
              ))}
            </Box>
          )}
        </Panel>
      </Box>

      <Box sx={{ display: "grid", gap: 1.5, minHeight: 0, gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" } }}>
      <Panel
        fill
        title="Students to check in with"
        subtitle={
          risk.data
            ? `No chart activity for ${risk.data.days} days, or an assigned chart with no note.`
            : "No chart activity for 7 days, or an assigned chart with no note."
        }
        action={{ label: "Activity report", to: "/teaching" }}
        flush={riskStudents.length > 0}
      >
        {risk.loading && !risk.data ? <LinearProgress /> : riskStudents.length === 0 ? (
          <EmptyState title="No one right now">Quiet charts and missing notes show up here.</EmptyState>
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

      <Panel fill title="Patients with flagged labs" subtitle="High or low results on the current chart" action={{ label: "All patients", to: "/patients" }} flush={flaggedRows.length > 0}>
        {flaggedRows.length === 0 ? (
          <EmptyState title="No flagged labs">High and low results show up here.</EmptyState>
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
    </Box>
  );
}
