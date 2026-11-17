import { Box, Typography } from "@mui/material";
import { useSession } from "../auth/useSession";
import { useAsync } from "../../utils/useAsync";
import { mySimLabAssignments, type SimLabAssignment } from "../../api/simLab";
import { utep } from "../../theme/tokens";

function studentLine(row: SimLabAssignment) {
  const parts = [`Room ${row.room.number}`];
  if (row.bed) parts.push(`Bed ${row.bed}`);
  if (row.timeBlock) parts.push(row.timeBlock);
  return `Your bed · ${parts.join(" · ")}`;
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Quiet strip when a student has a lab room for today. Hidden otherwise. */
export default function LabAssignmentStrip() {
  const { activeRole, courseId } = useSession();
  const day = todayISO();

  const mine = useAsync(
    () => (activeRole === "student" && courseId
      ? mySimLabAssignments(courseId, activeRole, day)
      : Promise.resolve([])),
    [activeRole, courseId, day],
  );

  const row = mine.data?.[0];
  if (activeRole !== "student" || !courseId || !row) return null;

  const text = studentLine(row);

  return (
    <Box
      sx={{
        mb: 2,
        border: `1px solid ${utep.line}`,
        borderRadius: 1.5,
        bgcolor: utep.paper,
        px: { xs: 1.5, md: 2 },
        py: 1,
      }}
    >
      <Typography sx={{ color: utep.ink2, fontSize: 13, fontWeight: 600 }}>
        {text}
      </Typography>
    </Box>
  );
}
