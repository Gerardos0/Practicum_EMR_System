import { Box, Button, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <Box sx={{ py: 8, textAlign: "center" }}>
      <Typography component="h1" variant="h5">This page doesn't exist</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>Check the link, or go back to your patient list.</Typography>
      <Button component={RouterLink} to="/patients" variant="contained">Go to patients</Button>
    </Box>
  );
}
