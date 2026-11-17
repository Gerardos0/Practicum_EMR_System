import { useRef, useState } from "react";
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, LinearProgress, MenuItem, Paper, TextField, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { copyCase, downloadCaseTemplate, importCases, listCases } from "../../api/cases";
import { listCoursesForUser } from "../../api/courses";
import { useSession } from "../auth/useSession";
import { useAsync } from "../../utils/useAsync";
import { formatDateTime } from "../../utils/format";
import { courseIdsForRole } from "../../utils/permissions";
import { usePageHeading } from "../../components/usePageHeading";
import EmptyState from "../../components/EmptyState";
import PageError from "../../components/PageError";
import CensusRow from "../../components/CensusRow";
import AssignCaseDialog from "../patients/components/AssignCaseDialog";
import type { AuthoredCase } from "../../types";

export default function CaseListPage() {
  usePageHeading("Cases");
  const navigate = useNavigate();
  const { activeRole, courseId } = useSession();
  const cases = useAsync(() => listCases(activeRole, courseId), [activeRole, courseId]);
  const [assignCase, setAssignCase] = useState<AuthoredCase>();
  const [copyTarget, setCopyTarget] = useState<AuthoredCase>();
  const [notice, setNotice] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  if (cases.error) return <PageError error={cases.error} />;

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2, mb: 2, flexWrap: "wrap" }}>
        <Box sx={{ flex: 1, minWidth: 220 }}>
          <Typography component="h1" variant="h5" sx={{ fontWeight: 700 }}>Case masters</Typography>
          <Typography variant="body2" color="text.secondary">
            Build a case once, then assign private copies. Charts already assigned keep their locks and prefill. Later edits stay on the master.
          </Typography>
        </Box>
        <Button variant="outlined" onClick={() => downloadCaseTemplate(activeRole, courseId)}>Download template</Button>
        <input ref={fileInput} hidden type="file" accept=".xlsx" onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          try {
            const result = await importCases(activeRole, courseId, file);
            setNotice(`${result.created} case${result.created === 1 ? "" : "s"} imported.`);
            cases.reload();
          } catch (e) {
            setNotice((e as Error).message);
          }
        }} />
        <Button variant="outlined" onClick={() => fileInput.current?.click()}>Upload cases</Button>
        <Button variant="contained" onClick={() => navigate("/cases/new")}>Create case</Button>
      </Box>

      {notice && <Alert severity="info" sx={{ mb: 2 }} onClose={() => setNotice("")}>{notice}</Alert>}
      {cases.loading && <LinearProgress aria-label="Loading cases" />}

      {!cases.loading && (cases.data ?? []).length === 0 ? (
        <EmptyState title="No cases yet" action={<Button variant="contained" onClick={() => navigate("/cases/new")}>Create case</Button>}>
          Start from a blank chart. Students will not see the master.
        </EmptyState>
      ) : (
        <Paper sx={{ overflow: "hidden", borderRadius: "16px" }}>
          <Box component="ul" aria-label="Case masters" sx={{ listStyle: "none", m: 0, p: 0, containerType: "inline-size" }}>
            {cases.data?.map((item) => (
              <CensusRow
                key={item.id}
                initials={`${item.firstName[0] ?? ""}${item.lastName[0] ?? ""}`.toUpperCase()}
                title={`${item.lastName}, ${item.firstName}`}
                meta={item.mrn}
                primary={item.chiefComplaint || "No chief complaint yet"}
                secondary={[item.status.program, formatDateTime(item.updatedAt)].filter(Boolean).join(" · ")}
                onOpen={() => navigate(`/cases/${item.id}`)}
                ariaLabel={`Open case for ${item.lastName}, ${item.firstName}`}
                actions={(
                  <>
                    <Button size="small" onClick={() => setCopyTarget(item)} sx={{ display: { xs: "none", sm: "inline-flex" } }}>Copy</Button>
                    <Button size="small" variant="contained" color="secondary" onClick={() => setAssignCase(item)}>Assign</Button>
                  </>
                )}
              />
            ))}
          </Box>
        </Paper>
      )}

      {copyTarget && (
        <CopyCaseDialog
          item={copyTarget}
          onClose={() => setCopyTarget(undefined)}
          onCopied={(name) => {
            setCopyTarget(undefined);
            setNotice(`${copyTarget.lastName}, ${copyTarget.firstName} copied to ${name}.`);
          }}
        />
      )}

      {assignCase && (
        <AssignCaseDialog
          open
          rows={[]}
          initialSourceId={assignCase.id}
          onClose={() => setAssignCase(undefined)}
          onAssigned={() => setAssignCase(undefined)}
        />
      )}
    </Box>
  );
}

function CopyCaseDialog({ item, onClose, onCopied }: { item: AuthoredCase; onClose: () => void; onCopied: (courseName: string) => void }) {
  const { user, activeRole, courseId } = useSession();
  const courses = useAsync(() => listCoursesForUser(), [user.id]);
  const teaching = new Set([
    ...courseIdsForRole(user, "instructor"),
    ...courseIdsForRole(user, "course_coordinator"),
  ]);
  const destinations = (courses.data ?? []).filter((course) => course.id !== courseId && teaching.has(course.id));
  const [destinationId, setDestinationId] = useState(destinations[0]?.id ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const selected = destinations.find((course) => course.id === destinationId) ?? destinations[0];

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Copy {item.lastName}, {item.firstName}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Creates a new case in the other course, including the answer key, rubric, and planted triggers. Assigned charts and notes stay here.
        </Typography>
        {destinations.length === 0 ? (
          <Alert severity="info">You teach only this course, so there is nowhere to copy it.</Alert>
        ) : (
          <TextField
            select
            fullWidth
            label="Destination course"
            value={selected?.id ?? ""}
            onChange={(e) => setDestinationId(e.target.value)}
          >
            {destinations.map((course) => (
              <MenuItem key={course.id} value={course.id}>{course.code} · {course.title}</MenuItem>
            ))}
          </TextField>
        )}
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={busy || !selected}
          onClick={async () => {
            if (!selected) return;
            setBusy(true);
            setError("");
            try {
              await copyCase(activeRole, item.id, selected.id);
              onCopied(`${selected.code}`);
            } catch (e) {
              setError((e as Error).message);
              setBusy(false);
            }
          }}
        >Copy</Button>
      </DialogActions>
    </Dialog>
  );
}
