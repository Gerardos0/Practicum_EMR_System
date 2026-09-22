// import { useState } from "react";
import {
  AppBar, Box, Button, Chip, MenuItem, Select, Toolbar, Typography,
} from "@mui/material";
import { NavLink, useNavigate } from "react-router-dom";
import { useSession } from "../features/auth/AuthContext";
import { listCoursesForUser } from "../api/courses";
// import { useDisplayPrefs } from "../theme/DisplayPrefsProvider";
import { utep } from "../theme/tokens";
import { disciplineLabel, roleLabel } from "../utils/labels";
import { homePathFor } from "../utils/permissions";
import { useAsync } from "../utils/useAsync";
import type { Role } from "../types";

const NAV: Record<Role, { to: string; label: string }[]> = {
  student: [{ to: "/patients", label: "My patients" }],
  instructor: [
    { to: "/review", label: "Review queue" },
    { to: "/patients", label: "Patients" },
    { to: "/admin/roster", label: "Roster" },
    { to: "/audit", label: "Activity log" },
  ],
  admin: [
    { to: "/admin/roster", label: "Roster" },
    { to: "/audit", label: "Activity log" },
    { to: "/patients", label: "Patients" },
  ],
  front_desk: [{ to: "/patients", label: "Patients" }],
  patient: [],
};

export default function AppHeader() {
  const navigate = useNavigate();
  const { user, activeRole, discipline, courseId, switchRole, selectCourse, signOut } = useSession();
  // const { prefs, setPrefs } = useDisplayPrefs();
  // const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const { data: courses = [] } = useAsync(() => listCoursesForUser(user), [user.id]);

  const roleCourses = courses.filter((c) => user.roles.find((r) => r.role === activeRole)?.courseIds.includes(c.id));

  const navSx = {
    color: utep.navy, fontWeight: 600, px: 1.5, borderRadius: 1,
    "&.active": { bgcolor: "rgba(14,34,80,0.12)", boxShadow: `inset 0 -3px 0 ${utep.navy}` },
  };

  return (
    <AppBar position="sticky" elevation={0} sx={{ bgcolor: utep.orange, color: utep.navy }}>
      <Toolbar sx={{ gap: 1, flexWrap: "wrap", py: { xs: 1, md: 0 }, minHeight: { md: 60 } }}>
        <Typography component="span" sx={{ fontWeight: 800, fontSize: 18, mr: 2 }}>UTEP EMR</Typography>

        <Box component="nav" aria-label="Main" sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
          {NAV[activeRole].map((item) => (
            <Button key={item.to} component={NavLink} to={item.to} sx={navSx}>{item.label}</Button>
          ))}
        </Box>

        <Box sx={{ flexGrow: 1 }} />

        {roleCourses.length > 1 && (
          <Select
            size="small" value={courseId} inputProps={{ "aria-label": "Course" }}
            onChange={(e) => selectCourse(e.target.value)}
            sx={{ bgcolor: "rgba(255,255,255,0.85)", minWidth: 150, "& fieldset": { border: "none" } }}
          >
            {roleCourses.map((c) => <MenuItem key={c.id} value={c.id}>{c.code}</MenuItem>)}
          </Select>
        )}

        {user.roles.length > 1 && (
          <Select
            size="small" value={activeRole} inputProps={{ "aria-label": "Acting as" }}
            onChange={(e) => {
              const role = e.target.value as Role;
              switchRole(role);
              navigate(homePathFor(role));
            }}
            sx={{ bgcolor: "rgba(255,255,255,0.85)", "& fieldset": { border: "none" } }}
          >
            {user.roles.map((r) => <MenuItem key={r.role} value={r.role}>{roleLabel[r.role]}</MenuItem>)}
          </Select>
        )}

        {/* <Tooltip title="Text size and contrast">
          <IconButton aria-label="Display settings" color="inherit" onClick={(e) => setAnchor(e.currentTarget)}>
            <TextIncreaseOutlined />
          </IconButton>
        </Tooltip> */}
        {/* <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
          <Box sx={{ px: 2, py: 1.5, width: 260 }}>
            <Typography variant="subtitle2" id="text-size" sx={{ mb: 1 }}>Text size</Typography>
            <ToggleButtonGroup
              exclusive fullWidth size="small" value={prefs.textScale} aria-labelledby="text-size"
              onChange={(_, v) => v && setPrefs({ textScale: v })}
            >
              <ToggleButton value={1}>Default</ToggleButton>
              <ToggleButton value={1.15}>Large</ToggleButton>
              <ToggleButton value={1.3}>Largest</ToggleButton>
            </ToggleButtonGroup>
            <Divider sx={{ my: 1.5 }} />
            <FormControlLabel
              control={<Switch checked={prefs.highContrast} onChange={(e) => setPrefs({ highContrast: e.target.checked })} />}
              label="High contrast"
            />
          </Box>
        </Menu> */}

        <Box sx={{ textAlign: "right", display: { xs: "none", sm: "block" }, lineHeight: 1.2 }}>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>{user.fullName}</Typography>
          <Typography variant="caption">{roleLabel[activeRole]}{discipline ? `, ${disciplineLabel[discipline]}` : ""}</Typography>
        </Box>
        <Chip label="Training" size="small" sx={{ bgcolor: utep.navy, color: "#fff", display: { xs: "none", md: "flex" } }} />
        <Button color="inherit" onClick={() => { signOut(); navigate("/"); }}>Sign out</Button>
      </Toolbar>
    </AppBar>
  );
}
