import {
  Box, Button, LinearProgress, Paper, Tab, Table, TableBody, TableCell, TableHead, TableRow, Tabs, Typography,
} from "@mui/material";
import { useNavigate, useSearchParams } from "react-router-dom";
import { listReviewQueue } from "../../api/notes";
import { getCourse } from "../../api/courses";
import { useSession } from "../auth/AuthContext";
import { formatDateTime } from "../../utils/format";
import { useAsync } from "../../utils/useAsync";
import NoteStatusChip from "../../components/NoteStatusChip";
import EmptyState from "../../components/EmptyState";
import PageError from "../../components/PageError";
import { usePageHeading } from "../../components/PageHeading";
import { templateName } from "./noteTemplates";
import type { NoteStatus } from "../../types";

const FILTERS: { id: NoteStatus | "all"; label: string }[] = [
  { id: "pending_review", label: "Needs review" },
  { id: "returned", label: "Returned" },
  { id: "cosigned", label: "Co-signed" },
  { id: "all", label: "All" },
];

const QUEUE_STATUSES = new Set<NoteStatus>(["pending_review", "returned", "cosigned"]);

function tabFromSearch(value: string | null): NoteStatus | "all" {
  if (value === "all" || value === "returned" || value === "cosigned" || value === "pending_review") return value;
  return "pending_review";
}

export default function ReviewQueuePage() {
  usePageHeading("Review queue");
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { activeRole, courseId } = useSession();
  const filter = tabFromSearch(params.get("status"));
  const queue = useAsync(() => listReviewQueue(courseId, activeRole), [courseId, activeRole]);
  const course = useAsync(() => getCourse(courseId), [courseId]);

  const rows = (queue.data ?? []).filter((q) => QUEUE_STATUSES.has(q.note.status));
  const items = rows.filter((q) => filter === "all" || q.note.status === filter);
  const count = (s: NoteStatus | "all") =>
    s === "all" ? rows.length : rows.filter((q) => q.note.status === s).length;

  if (queue.error) return <PageError error={queue.error} />;

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700 }}>Review queue</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {course.data ? `${course.data.code}: ` : ""}assessment notes students submitted for co-signature
      </Typography>

      <Paper>
        <Tabs
          value={filter}
          onChange={(_, v) => setParams({ status: v }, { replace: true })}
          sx={{ px: 1, borderBottom: 1, borderColor: "divider" }}
          aria-label="Filter by status"
        >
          {FILTERS.map((f) => (
            <Tab key={f.id} value={f.id} label={f.id === "all" ? `${f.label} (${count("all")})` : `${f.label} (${count(f.id)})`} />
          ))}
        </Tabs>
        {queue.loading && <LinearProgress />}
        <Box sx={{ overflowX: "auto", p: 1 }}>
          {!queue.loading && items.length === 0 ? (
            <Box sx={{ p: 2 }}>
              <EmptyState title={filter === "pending_review" ? "You're caught up" : "Nothing here"}>
                {filter === "pending_review" ? "New submissions appear here as students sign their notes." : undefined}
              </EmptyState>
            </Box>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Student</TableCell>
                  <TableCell>Patient</TableCell>
                  <TableCell>Note</TableCell>
                  <TableCell>Submitted</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map(({ note, patient }) => (
                  <TableRow key={note.id} hover>
                    <TableCell sx={{ fontWeight: 600 }}>{note.authorName}</TableCell>
                    <TableCell>
                      {patient.lastName}, {patient.firstName}
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>MRN {patient.mrn}</Typography>
                    </TableCell>
                    <TableCell>{templateName(note.templateId)}</TableCell>
                    <TableCell>{note.signedAt ? formatDateTime(note.signedAt) : "—"}</TableCell>
                    <TableCell><NoteStatusChip status={note.status} /></TableCell>
                    <TableCell align="right">
                      <Button size="small" variant={note.status === "pending_review" ? "contained" : "outlined"} onClick={() => navigate(`/review/${note.id}`)}>
                        {note.status === "pending_review" ? "Review" : "Open"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Box>
      </Paper>
    </Box>
  );
}
