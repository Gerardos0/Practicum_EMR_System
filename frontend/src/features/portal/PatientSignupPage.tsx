import { useState, type FormEvent } from "react";
import { Alert, Box, Button, IconButton, InputAdornment, Link, Paper, Stack, TextField, Typography } from "@mui/material";
import VisibilityOutlined from "@mui/icons-material/VisibilityOutlined";
import VisibilityOffOutlined from "@mui/icons-material/VisibilityOffOutlined";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { ApiError } from "../../api/client";
import { patientSignup } from "../../api/portalAccounts";
import { trainingStripe, utep } from "../../theme/tokens";
import { useAuth } from "../auth/useSession";

const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{3,29}$/;

export default function PatientSignupPage() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [code, setCode] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const normalizedUsername = username.trim().toLowerCase();
    if (code.replace(/[\s-]/g, "").length !== 8) {
      setError("Enter the 8-character activation code.");
      return;
    }
    if (!USERNAME_RE.test(normalizedUsername)) {
      setError("Username must be 4–30 letters, numbers, dots, dashes or underscores and start with a letter or number.");
      return;
    }
    if (password.length < 10 || password.length > 128) {
      setError("Use a password between 10 and 128 characters.");
      return;
    }
    if (password.toLowerCase() === normalizedUsername) {
      setError("Password cannot be the same as your username.");
      return;
    }
    if (password !== confirm) {
      setError("The passwords don't match.");
      return;
    }
    setBusy(true);
    setError("");
    patientSignup({ code, username: normalizedUsername, password })
      .then((result) => {
        signIn(result.user, result.accessToken, result.mustChangePassword, result.refreshToken);
        navigate("/portal", { replace: true });
      })
      .catch((reason: Error) => {
        if (reason instanceof ApiError && reason.status === 409) {
          setError("That username is taken. Try another.");
        } else if (reason instanceof ApiError && reason.status === 429) {
          setError("Too many attempts. Try again in 15 minutes.");
        } else {
          setError(reason.message);
        }
      })
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
      <Box aria-hidden sx={{ height: 6, background: trainingStripe }} />
      <Box component="main" sx={{ flex: 1, display: "grid", placeItems: "center", px: 2, py: 5 }}>
        <Paper component="section" aria-labelledby="patient-signup-title" sx={{ width: "100%", maxWidth: 420, p: { xs: 3, sm: 4 } }}>
          <Typography id="patient-signup-title" component="h1" variant="h5" sx={{ mb: 0.5 }}>Create your patient account</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Use the one-time activation code from your administrator.
          </Typography>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Box component="form" noValidate onSubmit={submit}>
            <Stack spacing={2}>
              <TextField
                label="Activation code" required autoFocus fullWidth autoComplete="one-time-code"
                value={code} onChange={(event) => setCode(event.target.value.toUpperCase())}
              />
              <TextField
                label="Username" required fullWidth autoComplete="username"
                helperText="4–30 letters, numbers, dots, dashes or underscores"
                value={username} onChange={(event) => setUsername(event.target.value)}
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
              <TextField
                label="Confirm password" required fullWidth autoComplete="new-password"
                type={showPassword ? "text" : "password"}
                value={confirm} onChange={(event) => setConfirm(event.target.value)}
              />
              <Button type="submit" variant="contained" size="large" disabled={busy}>
                {busy ? "Creating account…" : "Create account"}
              </Button>
            </Stack>
          </Box>
          <Typography variant="body2" sx={{ mt: 2.5 }}>
            Already have an account? <Link component={RouterLink} to="/portal/login">Sign in</Link>
          </Typography>
        </Paper>
      </Box>
    </Box>
  );
}
