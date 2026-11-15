import { Box, Typography } from "@mui/material";
import { utep } from "../../theme/tokens";
import type { SimLabRoom } from "../../api/simLab";

interface Props {
  rooms: SimLabRoom[];
  highlightNumber?: string | null;
  compact?: boolean;
  onSelectRoom?: (room: SimLabRoom) => void;
  selectedId?: string | null;
}

export default function LabFloorMap({
  rooms, highlightNumber, compact, onSelectRoom, selectedId,
}: Props) {
  const height = compact ? 120 : 220;
  return (
    <Box
      role="img"
      aria-label={
        highlightNumber
          ? `Sim Center map. Your room is ${highlightNumber}.`
          : "Sim Center floor map"
      }
      sx={{
        width: "100%",
        maxWidth: compact ? 280 : 560,
        border: `1px solid ${utep.line}`,
        borderRadius: 1.5,
        bgcolor: utep.page,
        overflow: "hidden",
      }}
    >
      <svg viewBox="0 0 100 100" width="100%" height={height} style={{ display: "block" }}>
        <rect x="0" y="0" width="100" height="100" fill={utep.page} />
        <rect x="2" y="2" width="96" height="96" fill="none" stroke={utep.line} strokeWidth="0.6" rx="1" />
        {rooms.map((room) => {
          const mine = highlightNumber === room.number;
          const selected = selectedId === room.id;
          const fill = mine ? utep.orangeSoft : selected ? "#E8EEF7" : utep.paper;
          const stroke = mine || selected ? utep.orange : utep.line;
          return (
            <g
              key={room.id}
              style={{ cursor: onSelectRoom ? "pointer" : "default" }}
              onClick={() => onSelectRoom?.(room)}
            >
              <rect
                x={room.mapX}
                y={room.mapY}
                width={room.mapW}
                height={room.mapH}
                fill={fill}
                stroke={stroke}
                strokeWidth={mine || selected ? 1.2 : 0.5}
                rx="0.8"
              />
              <text
                x={room.mapX + room.mapW / 2}
                y={room.mapY + room.mapH / 2 + 1}
                textAnchor="middle"
                fontSize={compact ? 3.2 : 3.6}
                fontWeight={mine ? 700 : 600}
                fill={utep.navy}
              >
                {room.number}
              </text>
            </g>
          );
        })}
      </svg>
      {highlightNumber && (
        <Typography variant="caption" sx={{ display: "block", px: 1, py: 0.5, color: utep.ink2 }}>
          Your room: {highlightNumber}
        </Typography>
      )}
    </Box>
  );
}
