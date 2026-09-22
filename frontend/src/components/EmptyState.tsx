import type { ReactNode } from "react";
import { Box, Typography } from "@mui/material";

export default function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <Box sx={{ border: "1px dashed", borderColor: "divider", borderRadius: 1, p: 4, textAlign: "center" }}>
      <Typography variant="subtitle1">{title}</Typography>
      {children && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{children}</Typography>}
      {action && <Box sx={{ mt: 2 }}>{action}</Box>}
    </Box>
  );
}
