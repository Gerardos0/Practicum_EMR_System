import { useState } from "react";
import {
  Box, FormControlLabel, LinearProgress, MenuItem, Paper, Switch, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography,
} from "@mui/material";
import { listAudit } from "../../api/audit";
import { listCoursesForUser } from "../../api/courses";
import { formatDateTime } from "../../utils/format";
import { useAsync } from "../../utils/useAsync";
import { useSession } from "../auth/useSession";
import { usePageHeading } from "../../components/usePageHeading";
import PageError from "../../components/PageError";

export default function AuditLogPage() {
  usePageHeading("Activity log");
  const { user, courseId: sessionCourseId, activeRole } = useSession();
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
    (!q.trim() || [a.actorName, a.action, a.entity].some((v) => v.toLowerCase().includes(q.trim().toLowerCase()))),
  );

  if (audit.error) return <PageError error={audit.error} />;

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "flex-end", gap: 2, flexWrap: "wrap", mb: 2 }}>
        <Box sx={{ flex: 1, minWidth: 220 }}>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>Activity log</Typography>
          <Typography variant="body2" color="text.secondary">
            {adminView
              ? "Recorded actions from classes and accounts. Entries can't be edited or deleted."
              : "Every chart view, note action, and denied attempt. Entries can't be edited or deleted."}
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
      <Paper>
        {loading && <LinearProgress />}
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow><TableCell>When</TableCell><TableCell>Who</TableCell><TableCell>Action</TableCell><TableCell>Record</TableCell><TableCell>Result</TableCell></TableRow>
            </TableHead>
            <TableBody>
              {rows.map((a) => (
                <TableRow key={a.id} sx={a.result === "denied" ? { bgcolor: "#FEF3F2" } : undefined}>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>{formatDateTime(a.timestamp)}</TableCell>
                  <TableCell>{a.actorName}</TableCell>
                  <TableCell>{a.action}</TableCell>
                  <TableCell>{a.entity}</TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: a.result === "denied" ? "error.main" : "success.main" }}>
                      {a.result === "denied" ? "Denied" : "Allowed"}
                    </Typography>
                    {a.detail && <Typography variant="caption" color="text.secondary">{a.detail}</Typography>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </Paper>
    </Box>
  );
}
