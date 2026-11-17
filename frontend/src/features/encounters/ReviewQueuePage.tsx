import { useEffect, useState } from "react";
import {
  Alert, Box, Button, LinearProgress, Paper,
} from "@mui/material";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { listReviewQueue } from "../../api/notes";
import { useSession } from "../auth/useSession";
import { formatDateTime } from "../../utils/format";
import { useAsync } from "../../utils/useAsync";
import NoteStatusChip from "../../components/NoteStatusChip";
import EmptyState from "../../components/EmptyState";
import PageError from "../../components/PageError";
import { usePageHeading } from "../../components/usePageHeading";
import CountTabs from "../../components/CountTabs";
import CensusRow, { nameInitials } from "../../components/CensusRow";
import { templateName } from "./noteTemplates";
import type { NoteStatus } from "../../types";

const FILTERS: { id: NoteStatus | "all"; label: string }[] = [
  { id: "pending_review", label: "Needs review" },
  { id: "returned", label: "Returned" },
  { id: "cosigned", label: "Co-signed" },
  { id: "all", label: "All" },
];

const QUEUE_STATUSES = new Set<NoteStatus>(["pending_review", "returned", "cosigned"]);

function tabFromSearch(value: string | null): NoteStatus | "all" {
  if (value === "all" || value === "returned" || value === "cosigned" || value === "pending_review") return value;
  return "pending_review";
}

export default function ReviewQueuePage() {
  usePageHeading("Review queue");
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const { activeRole, courseId } = useSession();
  const incoming = (location.state as { flash?: string } | null)?.flash ?? "";
  const [flash, setFlash] = useState("");
  const [seenFlash, setSeenFlash] = useState("");
  if (incoming && incoming !== seenFlash) {
    setSeenFlash(incoming);
    setFlash(incoming);
  }
  const filter = tabFromSearch(params.get("status"));
  const queue = useAsync(() => listReviewQueue(courseId, activeRole), [courseId, activeRole]);

  useEffect(() => {
    if (!incoming) return;
    navigate(".", { replace: true, state: null });
  }, [incoming, navigate]);

  const rows = (queue.data ?? []).filter((q) => QUEUE_STATUSES.has(q.note.status));
  const items = rows.filter((q) => filter === "all" || q.note.status === filter);
  const count = (s: NoteStatus | "all") =>
    s === "all" ? rows.length : rows.filter((q) => q.note.status === s).length;

  if (queue.error) return <PageError error={queue.error} />;

  return (
    <Box>
      {flash && (
        <Alert severity="success" onClose={() => setFlash("")} sx={{ mb: 2 }}>{flash}</Alert>
      )}

      <Paper sx={{ overflow: "hidden", borderRadius: "16px" }}>
        <CountTabs
          ariaLabel="Review status"
          idPrefix="review-tab"
          panelId="review-panel"
          value={filter}
          onChange={(id) => setParams({ status: id }, { replace: true })}
          tabs={FILTERS.map((item) => ({ id: item.id, label: item.label, count: count(item.id) }))}
        />
        <Box role="tabpanel" id="review-panel" aria-labelledby={`review-tab-${filter}`} sx={{ bgcolor: "#fff" }}>
          {queue.loading && !queue.data ? <LinearProgress aria-label="Loading review queue" /> : items.length === 0 ? (
            <Box sx={{ px: 2, py: 2.5 }}>
              <EmptyState title={filter === "pending_review" ? "You're caught up" : "Nothing here"}>
                {filter === "pending_review"
                  ? "New submissions appear here as students sign their notes."
                  : "Try another tab to see returned or co-signed notes."}
              </EmptyState>
            </Box>
          ) : (
            <Box component="ul" aria-label="Notes" sx={{ listStyle: "none", m: 0, p: 0, containerType: "inline-size" }}>
              {items.map(({ note, patient }) => {
                const open = () => navigate(`/review/${note.id}`);
                return (
                  <CensusRow
                    key={note.id}
                    initials={nameInitials(note.authorName)}
                    title={note.authorName}
                    meta={`${patient.lastName}, ${patient.firstName}`}
                    primary={templateName(note.templateId)}
                    secondary={note.signedAt ? formatDateTime(note.signedAt) : "Not signed"}
                    onOpen={open}
                    ariaLabel={`Review note by ${note.authorName}`}
                    note={<NoteStatusChip status={note.status} />}
                    actions={(
                      <Button
                        size="small"
                        variant={note.status === "pending_review" ? "contained" : "outlined"}
                        color={note.status === "pending_review" ? "secondary" : "primary"}
                        onClick={open}
                      >
                        {note.status === "pending_review" ? "Review" : "Open"}
                      </Button>
                    )}
                  />
                );
              })}
            </Box>
          )}
        </Box>
      </Paper>
    </Box>
  );
}
