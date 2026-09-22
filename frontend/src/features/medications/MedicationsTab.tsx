import { Box, Paper, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import type { Patient } from "../../types";
import EmptyState from "../../components/EmptyState";

/** Columns follow the client's medication-review stage: how it's taken, how often, adherence. */
export default function MedicationsTab({ patient }: { patient: Patient }) {
  if (patient.medications.length === 0) return <EmptyState title="No active medications" />;
  return (
    <Paper>
      <Box sx={{ p: 2, pb: 1 }}>
        <Typography component="h2" variant="h6">Active medications</Typography>
        <Typography variant="body2" color="text.secondary">
          Reconcile changes in your note. Medication orders and interaction checking are planned for a later sprint.
        </Typography>
      </Box>
      <Box sx={{ overflowX: "auto" }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Medication</TableCell>
              <TableCell>Dose</TableCell>
              <TableCell>Route</TableCell>
              <TableCell>Frequency</TableCell>
              <TableCell>Indication</TableCell>
              <TableCell>Adherence</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {patient.medications.map((m) => (
              <TableRow key={m.id}>
                <TableCell sx={{ fontWeight: 600 }}>{m.name}</TableCell>
                <TableCell>{m.dose}</TableCell>
                <TableCell>{m.route}</TableCell>
                <TableCell>{m.frequency}</TableCell>
                <TableCell>{m.indication ?? "—"}</TableCell>
                <TableCell>{m.adherence ?? "Not documented"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
    </Paper>
  );
}
