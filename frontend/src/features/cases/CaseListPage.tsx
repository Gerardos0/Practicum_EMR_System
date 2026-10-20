import { useState } from "react";
import { Box, Button, LinearProgress, Paper, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { listCases } from "../../api/cases";
import { useSession } from "../auth/AuthContext";
import { useAsync } from "../../utils/useAsync";
import { formatDateTime } from "../../utils/format";
import { usePageHeading } from "../../components/PageHeading";
import EmptyState from "../../components/EmptyState";
import PageError from "../../components/PageError";
import AssignCaseDialog from "../patients/components/AssignCaseDialog";
import type { AuthoredCase } from "../../types";

export default function CaseListPage() {
  usePageHeading("Cases");
  const navigate = useNavigate();
  const { activeRole, courseId } = useSession();
  const cases = useAsync(() => listCases(activeRole, courseId), [activeRole, courseId]);
  const [assignCase, setAssignCase] = useState<AuthoredCase>();

  if (cases.error) return <PageError error={cases.error} />;

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2, mb: 2, flexWrap: "wrap" }}>
        <Box sx={{ flex: 1, minWidth: 220 }}>
          <Typography component="h1" variant="h5" sx={{ fontWeight: 700 }}>Case masters</Typography>
          <Typography variant="body2" color="text.secondary">
            Build a case once, then assign private copies. Editing a master later does not change copies already given out.
          </Typography>
        </Box>
        <Button variant="contained" onClick={() => navigate("/cases/new")}>Create case</Button>
      </Box>

      {cases.loading && <LinearProgress aria-label="Loading cases" />}

      {!cases.loading && (cases.data ?? []).length === 0 ? (
        <EmptyState title="No cases yet" action={<Button variant="contained" onClick={() => navigate("/cases/new")}>Create case</Button>}>
          Start from a blank chart. Students will not see the master.
        </EmptyState>
      ) : (
        <Paper sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Patient</TableCell>
                <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>MRN</TableCell>
                <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>Discipline</TableCell>
                <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>Updated</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {cases.data?.map((item) => (
                <TableRow key={item.id} hover sx={{ cursor: "pointer" }} onClick={() => navigate(`/cases/${item.id}`)}>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{item.lastName}, {item.firstName}</Typography>
                    <Typography variant="caption" color="text.secondary">{item.chiefComplaint || "No chief complaint yet"}</Typography>
                  </TableCell>
                  <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>{item.mrn}</TableCell>
                  <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>{item.status.program || "—"}</TableCell>
                  <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>{formatDateTime(item.updatedAt)}</TableCell>
                  <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                    <Button size="small" onClick={() => setAssignCase(item)}>Assign</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
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
