import { useState } from "react";
import { Alert, Box, Button, Card, CardActionArea, CardContent, Dialog, DialogActions, DialogContent, DialogTitle, LinearProgress, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import { listCoursesForUser } from "../../api/courses";
import { listPrechartIntakes, type PrechartIntake } from "../../api/users";
import { useSession } from "../auth/useSession";
import { useAsync } from "../../utils/useAsync";
import { usePageHeading } from "../../components/usePageHeading";
import { formatDateTime } from "../../utils/format";
import PageError from "../../components/PageError";
import RosterImportPage from "./RosterImportPage";

export default function AdminPeoplePage() {
  usePageHeading("People");
  const { user } = useSession();
  const courses = useAsync(() => listCoursesForUser(), [user.id]);
  const prechartIntakes = useAsync(() => listPrechartIntakes(), [user.id]);
  const [courseId, setCourseId] = useState<string>();
  const [selectedIntake, setSelectedIntake] = useState<PrechartIntake | null>(null);

  if (courses.error) return <PageError error={courses.error} />;
  if (!courses.data) return <LinearProgress aria-label="Loading classes" />;

  const selected = courses.data.find((course) => course.id === courseId);

  return (
    <Stack spacing={2.5}>
      <Box>
        <Typography variant="body2" color="text.secondary">
          Pick a class, then enroll someone who already has an account or create one for that class.
        </Typography>
      </Box>
      <Paper sx={{ p: { xs: 2, md: 2.5 } }}>
        <Typography component="h2" variant="h6" sx={{ mb: 1 }}>Patient information awaiting a chart</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Patients can submit their information before a chart is created. Review submissions here.
        </Typography>
        {prechartIntakes.error ? (
          <Alert severity="error">{prechartIntakes.error.message}</Alert>
        ) : !prechartIntakes.data ? (
          <LinearProgress aria-label="Loading patient submissions" />
        ) : prechartIntakes.data.length === 0 ? (
          <Typography variant="body2" color="text.secondary">No patient submissions are waiting for a chart.</Typography>
        ) : (
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead><TableRow><TableCell>Patient</TableCell><TableCell>Email</TableCell><TableCell>Updated</TableCell><TableCell /></TableRow></TableHead>
              <TableBody>
                {prechartIntakes.data.map((item) => (
                  <TableRow key={item.userId}>
                    <TableCell>{item.firstName} {item.lastName}</TableCell>
                    <TableCell>{item.email}</TableCell>
                    <TableCell>{formatDateTime(item.updatedAt)}</TableCell>
                    <TableCell><Button size="small" onClick={() => setSelectedIntake(item)}>View information</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}
      </Paper>
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
        {courses.data.map((course) => (
          <Card key={course.id} sx={{ minWidth: 180, borderRadius: "16px", borderWidth: course.id === courseId ? 2 : 1, borderColor: course.id === courseId ? "primary.main" : "divider" }}>
            <CardActionArea onClick={() => setCourseId(course.id)}>
              <CardContent>
                <Typography variant="subtitle2">{course.code}</Typography>
                <Typography variant="caption" color="text.secondary">{course.term}</Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        ))}
        {courses.data.length === 0 && (
          <Typography variant="body2" color="text.secondary">Create a class before adding people.</Typography>
        )}
      </Box>
      {selected && <RosterImportPage courseId={selected.id} />}
      <Dialog open={selectedIntake !== null} onClose={() => setSelectedIntake(null)} fullWidth maxWidth="md">
        <DialogTitle>{selectedIntake ? `${selectedIntake.firstName} ${selectedIntake.lastName} — ${selectedIntake.email}` : "Patient information"}</DialogTitle>
        <DialogContent dividers>
          {selectedIntake && (
            <Box component="pre" sx={{ m: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: "60vh", overflow: "auto", fontSize: 13 }}>
              {JSON.stringify(selectedIntake.data, null, 2)}
            </Box>
          )}
        </DialogContent>
        <DialogActions><Button onClick={() => setSelectedIntake(null)}>Close</Button></DialogActions>
      </Dialog>
    </Stack>
  );
}
