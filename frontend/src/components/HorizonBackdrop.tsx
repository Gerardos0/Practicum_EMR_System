import { Box } from "@mui/material";
import { fontFamily } from "../../utepGlass";

/**
 * MyUTEP-style backdrop: orange top band, white page,
 * and flat EMR illustrations framing the login card.
 * Purely decorative — sits behind the page content.
 */
export default function HorizonBackdrop() {
  return (
    <Box
      aria-hidden
      sx={{
        position: "absolute",
        inset: 0,
        zIndex: -1,
        overflow: "hidden",
        pointerEvents: "none",
        background: "#FFFFFF",
      }}
    >
      {/* Orange top band */}
      <Box
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 64,
          display: "flex",
          alignItems: "center",
          px: 3.5,
          background: "linear-gradient(90deg, #EE8B3C, #F2A15B)",
          color: "#0E2250",
          fontFamily,
          fontWeight: 800,
          fontSize: 18,
          letterSpacing: "-0.01em",
        }}
      >
        UTEP EMR
      </Box>

      {/* Flat illustrations, hidden on small screens */}
      
    </Box>
  );
}