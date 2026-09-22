import { useState, type FormEvent } from "react";
import {
  Box,
  Paper,
  Typography,
  InputBase,
  InputAdornment,
  IconButton,
  Checkbox,
  FormControlLabel,
  Button,
} from "@mui/material";
import { keyframes } from "@emotion/react";
import { useNavigate } from "react-router-dom";
import MailOutlineRounded from "@mui/icons-material/MailOutlineRounded";
import LockOutlined from "@mui/icons-material/LockOutlined";
import VisibilityOutlined from "@mui/icons-material/VisibilityOutlined";
import VisibilityOffOutlined from "@mui/icons-material/VisibilityOffOutlined";
import KeyOutlined from "@mui/icons-material/KeyOutlined";

import HorizonBackdrop from "../components/HorizonBackdrop";
import {
  utep,
  fontFamily,
  glassCard,
  glassInput,
  fieldLabel,
  primaryButton,
  glassButton,
} from "../../utepGlass.ts";

const rise = keyframes`
  from { opacity: 0; transform: translateY(14px) scale(0.985); }
  to   { opacity: 1; transform: none; }
`;

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setEmailError("Enter your Miners email to continue.");
      return;
    }
    // TODO: real auth in a later sprint
    navigate("/patients");
  };

  return (
    <Box
      sx={{
        position: "relative",
        isolation: "isolate",
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 1.5,
        px: 2,
        pt: 11,
        pb: 3,
        fontFamily,
        bgcolor: "#FFFFFF",
      }}
    >
      <HorizonBackdrop />

      <Paper
        elevation={0}
        component="section"
        aria-labelledby="login-title"
        sx={{
          ...(glassCard as object),
          animation: `${rise} 700ms cubic-bezier(0.2, 0.8, 0.2, 1) both`,
          "@media (prefers-reduced-motion: reduce)": { animation: "none" },
        }}
      >
        <Typography
          id="login-title"
          component="h1"
          sx={{
            mt: 0,
            mb: 0.5,
            fontFamily,
            fontSize: { xs: 24, sm: 26 },
            lineHeight: 1.1,
            fontWeight: 700,
            letterSpacing: "-0.025em",
          }}
        >
          Sign in
        </Typography>
        <Typography sx={{ mb: 2.5, fontFamily, fontSize: 14, color: utep.ink2 }}>
          Use your Miners account to open your patient list.
        </Typography>

        <Box component="form" noValidate onSubmit={handleSubmit}>
          {/* Email */}
          <Box component="label" htmlFor="email" sx={fieldLabel}>
            Email
          </Box>
          <InputBase
            id="email"
            type="email"
            autoComplete="username"
            placeholder="you@miners.utep.edu"
            fullWidth
            value={email}
            error={Boolean(emailError)}
            onChange={(e) => {
              setEmail(e.target.value);
              if (emailError) setEmailError("");
            }}
            inputProps={{ "aria-describedby": emailError ? "email-error" : undefined }}
            startAdornment={
              <InputAdornment position="start" sx={{ m: 0 }}>
                <MailOutlineRounded className="lead-icon" fontSize="small" />
              </InputAdornment>
            }
            sx={{ ...(glassInput as object), mb: emailError ? 0.75 : 1.75 }}
          />
          {emailError && (
            <Typography
              id="email-error"
              sx={{ mb: 1.5, fontFamily, fontSize: 13, color: "#FF9D8A" }}
            >
              {emailError}
            </Typography>
          )}

          {/* Password */}
          <Box component="label" htmlFor="password" sx={fieldLabel}>
            Password
          </Box>
          <InputBase
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Your password"
            fullWidth
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            startAdornment={
              <InputAdornment position="start" sx={{ m: 0 }}>
                <LockOutlined className="lead-icon" fontSize="small" />
              </InputAdornment>
            }
            endAdornment={
              <InputAdornment position="end" sx={{ m: 0 }}>
                <IconButton
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((s) => !s)}
                  edge="end"
                  size="small"
                  sx={{ color: utep.ink3, "&:hover": { color: utep.ink } }}
                >
                  {showPassword ? (
                    <VisibilityOffOutlined fontSize="small" />
                  ) : (
                    <VisibilityOutlined fontSize="small" />
                  )}
                </IconButton>
              </InputAdornment>
            }
            sx={{ ...(glassInput as object), mb: 1 }}
          />

          <FormControlLabel
            control={
              <Checkbox
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                size="small"
                sx={{
                  color: "rgba(255,255,255,0.3)",
                  "&.Mui-checked": { color: utep.orange },
                }}
              />
            }
            label="Keep me signed in on this device"
            sx={{
              mb: 1.75,
              ml: -1,
              "& .MuiFormControlLabel-label": {
                fontFamily,
                fontSize: 13,
                color: utep.ink2,
              },
            }}
          />

          <Button type="submit" fullWidth disableElevation sx={primaryButton}>
            Sign in
          </Button>

          {/* Divider */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.75,
              my: 1.5,
              fontSize: 12,
              color: utep.ink3,
              "&::before, &::after": {
                content: '""',
                flex: 1,
                height: "1px",
                bgcolor: "rgba(255,255,255,0.10)",
              },
            }}
          >
            or
          </Box>

          {/* Remove this button if SSO isn't in scope yet */}
          <Button
            type="button"
            fullWidth
            onClick={() => navigate("/patients")}
            startIcon={<KeyOutlined />}
            sx={glassButton}
          >
            Continue with UTEP single sign-on
          </Button>
        </Box>

        {/* Training notice */}
        
      </Paper>

      
    </Box>
  );
}