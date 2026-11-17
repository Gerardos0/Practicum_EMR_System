import type { ReactNode } from "react";
import { Box, Typography } from "@mui/material";
import { utep } from "../theme/tokens";

const WIDE = "@container (min-width: 720px)";

interface Props {
  initials: string;
  title: string;
  meta?: string;
  primary?: string;
  secondary?: string;
  highlight?: boolean;
  onOpen?: () => void;
  ariaLabel: string;
  note?: ReactNode;
  actions?: ReactNode;
  wrap?: boolean;
}

export default function CensusRow({
  initials, title, meta, primary, secondary, highlight = false, onOpen, ariaLabel, note, actions, wrap = false,
}: Props) {
  const hasNote = note != null;
  const hasEnd = hasNote || actions != null;

  return (
    <Box
      component="li"
      sx={{
        display: "grid",
        gridTemplateColumns: hasEnd ? "44px minmax(0, 1fr) auto" : "44px minmax(0, 1fr)",
        gridTemplateAreas: hasEnd
          ? `"avatar name actions" "avatar detail detail"`
          : `"avatar name" "avatar detail"`,
        columnGap: 1.5,
        rowGap: 0.35,
        alignItems: "start",
        px: { xs: 1.5, sm: 2 },
        py: 1.25,
        borderTop: `1px solid ${utep.line}`,
        bgcolor: highlight ? utep.orangeSoft : "#fff",
        "&:hover": { bgcolor: highlight ? "#FBE4CF" : "#F7F8FB" },
        [WIDE]: {
          alignItems: "center",
          gridTemplateColumns: hasNote
            ? "44px minmax(160px, 240px) minmax(0, 1.4fr) minmax(110px, 180px) auto"
            : hasEnd
              ? "44px minmax(160px, 240px) minmax(0, 1.6fr) auto"
              : "44px minmax(180px, 280px) minmax(0, 1fr)",
          gridTemplateAreas: hasNote
            ? `"avatar name detail note actions"`
            : hasEnd
              ? `"avatar name detail actions"`
              : `"avatar name detail"`,
        },
      }}
    >
      <Box
        aria-hidden
        sx={{
          gridArea: "avatar",
          mt: 0.25,
          width: 44, height: 44, borderRadius: "12px",
          bgcolor: utep.navy, color: "#fff",
          display: "grid", placeItems: "center",
          fontWeight: 800, fontSize: 15,
          [WIDE]: { mt: 0 },
        }}
      >
        {initials}
      </Box>

      {onOpen ? (
        <Box
          component="button"
          type="button"
          onClick={onOpen}
          aria-label={ariaLabel}
          sx={{ ...nameButtonSx, gridArea: "name" }}
        >
          <NameLines title={title} meta={meta} />
        </Box>
      ) : (
        <Box sx={{ gridArea: "name", minWidth: 0 }}>
          <NameLines title={title} meta={meta} />
        </Box>
      )}

      <Box
        sx={{ gridArea: "detail", minWidth: 0, cursor: onOpen ? "pointer" : "default" }}
        onClick={onOpen}
      >
        {primary && (
          <Typography sx={{ fontWeight: 700, color: utep.ink, fontSize: 14 }} noWrap={!wrap} title={wrap ? undefined : primary}>
            {primary}
          </Typography>
        )}
        {secondary && (
          <Typography variant="body2" color="text.secondary" noWrap={!wrap} title={wrap ? undefined : secondary}>
            {secondary}
          </Typography>
        )}
      </Box>

      {hasNote && (
        <Box sx={{ gridArea: "note", display: "none", [WIDE]: { display: "block" } }}>
          {note}
        </Box>
      )}

      {hasEnd && (
        <Box sx={{ gridArea: "actions", display: "flex", alignItems: "center", gap: 0.5, justifyContent: "flex-end", alignSelf: "center" }}>
          {hasNote && (
            <Box sx={{ mr: 0.5, [WIDE]: { display: "none" } }}>{note}</Box>
          )}
          {actions}
        </Box>
      )}
    </Box>
  );
}

function NameLines({ title, meta }: { title: string; meta?: string }) {
  return (
    <>
      <Typography noWrap sx={{ fontWeight: 800, color: utep.navy, fontSize: 16, lineHeight: 1.2 }}>
        {title}
      </Typography>
      {meta && (
        <Typography noWrap variant="body2" color="text.secondary">{meta}</Typography>
      )}
    </>
  );
}

const nameButtonSx = {
  border: "none",
  background: "none",
  padding: 0,
  margin: 0,
  textAlign: "left",
  cursor: "pointer",
  fontFamily: "inherit",
  minWidth: 0,
  width: "100%",
  "&:focus-visible": { outline: `3px solid ${utep.orange}`, outlineOffset: 2, borderRadius: "6px" },
} as const;
