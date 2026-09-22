import { AppBar, Toolbar, Typography, Chip, Box, Button } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { currentUser } from "../data/mockData";
import { fontFamily } from "../../utepGlass";

export default function AppHeader() {
  const navigate = useNavigate();

  return (
    <AppBar
    sx={{
        background: "linear-gradient(90deg, #EE8B3C, #F2A15B)",
          color: "#0E2250",
          fontFamily,
          fontWeight: 800,
          fontSize: 18,
      }}
     position="static" elevation={4}>
      <Toolbar>
        <Typography variant="h6" component="div">
          UTEP EMR
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Typography variant="body2" sx={{ mr: 2 }}>
          {currentUser.fullName}
        </Typography>
        <Chip
          label={currentUser.discipline}
          size="small"
          variant="outlined"
          sx={{ backgroundColor: "#0E2250", borderColor: "#FFFFF", color: "#FFFFFF", fontWeight: 600, mr: 2 }}
        />
        <Button color="inherit" onClick={() => navigate("/")}>
          Sign out
        </Button>
      </Toolbar>
    </AppBar>
  );
}
