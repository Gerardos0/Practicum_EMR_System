import { useState } from "react";
import { Box, Button, Stack, TextField, Typography } from "@mui/material";
import type { Addendum } from "../../../types";
import { formatDateTime } from "../../../utils/format";

interface Props {
  items: Addendum[];
  onAdd?: (body: string) => Promise<void>;
}

/** Signed notes are immutable. Corrections are appended, never overwritten. */
export default function Addenda({ items, onAdd }: Props) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <Box>
      <Typography component="h3" variant="h6" sx={{ mb: 1 }}>Addenda</Typography>
      {items.length === 0 && <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>None.</Typography>}
      <Stack spacing={1.5} sx={{ mb: 2 }}>
        {items.map((a) => (
          <Box key={a.id}>
            <Typography variant="caption" color="text.secondary">{a.authorName}, {formatDateTime(a.createdAt)}</Typography>
            <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>{a.body}</Typography>
          </Box>
        ))}
      </Stack>
      {onAdd && (
        <Stack spacing={1} sx={{ alignItems: "flex-start" }}>
          <TextField
            label="New addendum" multiline minRows={2} fullWidth value={body} onChange={(e) => setBody(e.target.value)}
            helperText="Use an addendum to correct or add to a signed note. The original stays as signed."
          />
          <Button
            variant="outlined" disabled={busy || body.trim().length === 0}
            onClick={async () => { setBusy(true); await onAdd(body); setBody(""); setBusy(false); }}
          >
            Add addendum
          </Button>
        </Stack>
      )}
    </Box>
  );
}
