import { useState, type FormEvent } from "react";
import { Alert, Box, Button, IconButton, InputAdornment, Link, Paper, Stack, TextField, Typography } from "@mui/material";
import VisibilityOutlined from "@mui/icons-material/VisibilityOutlined";
import VisibilityOffOutlined from "@mui/icons-material/VisibilityOffOutlined";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { ApiError } from "../../api/client";
import { patientSignupByEmail } from "../../api/portalAccounts";
import BrandLogo from "../../components/BrandLogo";
import { brandAtmosphere, utep } from "../../theme/tokens";
import { useAuth } from "../auth/useSession";

export default function PatientSignupPage() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [noChart, setNoChart] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalizedEmail)) {
      setError("Enter a valid email address.");
      return;
    }
    if (password.length < 10 || password.length > 128) {
      setError("Use a password between 10 and 128 characters.");
      return;
    }
    setBusy(true);
    setError("");
    setNoChart(false);
    patientSignupByEmail({ email: normalizedEmail, password })
      .then((result) => {
        signIn(result.user, result.accessToken, result.mustChangePassword, result.refreshToken);
        navigate("/portal", { replace: true });
      })
      .catch((reason: Error) => {
        if (reason instanceof ApiError && reason.status === 404) {
          setNoChart(true);
        } else if (reason instanceof ApiError && reason.status === 409) {
          setError(reason.message);
        } else if (reason instanceof ApiError && reason.status === 429) {
          setError("Too many attempts. Try again in 15 minutes.");
        } else {
          setError(reason.message);
        }
      })
      .finally(() => setBusy(false));
  };

  return (
    <Box
      sx={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        bgcolor: utep.navyDark,
        backgroundImage: brandAtmosphere,
        px: { xs: 2, sm: 4 },
      }}
    >
      <Box aria-hidden sx={{ height: 5, bgcolor: utep.orange, mx: { xs: -2, sm: -4 } }} />
      <Box
        component="header"
        sx={{ width: "100%", maxWidth: 1080, mx: "auto", py: { xs: 2.5, sm: 3.5 } }}
      >
        <BrandLogo variant="lockup" subtitle="Patient portal" />
      </Box>
      <Box
        component="main"
        sx={{ flex: 1, display: "grid", placeItems: "center", py: { xs: 3, sm: 5 } }}
      >
        <Paper
          component="section"
          aria-labelledby={noChart ? "no-chart-title" : "patient-signup-title"}
          sx={{ width: "100%", maxWidth: 500, overflow: "hidden" }}
        >
          <Box sx={{ height: 5, bgcolor: utep.orange }} />
          <Box sx={{ p: { xs: 3, sm: 4.5 } }}>
            {noChart ? (
              <>
                <Typography variant="overline" sx={{ color: utep.navy, fontWeight: 800, letterSpacing: 1.2 }}>
                  PATIENT PORTAL
                </Typography>
                <Typography id="no-chart-title" component="h1" variant="h5" sx={{ mt: 0.5, mb: 1 }}>
                  No patient chart found
                </Typography>
                <Typography color="text.secondary" sx={{ mb: 3 }}>
                  We couldn&apos;t find an eligible chart registered to this email. Contact your administrator to update the chart email.
                </Typography>
                <Stack spacing={1.5}>
                  <Button variant="contained" onClick={() => setNoChart(false)}>Try another email</Button>
                  <Link component={RouterLink} to="/">Return to sign in</Link>
                </Stack>
              </>
            ) : (
              <>
                <Typography variant="overline" sx={{ color: utep.navy, fontWeight: 800, letterSpacing: 1.2 }}>
                  PATIENT PORTAL
                </Typography>
                <Typography id="patient-signup-title" component="h1" variant="h4" sx={{ mt: 0.5, mb: 0.75 }}>
                  Create your account
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Create an account with your email. If you already have a patient chart, use the email registered on it.
                </Typography>
                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                <Box component="form" noValidate onSubmit={submit}>
                  <Stack spacing={2}>
                    <TextField
                      label="Email" type="email" required autoFocus fullWidth autoComplete="email"
                      value={email} onChange={(event) => setEmail(event.target.value)}
                    />
                    <TextField
                      label="Password" required fullWidth autoComplete="new-password"
                      type={showPassword ? "text" : "password"} helperText="At least 10 characters"
                      value={password} onChange={(event) => setPassword(event.target.value)}
                      slotProps={{ input: { endAdornment: (
                        <InputAdornment position="end">
                          <IconButton aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((shown) => !shown)} edge="end">
                            {showPassword ? <VisibilityOffOutlined /> : <VisibilityOutlined />}
                          </IconButton>
                        </InputAdornment>
                      ) } }}
                    />
                    <Button type="submit" variant="contained" size="large" disabled={busy} sx={{ mt: 0.5 }}>
                      {busy ? "Creating account…" : "Create account"}
                    </Button>
                  </Stack>
                </Box>
                <Typography variant="body2" sx={{ mt: 2.5 }}>
                  Already have an account? <Link component={RouterLink} to="/portal/login">Sign in</Link>
                </Typography>
              </>
            )}
          </Box>
        </Paper>
      </Box>
    </Box>
  );
}
