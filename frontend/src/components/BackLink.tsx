import { Button } from "@mui/material";
import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import { Link as RouterLink } from "react-router-dom";
import { utep } from "../theme/tokens";

export default function BackLink({ to, label }: { to: string; label: string }) {
  return (
    <Button
      component={RouterLink}
      to={to}
      startIcon={<ArrowBackRounded />}
      sx={{ px: 0.5, alignSelf: "flex-start", color: utep.navy, fontWeight: 700 }}
    >
      {label}
    </Button>
  );
}
