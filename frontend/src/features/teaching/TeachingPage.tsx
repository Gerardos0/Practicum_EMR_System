import { useRef, useState } from "react";
import { Alert, Box, Button, Paper, Stack, TextField, Typography } from "@mui/material";
import { downloadChartTime, downloadGrades, getCourse, uploadGradingGuide } from "../../api/courses";
import { useSession } from "../auth/AuthContext";
import { can } from "../../utils/permissions";
import { useAsync } from "../../utils/useAsync";
import { usePageHeading } from "../../components/PageHeading";
import CourseRubricPanel from "../encounters/components/CourseRubricPanel";

export default function TeachingPage() {
  usePageHeading("Grades and time");
  const { activeRole, courseId } = useSession();
  const course = useAsync(() => getCourse(courseId), [courseId]);
  const fileInput = useRef<HTMLInputElement>(null);
  const [caseKey, setCaseKey] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const canUpload = can(activeRole, "case:author") || can(activeRole, "course:manage_access");

  return (
    <Stack spacing={2}>
      <Box>
        <Typography component="h1" variant="h5" sx={{ fontWeight: 700 }}>Grades and chart time</Typography>
        <Typography variant="body2" color="text.secondary">
          Exports are Excel workbooks for this course. Case masters themselves are not exported. Blackboard is not connected.
        </Typography>
      </Box>
      {message && <Alert severity="success" onClose={() => setMessage("")}>{message}</Alert>}
      {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}
      <Paper sx={{ p: 2.5 }}>
        <Typography component="h2" variant="h6">Rubric</Typography>
        <CourseRubricPanel guide={course.data?.gradingGuide} fileName={course.data?.rubricFileName} />
        {canUpload && (
          <>
            <input ref={fileInput} hidden type="file" accept=".pdf,.docx" onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              setError("");
              try {
                course.setData(await uploadGradingGuide(courseId, file));
                setMessage(`${file.name} was converted into scoring criteria.`);
              } catch (e) {
                setError((e as Error).message);
              }
            }} />
            <Button sx={{ mt: 1.5 }} variant="outlined" onClick={() => fileInput.current?.click()}>Upload PDF or Word rubric</Button>
          </>
        )}
      </Paper>
      <Paper sx={{ p: 2.5 }}>
        <Typography component="h2" variant="h6" sx={{ mb: 1.5 }}>Grade export</Typography>
        <TextField label="Case key" value={caseKey} onChange={(e) => setCaseKey(e.target.value)} helperText="The case key from the case you assigned." sx={{ mr: 1, mb: 1 }} />
        <Button variant="contained" disabled={!caseKey.trim()} onClick={async () => {
          setError("");
          try { await downloadGrades(courseId, activeRole, caseKey.trim()); }
          catch (e) { setError((e as Error).message); }
        }}>Download grades</Button>
      </Paper>
      <Paper sx={{ p: 2.5 }}>
        <Typography component="h2" variant="h6" sx={{ mb: 1 }}>Time in chart</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Minutes come from chart sessions. A gap longer than two minutes starts a new session.
        </Typography>
        <Button variant="outlined" onClick={async () => {
          setError("");
          try { await downloadChartTime(courseId, activeRole); }
          catch (e) { setError((e as Error).message); }
        }}>Download chart time</Button>
      </Paper>
    </Stack>
  );
}
