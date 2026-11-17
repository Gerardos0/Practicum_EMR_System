import { useState, type FormEvent } from "react";
import {
  AppBar, Box, Chip, Divider, FormControlLabel, IconButton, InputBase, Menu, MenuItem, Select,
  Switch, ToggleButton, ToggleButtonGroup, Toolbar, Tooltip, Typography,
} from "@mui/material";
import MenuOpenRounded from "@mui/icons-material/MenuOpenRounded";
import MenuRounded from "@mui/icons-material/MenuRounded";
import SearchRounded from "@mui/icons-material/SearchRounded";
import TextIncreaseOutlined from "@mui/icons-material/TextIncreaseOutlined";
import { useLocation, useNavigate } from "react-router-dom";
import { useSession } from "../features/auth/useSession";
import { getCourse, listCoursesForUser } from "../api/courses";
import { useDisplayPrefs } from "../theme/useDisplayPrefs";
import { brandAccentBar, fontDisplay, utep } from "../theme/tokens";
import { disciplineLabel, roleLabel } from "../utils/labels";
import { courseIdsForRole, homePathFor, uniqueRoles } from "../utils/permissions";
import { useAsync } from "../utils/useAsync";
import { usePageHeadingValue } from "./usePageHeading";
import type { Role } from "../types";

const pickerSx = {
  bgcolor: "#fff", color: utep.navy, fontWeight: 600, borderRadius: 1, height: 40,
  "& fieldset": { border: "none" },
};

export default function AppHeader({ onOpenNav }: { onOpenNav: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  const heading = usePageHeadingValue();
  const { user, activeRole, discipline, courseId, switchRole, selectCourse } = useSession();
  const { prefs, setPrefs } = useDisplayPrefs();
  const roles = uniqueRoles(user);
  const [q, setQ] = useState("");
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const { data: courses = [] } = useAsync(() => listCoursesForUser(), [user.id]);
  const course = useAsync(() => (courseId ? getCourse(courseId) : Promise.resolve(undefined)), [courseId]);

  const roleCourseIds = courseIdsForRole(user, activeRole);
  const roleCourses = activeRole === "admin"
    ? courses
    : courses.filter((c) => roleCourseIds.includes(c.id) && (activeRole !== "student" || c.status !== "ended"));
  const initials = user.fullName.split(" ").map((w) => w[0]).slice(0, 2).join("");
  const isAdmin = activeRole === "admin";
  const canSearch = activeRole !== "patient" && !isAdmin;
  const courseLabel = isAdmin
    ? "Program administration"
    : course.data
      ? `${course.data.code}: ${course.data.title}${course.data.term ? `, ${course.data.term}` : ""}`
      : " ";

  const search = (e: FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    const next = new URLSearchParams(location.pathname === "/patients" ? location.search : "");
    if (term) next.set("q", term);
    else next.delete("q");
    const qs = next.toString();
    navigate(qs ? `/patients?${qs}` : "/patients");
  };

  return (
    <>
      <AppBar
        position="sticky" elevation={0}
        sx={{ bgcolor: utep.paper, color: utep.navy, borderBottom: `1px solid ${utep.lineSoft}` }}
      >
        <Box aria-hidden sx={{ height: 3, background: brandAccentBar }} />
        <Toolbar sx={{ gap: 1, flexWrap: "nowrap", py: 0.75, px: { xs: 1.5, md: 2 }, minHeight: 56 }}>
          <IconButton
            aria-label="Open navigation" onClick={onOpenNav}
            sx={{ display: { md: "none" }, color: utep.navy, minWidth: 44, minHeight: 44 }}
          >
            <MenuRounded />
          </IconButton>
          <IconButton
            aria-label={prefs.navCollapsed ? "Expand navigation" : "Collapse navigation"}
            onClick={() => setPrefs({ navCollapsed: !prefs.navCollapsed })}
            sx={{ display: { xs: "none", md: "inline-flex" }, color: utep.navy, minWidth: 44, minHeight: 44 }}
          >
            {prefs.navCollapsed ? <MenuRounded /> : <MenuOpenRounded />}
          </IconButton>

          <Box sx={{ flex: "1 1 0", minWidth: 0, maxWidth: 340 }}>
            <Typography
              component="h1"
              noWrap
              sx={{
                fontFamily: fontDisplay,
                fontWeight: 700,
                fontSize: heading ? 20 : 16,
                lineHeight: 1.15,
                color: utep.navy,
                letterSpacing: "-0.02em",
              }}
            >
              {heading?.title ?? courseLabel}
            </Typography>
            {heading && (
              <Typography noWrap sx={{ fontSize: 12.5, fontWeight: 600, color: utep.ink2 }}>
                {courseLabel}
              </Typography>
            )}
          </Box>

          {canSearch && (
            <Box
              component="form" role="search" onSubmit={search}
              sx={{
                flex: "1 1 140px", minWidth: 0, maxWidth: 260, display: "flex", alignItems: "center", gap: 0.75, px: 1.25, height: 36,
                bgcolor: "rgba(14,34,80,0.04)", borderRadius: 1, color: "text.secondary",
                boxShadow: `inset 0 0 0 1px ${utep.lineSoft}`,
              }}
            >
              <SearchRounded fontSize="small" aria-hidden />
              <Typography component="label" htmlFor="patient-search" sx={{ fontSize: 13, fontWeight: 700, color: utep.navy, display: { xs: "none", lg: "block" } }}>
                Search
              </Typography>
              <InputBase
                id="patient-search"
                value={q} onChange={(e) => {
                  const value = e.target.value;
                  setQ(value);
                  if (location.pathname !== "/patients") return;
                  const next = new URLSearchParams(location.search);
                  const term = value.trim();
                  if (term) next.set("q", term);
                  else next.delete("q");
                  const qs = next.toString();
                  navigate(qs ? `/patients?${qs}` : "/patients", { replace: true });
                }}
                sx={{ flex: 1, fontSize: 14 }}
                placeholder={activeRole === "student" ? "Search name, MRN, or date of birth" : "Search patient, MRN, date of birth, or student"}
                inputProps={{ "aria-label": "Search patients" }}
              />
            </Box>
          )}

          {!isAdmin && courseId && roleCourses.length > 1 && (
            <Select
              size="small" value={courseId} inputProps={{ "aria-label": "Course" }}
              onChange={(e) => {
                selectCourse(e.target.value);
                // Leave chart/review deep links so we don't show another course's patient.
                navigate(homePathFor(activeRole));
              }}
              sx={{ ...pickerSx, height: 36, maxWidth: 168, "& .MuiSelect-select": { overflow: "hidden", textOverflow: "ellipsis" } }}
            >
              {roleCourses.map((c) => <MenuItem key={c.id} value={c.id}>{c.code}, {c.term}</MenuItem>)}
            </Select>
          )}

          {roles.length > 1 && (
            <Select
              size="small" value={activeRole} inputProps={{ "aria-label": "Acting as" }}
              onChange={(e) => {
                const role = e.target.value as Role;
                switchRole(role);
                navigate(homePathFor(role));
              }}
              sx={{ ...pickerSx, height: 36, bgcolor: utep.navy, color: "#fff", "& .MuiSvgIcon-root": { color: "#fff" } }}
              renderValue={(v) => roleLabel[v as Role]}
            >
              {roles.map((role) => <MenuItem key={role} value={role}>{roleLabel[role]}</MenuItem>)}
            </Select>
          )}

          <Tooltip title={`Text size ${Math.round(prefs.textScale * 100)}%${prefs.highContrast ? ", high contrast" : ""}`}>
            <IconButton aria-label="Display settings" sx={{ color: utep.navy }} onClick={(e) => setAnchor(e.currentTarget)}>
              <TextIncreaseOutlined />
            </IconButton>
          </Tooltip>
          <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
            <Box sx={{ px: 2, py: 1.5, width: 280 }}>
              <Typography variant="subtitle2" id="text-size" sx={{ mb: 0.25 }}>Text size</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
                Large is 125%. Largest is 150%.
              </Typography>
              <ToggleButtonGroup
                exclusive fullWidth size="small" value={prefs.textScale} aria-labelledby="text-size"
                onChange={(_, v) => v && setPrefs({ textScale: v })}
              >
                <ToggleButton value={1}>100%</ToggleButton>
                <ToggleButton value={1.25}>125%</ToggleButton>
                <ToggleButton value={1.5}>150%</ToggleButton>
              </ToggleButtonGroup>
              <Divider sx={{ my: 1.5 }} />
              <FormControlLabel
                control={<Switch checked={prefs.highContrast} onChange={(e) => setPrefs({ highContrast: e.target.checked })} />}
                label="High contrast"
              />
              <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                Darker text and borders on a white page.
              </Typography>
            </Box>
          </Menu>

          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Box sx={{ textAlign: "right", lineHeight: 1.2, display: { xs: "none", xl: "block" } }}>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>{user.fullName}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                {roleLabel[activeRole]}{discipline ? `, ${disciplineLabel[discipline]}` : ""}
              </Typography>
            </Box>
            <Box
              aria-hidden
              sx={{ width: 36, height: 36, borderRadius: 1, bgcolor: utep.navy, color: "#fff", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 13 }}
            >
              {initials}
            </Box>
            <Chip label="Training" size="small" variant="outlined" sx={{ display: { xs: "none", xl: "flex" }, borderColor: utep.line }} />
          </Box>
        </Toolbar>
      </AppBar>
    </>
  );
}
