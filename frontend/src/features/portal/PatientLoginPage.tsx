import { useState, type FormEvent } from "react";
import { Alert, Box, Button, IconButton, InputAdornment, Link, Paper, Stack, TextField, Typography } from "@mui/material";
import VisibilityOutlined from "@mui/icons-material/VisibilityOutlined";
import VisibilityOffOutlined from "@mui/icons-material/VisibilityOffOutlined";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { patientLogin } from "../../api/portalAccounts";
import { brandAccentBar, utep } from "../../theme/tokens";
import { useAuth } from "../auth/useSession";

export default function PatientLoginPage() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!username.trim() || !password) {
      setError("Enter your username and password.");
      return;
    }
    setBusy(true);
    setError("");
    patientLogin(username, password)
      .then((result) => {
        signIn(result.user, result.accessToken, result.mustChangePassword, result.refreshToken);
        navigate(result.mustChangePassword ? "/change-password" : "/portal", { replace: true });
      })
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setBusy(false));
  };

  return (
    <Box sx={{ minHeight: "100dvh", bgcolor: "background.default", display: "flex", flexDirection: "column" }}>
      <Box component="header" sx={{ bgcolor: utep.orange, color: utep.navy, px: { xs: 2, sm: 3.5 }, height: 60, display: "flex", alignItems: "center" }}>
        <Typography component="span" sx={{ fontWeight: 800, fontSize: 18 }}>UTEP EMR</Typography>
        <Typography component="span" sx={{ ml: 1.5, fontWeight: 600, fontSize: 13, opacity: 0.85, display: { xs: "none", sm: "inline" } }}>
          Educational medical record
        </Typography>
      </Box>
      <Box aria-hidden sx={{ height: 6, background: brandAccentBar }} />
      <Box component="main" sx={{ flex: 1, display: "grid", placeItems: "center", px: 2, py: 5 }}>
        <Paper component="section" aria-labelledby="patient-login-title" sx={{ width: "100%", maxWidth: 420, p: { xs: 3, sm: 4 } }}>
          <Typography id="patient-login-title" component="h1" variant="h5" sx={{ mb: 0.5 }}>Patient portal sign in</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Sign in to view your simulated patient portal. This app contains training data, never real patient data.
          </Typography>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Box component="form" noValidate onSubmit={submit}>
            <Stack spacing={2}>
              <TextField
                label="Username" autoComplete="username" autoFocus fullWidth
                value={username} onChange={(event) => setUsername(event.target.value)}
              />
              <TextField
                label="Password" type={showPassword ? "text" : "password"} autoComplete="current-password" fullWidth
                value={password} onChange={(event) => setPassword(event.target.value)}
                slotProps={{ input: { endAdornment: (
                  <InputAdornment position="end">
                    <IconButton aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((shown) => !shown)} edge="end">
                      {showPassword ? <VisibilityOffOutlined /> : <VisibilityOutlined />}
                    </IconButton>
                  </InputAdornment>
                ) } }}
              />
              <Button type="submit" variant="contained" size="large" disabled={busy}>
                {busy ? "Signing in…" : "Sign in"}
              </Button>
            </Stack>
          </Box>
          <Stack spacing={1} sx={{ mt: 2.5 }}>
            <Typography variant="body2"><Link component={RouterLink} to="/portal/signup">New patient? Create your account</Link></Typography>
            <Typography variant="body2" color="text.secondary">Forgot your password? Contact your administrator.</Typography>
            <Typography variant="body2"><Link component={RouterLink} to="/">Students and staff sign in here</Link></Typography>
          </Stack>
        </Paper>
      </Box>
    </Box>
  );
}
