import type { ReactNode } from "react";
import { Box } from "@mui/material";
import { utep } from "../theme/tokens";

export interface CountTabItem {
  id: string;
  label: string;
  count: number;
}

interface Props {
  tabs: CountTabItem[];
  value: string;
  onChange: (id: string) => void;
  ariaLabel: string;
  action?: ReactNode;
  idPrefix?: string;
  panelId?: string;
}

export default function CountTabs({
  tabs, value, onChange, ariaLabel, action, idPrefix = "count-tab", panelId,
}: Props) {
  return (
    <Box
      sx={{
        display: "flex", alignItems: "stretch", gap: 0.5, px: 1, pt: 1,
        bgcolor: utep.navy, flexWrap: "nowrap",
      }}
    >
      <Box
        role="tablist"
        aria-label={ariaLabel}
        sx={{
          display: "flex", flexWrap: "nowrap", gap: 0.5, flex: "1 1 auto", minWidth: 0,
          overflowX: "auto", scrollbarWidth: "thin",
        }}
        onKeyDown={(e) => {
          const index = Math.max(0, tabs.findIndex((tab) => tab.id === value));
          if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
          e.preventDefault();
          const step = e.key === "ArrowRight" ? 1 : -1;
          const next = tabs[(index + step + tabs.length) % tabs.length];
          onChange(next.id);
          document.getElementById(`${idPrefix}-${next.id}`)?.focus();
        }}
      >
        {tabs.map((tab) => {
          const selected = tab.id === value;
          return (
            <Box
              key={tab.id}
              component="button"
              type="button"
              role="tab"
              id={`${idPrefix}-${tab.id}`}
              aria-selected={selected}
              aria-controls={panelId}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(tab.id)}
              sx={{
                border: "none",
                cursor: "pointer",
                fontFamily: "inherit",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                gap: 1,
                px: 1.75,
                py: 1.1,
                borderRadius: "12px 12px 0 0",
                fontWeight: 800,
                fontSize: 15,
                color: selected ? utep.navy : "#fff",
                bgcolor: selected ? "#fff" : "transparent",
                "&:hover": { bgcolor: selected ? "#fff" : "rgba(255,255,255,0.08)" },
                "&:focus-visible": { outline: `3px solid ${utep.orange}`, outlineOffset: -2 },
              }}
            >
              {tab.label}
              <Box
                component="span"
                sx={{
                  minWidth: 24, height: 24, px: 0.75, borderRadius: "999px",
                  display: "grid", placeItems: "center",
                  fontSize: 13, fontWeight: 800,
                  bgcolor: selected ? utep.orange : "#fff",
                  color: utep.navy,
                }}
              >
                {tab.count}
              </Box>
            </Box>
          );
        })}
      </Box>
      {action && (
        <Box sx={{ alignSelf: "center", flexShrink: 0, mb: 1, mr: 0.5, display: "flex", alignItems: "center" }}>
          {action}
        </Box>
      )}
    </Box>
  );
}
