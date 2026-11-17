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

function placeName(spot: LabBedSpot, room: SimLabRoom) {
  return room.bedCount <= 1 ? `Room ${spot.room}` : `Room ${spot.room}, bed ${spot.bed}`;
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
        const place = placeName(spot, room);
        const title = reserved
          ? `${place}, reserved for ${people.map((row) => row.studentName).join(", ")}`
          : place;
        const showLetter = !reserved && room.bedCount > 1;
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
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              p: 0,
              m: 0,
              borderRadius: "1px",
              border: reserved ? `1.5px solid ${utep.navy}` : `1.5px solid ${utep.orange}`,
              bgcolor: reserved ? "rgba(14, 34, 80, 0.78)" : "rgba(238, 139, 60, 0.22)",
              color: utep.navy,
              fontSize: 9,
              fontWeight: 700,
              lineHeight: 1,
              textAlign: "center",
              overflow: "hidden",
              cursor: reserved ? "not-allowed" : "pointer",
              "&:hover": reserved ? undefined : { bgcolor: "rgba(238, 139, 60, 0.72)" },
              "&:disabled": { opacity: 1 },
            }}
          >
            {showLetter ? spot.bed : ""}
          </Box>
        );
      })}
    </Box>
  );
}
