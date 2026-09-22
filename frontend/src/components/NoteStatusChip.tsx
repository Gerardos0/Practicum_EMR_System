import { Chip } from "@mui/material";
import type { NoteStatus } from "../types";
import { noteStatusColor, noteStatusLabel } from "../utils/labels";

export default function NoteStatusChip({ status }: { status?: NoteStatus }) {
  if (!status) return <Chip size="small" label="Not started" variant="outlined" />;
  return <Chip size="small" label={noteStatusLabel[status]} color={noteStatusColor[status]} variant={status === "draft" ? "outlined" : "filled"} />;
}
