import { Alert, Box, List, ListItem, ListItemText, Typography } from "@mui/material";
import type { GradingGuide } from "../../../types";

export default function CourseRubricPanel({ guide, fileName }: { guide?: GradingGuide | null; fileName?: string | null }) {
  const criteria = guide?.criteria ?? [];
  if (criteria.length > 0) {
    return (
      <Box sx={{ mt: 1.5, p: 1.5, borderRadius: 1, border: 1, borderColor: "divider", bgcolor: "rgba(14,34,80,0.03)" }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Course rubric</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
          {guide?.file_name || fileName}
        </Typography>
        <List dense disablePadding>
          {criteria.map((item) => (
            <ListItem key={item.id} alignItems="flex-start" sx={{ px: 0, py: 0.5 }}>
              <ListItemText
                primary={<Typography variant="body2" sx={{ fontWeight: 700 }}>{item.label}{item.max_points ? ` (${item.max_points} points)` : ""}</Typography>}
                secondary={item.detail ? <Typography variant="caption" color="text.secondary">{item.detail}</Typography> : undefined}
              />
            </ListItem>
          ))}
        </List>
      </Box>
    );
  }
  if (fileName) {
    return (
      <Alert severity="info" icon={false} sx={{ mt: 1.5 }}>
        {fileName} is on file for this course. It has not been converted into scoring criteria. Upload the PDF or Word file again, with a heading or numbered line for each criterion.
      </Alert>
    );
  }
  return null;
}
