import { Box, Stack, Typography } from "@mui/material";
import type { NoteComment } from "../../../types";
import { formatDateTime } from "../../../utils/format";

const KIND_LABEL: Record<NoteComment["kind"], string> = {
  returned: "Returned for revision",
  cosigned: "Co-signed",
  comment: "Comment",
};

export default function FeedbackThread({ items }: { items: NoteComment[] }) {
  if (items.length === 0) return null;
  return (
    <Stack spacing={1.5}>
      {items.map((c) => (
        <Box key={c.id} sx={{ borderLeft: 3, borderColor: c.kind === "returned" ? "error.main" : "success.main", pl: 1.5 }}>
          <Typography variant="caption" color="text.secondary">
            {KIND_LABEL[c.kind]} by {c.authorName}, {formatDateTime(c.createdAt)}
          </Typography>
          <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>{c.body}</Typography>
        </Box>
      ))}
    </Stack>
  );
}
