import { useState } from "react";
import { flushSync } from "react-dom";
import {
  Box, Button, Card, CardActionArea, CardContent, Chip, Stack, ToggleButton, ToggleButtonGroup, Typography,
} from "@mui/material";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import { useNavigate } from "react-router-dom";
import { listCoursesForUser } from "../../api/courses";
import { disciplineLabel, roleLabel } from "../../utils/labels";
import { courseIdsForRole, homePathFor, uniqueRoles } from "../../utils/permissions";
import { useAsync } from "../../utils/useAsync";
import { trainingStripe, utep } from "../../theme/tokens";
import { useSession } from "./useSession";

export default function SelectCoursePage() {
  const navigate = useNavigate();
  const { user, activeRole, switchRole, selectCourse, signOut } = useSession();
  const [pickedId, setPickedId] = useState<string>();
  const { data: courses = [], loading, error } = useAsync(() => listCoursesForUser(), [user.id]);

  const assignment = user.roles.find((r) => r.role === activeRole);
  const roles = uniqueRoles(user);
  const roleCourseIds = courseIdsForRole(user, activeRole);
  const available = activeRole === "admin"
    ? courses
    : courses.filter((c) => roleCourseIds.includes(c.id) && (activeRole !== "student" || c.status !== "ended"));

  const soleId = available.length === 1 ? available[0].id : undefined;
  const picked = pickedId && available.some((c) => c.id === pickedId) ? pickedId : soleId;

  const go = () => {
    if (!picked) return;
    flushSync(() => selectCourse(picked));
    navigate(homePathFor(activeRole), { replace: true });
  };

  return (
    <Box sx={{ minHeight: "100dvh", bgcolor: "background.default" }}>
      <Box sx={{ bgcolor: utep.orange, color: utep.navy, px: 3.5, height: 60, display: "flex", alignItems: "center" }}>
        <Typography sx={{ fontWeight: 800, fontSize: 18 }}>UTEP EMR</Typography>
        <Box sx={{ flex: 1 }} />
        <Button color="inherit" onClick={signOut}>Sign out</Button>
      </Box>
      <Box aria-hidden sx={{ height: 6, background: trainingStripe }} />

      <Box component="main" sx={{ maxWidth: 640, mx: "auto", px: 2, py: 5 }}>
        <Typography component="h1" variant="h5">Welcome, {user.fullName.split(" ")[0]}</Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          {activeRole === "admin"
            ? "Administration is separate from teaching."
            : "Choose the course you're working in today."}
          {activeRole === "student" && " You'll see the patients and cases assigned to that class."}
          {(activeRole === "instructor" || activeRole === "course_coordinator") && " You'll review notes and teach that class."}
        </Typography>

        {roles.length > 1 && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" id="role-label" sx={{ mb: 1 }}>Sign in as</Typography>
            <ToggleButtonGroup
              exclusive value={activeRole} aria-labelledby="role-label" size="small"
              onChange={(_, r) => { if (r) { switchRole(r); setPickedId(undefined); } }}
            >
              {roles.map((role) => (
                <ToggleButton key={role} value={role} sx={{ px: 2 }}>{roleLabel[role]}</ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>
        )}

        {activeRole === "admin" ? (
          <Box>
            <Typography color="text.secondary" sx={{ mb: 2, maxWidth: "48ch" }}>
              Add classes, enroll students, and add instructors. Case building and grading stay on the instructor screens.
            </Typography>
            <Button variant="contained" size="large" onClick={() => navigate("/admin")}>Open administration</Button>
          </Box>
        ) : (
        <>
        <Stack spacing={1.5} role="radiogroup" aria-label="Courses">
          {available.map((c) => {
            const selected = picked === c.id;
            return (
              <Card
                key={c.id}
                sx={{
                  borderColor: selected ? "primary.main" : "divider",
                  borderWidth: selected ? 2 : 1,
                  bgcolor: selected ? "rgba(14,34,80,0.04)" : "background.paper",
                }}
              >
                <CardActionArea role="radio" aria-checked={selected} onClick={() => setPickedId(c.id)} onDoubleClick={go}>
                  <CardContent sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="subtitle1">{c.code}: {c.title}</Typography>
                      <Typography variant="body2" color="text.secondary">{c.term}</Typography>
                    </Box>
                    {assignment?.discipline && <Chip size="small" label={disciplineLabel[assignment.discipline]} />}
                    <Chip size="small" variant="outlined" label={c.status} />
                    {selected && <CheckCircleRounded color="primary" aria-hidden />}
                  </CardContent>
                </CardActionArea>
              </Card>
            );
          })}
          {error && (
            <Typography color="error">{error.message}</Typography>
          )}
          {loading && <Typography color="text.secondary">Loading your courses…</Typography>}
          {!loading && available.length === 0 && (
            <Typography color="text.secondary">
              You aren't on any course roster yet. Ask your instructor to add you.
            </Typography>
          )}
        </Stack>

        <Button variant="contained" size="large" sx={{ mt: 3 }} disabled={!picked} onClick={go}>
          {picked ? "Open course" : "Select a course to continue"}
        </Button>
        </>
        )}
      </Box>
    </Box>
  );
}
