import {
  Box,
  Paper,
  Typography,
  TextField,
  Checkbox,
  FormControlLabel,
  Button,
  Divider,
} from "@mui/material";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const navigate = useNavigate();

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "grey.50",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 3,
      }}
    >
      <Paper elevation={3} sx={{ width: 448, p: 4 }}>
        <Typography variant="h5" sx={{ mb: 0.5 }}>
          UTEP Educational EMR
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3.5 }}>
          Sign in with your MINERS account
        </Typography>

        <TextField
          label="Email"
          type="email"
          placeholder="you@miners.utep.edu"
          fullWidth
          sx={{ mb: 3 }}
        />
        <TextField
          label="Password"
          type="password"
          fullWidth
          sx={{ mb: 1.5 }}
        />
        <FormControlLabel
          control={<Checkbox />}
          label="Keep me signed in on this device"
          sx={{ mb: 2 }}
        />

        <Button
          variant="contained"
          fullWidth
          size="large"
          onClick={() => navigate("/patients")}
        >
          Sign in
        </Button>

        <Divider sx={{ my: 3 }} />
        <Typography variant="caption" color="text.secondary">
          Training environment. All patient records in this system are
          simulated. Do not enter real protected health information.
        </Typography>
      </Paper>

      <Typography variant="caption" color="text.secondary">
        CS 5389 Software Engineering Practicum &middot; Sprint 1 build
      </Typography>
    </Box>
  );
}