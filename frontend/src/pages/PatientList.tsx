import {
  Box,
  Typography,
  TextField,
  FormControlLabel,
  Checkbox,
  Paper,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  Button,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import { patients } from "../data/mockData";

export default function PatientList() {
  const navigate = useNavigate();

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "grey.50" }}>
      <AppHeader />

      <Box sx={{ px: 4, py: 3 }}>
        <Box sx={{ display: "flex", alignItems: "flex-end", gap: 2, mb: 2.5 }}>
          <Typography variant="h5">Patients</Typography>
          <Box sx={{ flexGrow: 1 }} />
          <TextField label="Search by name or MRN" size="small" sx={{ width: 320 }} />
          <FormControlLabel
            control={<Checkbox defaultChecked />}
            label="Assigned to me"
          />
        </Box>

        <Paper elevation={1}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>MRN</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>DOB</TableCell>
                <TableCell>Sex</TableCell>
                <TableCell>Encounter status</TableCell>
                <TableCell>Mode</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {patients.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.mrn}</TableCell>
                  <TableCell>
                    {p.lastName}, {p.firstName}
                  </TableCell>
                  <TableCell>{p.dob}</TableCell>
                  <TableCell>{p.sex}</TableCell>
                  <TableCell>
                    <Chip
                      label={p.encounterStatus}
                      size="small"
                      color={p.encounterStatus === "Checked in" ? "info" : "default"}
                    />
                  </TableCell>
                  <TableCell>{p.mode}</TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      onClick={() => navigate(`/patients/${p.id}`)}
                    >
                      Open chart
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>

        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.5 }}>
          {patients.length} patients &middot; all records flagged Test / Training and excluded from reporting
        </Typography>
      </Box>
    </Box>
  );
}
