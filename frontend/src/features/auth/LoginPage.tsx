import { useState, type FormEvent } from "react";
import {
  Alert, Box, Button, Collapse, IconButton, InputAdornment, Link, Stack, TextField, Typography,
} from "@mui/material";
import VisibilityOutlined from "@mui/icons-material/VisibilityOutlined";
import VisibilityOffOutlined from "@mui/icons-material/VisibilityOffOutlined";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { login } from "../../api/auth";
import { takeSignedOutNotice } from "../../api/client";
import { homePathFor, uniqueRoles } from "../../utils/permissions";
import BrandLogo from "../../components/BrandLogo";
import { brandAtmosphere, utep } from "../../theme/tokens";
import { useAuth } from "./useSession";

export default function LoginPage() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showDemo, setShowDemo] = useState(false);
  const [error, setError] = useState("");
  const [notice] = useState(takeSignedOutNotice);
  const [busy, setBusy] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      setError("Enter your email or username to continue.");
      return;
    }
    if (!password) {
      setError("Enter your password.");
      return;
    }
    setBusy(true);
    setError("");
    login(identifier, password)
      .then((result) => {
        signIn(result.user, result.accessToken, result.mustChangePassword, result.refreshToken);
        if (result.mustChangePassword) {
          navigate("/change-password", { replace: true });
          return;
        }
        const roles = uniqueRoles(result.user);
        const only = roles.length === 1 ? roles[0] : undefined;
        const singleCourse = result.user.roles.length === 1 && result.user.roles[0].courseIds.length === 1;
        if (only === "patient") {
          navigate(homePathFor("patient"), { replace: true });
          return;
        }
        if (only === "admin" || singleCourse) {
          navigate(homePathFor(only!), { replace: true });
          return;
        }
        navigate("/select-course", { replace: true });
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setBusy(false));
  };

  return (
    <Box
      sx={{
        height: "100dvh",
        overflow: "hidden",
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1fr) minmax(300px, 400px)" },
        bgcolor: utep.navyDark,
      }}
    >
      <Box
        component="aside"
        aria-hidden={false}
        sx={{
          position: "relative",
          display: { xs: "none", md: "flex" },
          flexDirection: "column",
          justifyContent: "center",
          px: { md: 5, lg: 7 },
          py: 4,
          backgroundImage: brandAtmosphere,
          color: "#fff",
          overflow: "hidden",
          "&::after": {
            content: '""',
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, transparent 35%, rgba(8,22,54,0.45) 100%)",
            pointerEvents: "none",
          },
        }}
      >
        <Box sx={{ position: "relative", zIndex: 1, maxWidth: 460 }}>
          <BrandLogo variant="hero" titleSize={{ md: 44, lg: 52 }} sx={{ mb: 0 }} />
          <Typography sx={{ fontSize: 16, fontWeight: 500, maxWidth: "32ch", opacity: 0.92, mb: 1.5 }}>
            Educational medical record for pharmacy and clinical training.
          </Typography>
          <Box sx={{ width: "min(100%, 28ch)", height: 3, bgcolor: utep.orange, mb: 1.5 }} />
          <Typography variant="body2" sx={{ opacity: 0.78, maxWidth: "40ch" }}>
            Simulated patients only — never real PHI.
          </Typography>
          <Box sx={{ mt: 3, maxWidth: 220, opacity: 0.92, "@media (max-height: 720px)": { display: "none" } }}>
            <BrandLogo variant="wordmark" />
          </Box>
        </Box>
      </Box>

      <Box
        component="main"
        sx={{
          bgcolor: utep.paper,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          overflow: "auto",
          px: { xs: 3, sm: 4 },
          py: 3,
        }}
      >
        <Box component="section" aria-labelledby="login-title" sx={{ width: "100%", maxWidth: 360, mx: "auto" }}>
          <Box sx={{ display: { md: "none" }, mb: 2 }}>
            <BrandLogo variant="lockup" invert />
          </Box>
          <Typography id="login-title" component="h1" variant="h5" sx={{ mb: 0.5 }}>
            Sign in
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Use your authorized training account.
          </Typography>

          {notice && <Alert severity="info" sx={{ mb: 2 }}>{notice}</Alert>}
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <Box component="form" noValidate onSubmit={submit}>
            <Stack spacing={2}>
              <TextField
                label="Email or username" type="text" autoComplete="username" autoFocus fullWidth
                placeholder="you@example.com" value={identifier} onChange={(e) => setIdentifier(e.target.value)}
              />
              <TextField
                label="Password" type={showPassword ? "text" : "password"} autoComplete="current-password"
                fullWidth size="medium" value={password} onChange={(e) => setPassword(e.target.value)}
                slotProps={{ input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        onClick={() => setShowPassword((s) => !s)} edge="end"
                      >
                        {showPassword ? <VisibilityOffOutlined /> : <VisibilityOutlined />}
                      </IconButton>
                    </InputAdornment>
                  ),
                } }}
              />
              <Button type="submit" variant="contained" size="large" disabled={busy} sx={{ mt: 0.5 }}>
                {busy ? "Signing in…" : "Sign in"}
              </Button>
              {import.meta.env.DEV && (
                <Box>
                  <Link
                    component="button"
                    type="button"
                    variant="body2"
                    underline="hover"
                    onClick={() => setShowDemo((v) => !v)}
                    sx={{ fontWeight: 600 }}
                  >
                    {showDemo ? "Hide demo accounts" : "Demo accounts"}
                  </Link>
                  <Collapse in={showDemo}>
                    <Typography variant="body2" color="text.secondary" component="div" sx={{ mt: 1.25, lineHeight: 1.7 }}>
                      Student: daniel.reyes@miners.utep.edu
                      <br />
                      Instructor: gerardo.sillas@utep.edu
                      <br />
                      Administrator: clarissa.dominguez@utep.edu
                      <br />
                      Password: practicum-demo
                    </Typography>
                  </Collapse>
                </Box>
              )}
            </Stack>
          </Box>
          <Typography variant="body2" sx={{ mt: 2.5 }}>
            <Link component={RouterLink} to="/portal/signup">New patient? Create your account</Link>
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
