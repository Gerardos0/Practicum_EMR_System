import {
  Box,
  Typography,
  Paper,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  Button,
  AppBar,
  Toolbar,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import { patients, submittedNotes, auditLog } from "../data/mockData";

const statusColor: Record<string, "warning" | "success" | "default"> = {
  pending_review: "warning",
  cosigned: "success",
  draft: "default",
};

const statusLabel: Record<string, string> = {
  pending_review: "Pending review",
  cosigned: "Co-signed",
  draft: "Draft",
};

export default function InstructorQueue() {
  const navigate = useNavigate();

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "grey.50" }}>
      <AppBar position="static" elevation={4}>
        <Toolbar>
          <Typography variant="h6">UTEP Educational EMR</Typography>
          <Box sx={{ flexGrow: 1 }} />
          <Typography variant="body2" sx={{ mr: 2 }}>Daniel Mejía</Typography>
          <Chip
            label="Instructor"
            size="small"
            variant="outlined"
            sx={{ color: "inherit", borderColor: "rgba(255,255,255,0.7)", mr: 2 }}
          />
          <Button color="inherit" onClick={() => navigate("/")}>Sign out</Button>
        </Toolbar>
      </AppBar>

      <Box sx={{ px: 4, py: 3, display: "flex", flexDirection: "column", gap: 4 }}>
        <Box>
          <Typography variant="h5" sx={{ mb: 2 }}>Review queue</Typography>
          <Paper elevation={1}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Author</TableCell>
                  <TableCell>Patient</TableCell>
                  <TableCell>Note type</TableCell>
                  <TableCell>Submitted</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {submittedNotes.map((n) => {
                  const patient = patients.find((p) => p.id === n.patientId);
                  return (
                    <TableRow key={n.id}>
                      <TableCell>{n.authorName}</TableCell>
                      <TableCell>
                        {patient ? `${patient.lastName}, ${patient.firstName} · ${patient.mrn}` : "—"}
                      </TableCell>
                      <TableCell>SOAP — {n.authorDiscipline}</TableCell>
                      <TableCell>{n.submittedAt ?? "—"}</TableCell>
                      <TableCell>
                        <Chip
                          label={statusLabel[n.status]}
                          color={statusColor[n.status]}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          onClick={() => navigate(`/patients/${n.patientId}`)}
                        >
                          Open
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {submittedNotes.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: "center" }}>
                        No notes submitted yet this session.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Paper>
        </Box>

        <Box>
          <Typography variant="h6" sx={{ mb: 2 }}>Audit trail</Typography>
          <Paper elevation={1}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Timestamp</TableCell>
                  <TableCell>Actor</TableCell>
                  <TableCell>Action</TableCell>
                  <TableCell>Entity</TableCell>
                  <TableCell>Result</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {auditLog.map((a) => (
                  <TableRow key={a.id} sx={a.denied ? { bgcolor: "#fdf3f3" } : undefined}>
                    <TableCell sx={{ fontFamily: "monospace" }}>{a.timestamp}</TableCell>
                    <TableCell>{a.actor}</TableCell>
                    <TableCell>{a.action}</TableCell>
                    <TableCell sx={{ fontFamily: "monospace" }}>{a.entity}</TableCell>
                    <TableCell sx={{ color: a.denied ? "error.main" : "success.main", fontWeight: a.denied ? 600 : 400 }}>
                      {a.result}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.5 }}>
            The 403 row is the server-side authorization check we plan to enforce in Sprint 2:
            a student can author a note but cannot co-sign it.
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
