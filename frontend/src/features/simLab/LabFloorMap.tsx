import { Box } from "@mui/material";
import type { SimLabAssignment, SimLabRoom } from "../../api/simLab";
import { utep } from "../../theme/tokens";
import { LAB_BEDS, PLAN_H, PLAN_W, type LabBedSpot } from "./labBeds";

interface Props {
  rooms: SimLabRoom[];
  assignments: SimLabAssignment[];
  timeBlock: string;
  onPick: (roomId: string, bed: string) => void;
}

function holdsBed(row: SimLabAssignment, spot: LabBedSpot, bedCount: number) {
  if (row.room.number !== spot.room) return false;
  if (row.bed) return row.bed.toUpperCase() === spot.bed;
  return bedCount <= 1 && spot.bed === "A";
}

function isReserved(spot: LabBedSpot, room: SimLabRoom | undefined, rows: SimLabAssignment[], timeBlock: string) {
  const people = rows.filter((row) => holdsBed(row, spot, room?.bedCount ?? 1));
  if (people.length === 0) return false;
  if (!room || room.timing === "day") return true;
  if (!timeBlock) return true;
  return people.some((row) => !row.timeBlock || row.timeBlock === timeBlock);
}

function labelFor(spot: LabBedSpot, room: SimLabRoom | undefined, rows: SimLabAssignment[], timeBlock: string) {
  const people = rows.filter((row) => holdsBed(row, spot, room?.bedCount ?? 1));
  const shown = !room || room.timing === "day" || !timeBlock
    ? people
    : people.filter((row) => !row.timeBlock || row.timeBlock === timeBlock);
  if (shown.length === 0) return spot.bed;
  const name = shown[0].studentName;
  return name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

export default function LabFloorMap({ rooms, assignments, timeBlock, onPick }: Props) {
  const byNumber = new Map(rooms.map((room) => [room.number, room]));

  return (
    <Box
      sx={{
        position: "relative",
        width: "100%",
        maxWidth: 1024,
        border: `1px solid ${utep.line}`,
        borderRadius: 2,
        overflow: "hidden",
        bgcolor: utep.paper,
        lineHeight: 0,
      }}
    >
      <img
        src="/sim-center-plan.jpg"
        alt="Sim Center floor plan"
        style={{ width: "100%", height: "auto", display: "block" }}
      />
      {LAB_BEDS.map((spot) => {
        const room = byNumber.get(spot.room);
        if (!room) return null;
        const reserved = isReserved(spot, room, assignments, timeBlock);
        const people = assignments.filter((row) => holdsBed(row, spot, room.bedCount));
        const title = reserved
          ? `Room ${spot.room} bed ${spot.bed} reserved for ${people.map((row) => row.studentName).join(", ")}`
          : `Room ${spot.room} bed ${spot.bed}`;
        return (
          <Box
            key={`${spot.room}-${spot.bed}`}
            component="button"
            type="button"
            disabled={reserved}
            title={title}
            aria-label={title}
            onClick={() => onPick(room.id, spot.bed)}
            sx={{
              position: "absolute",
              left: `${(spot.x / PLAN_W) * 100}%`,
              top: `${(spot.y / PLAN_H) * 100}%`,
              width: `${(spot.w / PLAN_W) * 100}%`,
              height: `${(spot.h / PLAN_H) * 100}%`,
              p: 0,
              m: 0,
              borderRadius: "2px",
              border: reserved ? `2px solid ${utep.navy}` : `1.5px solid ${utep.orange}`,
              bgcolor: reserved ? "rgba(14, 34, 80, 0.82)" : "rgba(238, 139, 60, 0.28)",
              color: reserved ? "#fff" : utep.navy,
              fontSize: 10,
              fontWeight: 700,
              lineHeight: 1,
              cursor: reserved ? "not-allowed" : "pointer",
              "&:hover": reserved ? undefined : { bgcolor: "rgba(238, 139, 60, 0.72)" },
              "&:disabled": { opacity: 1 },
            }}
          >
            {labelFor(spot, room, assignments, timeBlock)}
          </Box>
        );
      })}
    </Box>
  );
}
