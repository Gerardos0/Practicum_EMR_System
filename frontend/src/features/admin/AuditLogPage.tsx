import { useState } from "react";
import {
  Box, FormControlLabel, LinearProgress, MenuItem, Paper, Switch, TextField, Typography,
} from "@mui/material";
import { listAudit } from "../../api/audit";
import { listCoursesForUser } from "../../api/courses";
import { formatDateTime } from "../../utils/format";
import { useAsync } from "../../utils/useAsync";
import { useSession } from "../auth/useSession";
import { usePageHeading } from "../../components/usePageHeading";
import PageError from "../../components/PageError";
import { actionLabel } from "./auditLabels";
import CensusRow, { nameInitials } from "../../components/CensusRow";

export default function AuditLogPage() {
  const { user, courseId: sessionCourseId, activeRole } = useSession();
  const mineOnly = activeRole === "student";
  usePageHeading(mineOnly ? "My activity" : "Activity log");
  const adminView = activeRole === "admin" && !sessionCourseId;
  const courses = useAsync(() => (adminView ? listCoursesForUser() : Promise.resolve([])), [adminView, user.id]);
  const [pickedCourseId, setPickedCourseId] = useState("");
  const courseId = adminView ? (pickedCourseId || undefined) : sessionCourseId;
  const audit = useAsync(
    () => (adminView || courseId ? listAudit(courseId, activeRole) : Promise.resolve([])),
    [courseId, activeRole, adminView],
  );
  const data = audit.data ?? [];
  const loading = audit.loading;
  const [q, setQ] = useState("");
  const [deniedOnly, setDeniedOnly] = useState(false);

  const rows = data.filter((a) =>
    (!deniedOnly || a.result === "denied") &&
    (!q.trim() || [a.actorName, actionLabel(a.action, a.detail), a.entity].some((v) => v.toLowerCase().includes(q.trim().toLowerCase()))),
  );

  if (audit.error) return <PageError error={audit.error} />;

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "flex-end", gap: 2, flexWrap: "wrap", mb: 2 }}>
        <Box sx={{ flex: 1, minWidth: 220 }}>
          <Typography variant="body2" color="text.secondary">
            {mineOnly
              ? "Your chart views and note actions in this course. Entries can't be edited or deleted."
              : adminView
                ? "Recorded actions. Entries can't be edited or deleted."
                : "Chart views, note actions, and denied attempts. Entries can't be edited or deleted."}
          </Typography>
        </Box>
        {adminView && (
          <TextField
            select size="small" label="Class" value={pickedCourseId} sx={{ minWidth: 220 }}
            onChange={(event) => setPickedCourseId(event.target.value)}
          >
            <MenuItem value="">All classes</MenuItem>
            {(courses.data ?? []).map((course) => (
              <MenuItem key={course.id} value={course.id}>{course.code}, {course.term}</MenuItem>
            ))}
          </TextField>
        )}
        <TextField size="small" placeholder="Filter by person, action, or record" value={q} onChange={(e) => setQ(e.target.value)} slotProps={{ htmlInput: { "aria-label": "Filter activity" } }} sx={{ width: { xs: "100%", sm: 300 } }} />
        <FormControlLabel control={<Switch checked={deniedOnly} onChange={(e) => setDeniedOnly(e.target.checked)} />} label="Denied only" />
      </Box>
      <Paper sx={{ overflow: "hidden", borderRadius: "16px" }}>
        {loading && <LinearProgress />}
        {rows.length === 0 && !loading ? (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2.5 }}>No activity matches that filter.</Typography>
        ) : (
          <Box component="ul" aria-label="Activity" sx={{ listStyle: "none", m: 0, p: 0, containerType: "inline-size" }}>
            {rows.map((event) => (
              <CensusRow
                key={event.id}
                initials={nameInitials(event.actorName)}
                title={event.actorName}
                meta={actionLabel(event.action, event.detail)}
                primary={event.entity}
                secondary={[formatDateTime(event.timestamp), event.result === "denied" ? "Denied" : "Allowed", event.detail].filter(Boolean).join(" · ")}
                ariaLabel={`${event.actorName} ${event.action}`}
                highlight={event.result === "denied"}
                wrap
              />
            ))}
          </Box>
        )}
      </Paper>
    </Box>
  );
}
