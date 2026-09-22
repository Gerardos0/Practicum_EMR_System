import { Box, Paper, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import type { Patient } from "../../types";
import EmptyState from "../../components/EmptyState";
import { formatDate } from "../../utils/format";

/** Every clinical role sees the same results (client answer). */
export default function LabsTab({ patient }: { patient: Patient }) {
  if (patient.labs.length === 0) return <EmptyState title="No lab results on file" />;
  return (
    <Paper>
      <Typography component="h2" variant="h6" sx={{ p: 2, pb: 1 }}>Lab results</Typography>
      <Box sx={{ overflowX: "auto" }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Test</TableCell>
              <TableCell align="right">Result</TableCell>
              <TableCell>Units</TableCell>
              <TableCell>Reference range</TableCell>
              <TableCell>Collected</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {patient.labs.map((l) => (
              <TableRow key={l.id} sx={l.flag ? { bgcolor: "#FEF3F2" } : undefined}>
                <TableCell>{l.name}</TableCell>
                <TableCell align="right" sx={{ fontWeight: l.flag ? 700 : 400, color: l.flag ? "error.main" : undefined }}>
                  {l.value}{l.flag && <Box component="span" sx={{ ml: 1 }} aria-label={l.flag === "H" ? "high" : "low"}>{l.flag}</Box>}
                </TableCell>
                <TableCell>{l.unit}</TableCell>
                <TableCell>{l.referenceRange}</TableCell>
                <TableCell>{formatDate(l.collectedAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
    </Paper>
  );
}
