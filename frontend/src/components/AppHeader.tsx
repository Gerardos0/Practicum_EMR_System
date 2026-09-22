import { AppBar, Toolbar, Typography, Chip, Box, Button } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { currentUser } from "../data/mockData";

export default function AppHeader() {
  const navigate = useNavigate();

  return (
    <AppBar position="static" elevation={4}>
      <Toolbar>
        <Typography variant="h6" component="div">
          UTEP Educational EMR
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Typography variant="body2" sx={{ mr: 2 }}>
          {currentUser.fullName}
        </Typography>
        <Chip
          label={currentUser.discipline}
          size="small"
          variant="outlined"
          sx={{ color: "inherit", borderColor: "rgba(255,255,255,0.7)", mr: 2 }}
        />
        <Button color="inherit" onClick={() => navigate("/")}>
          Sign out
        </Button>
      </Toolbar>
    </AppBar>
  );
}
