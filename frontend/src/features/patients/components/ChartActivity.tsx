import { Box, LinearProgress, Paper, Typography } from "@mui/material";
import { listAudit } from "../../../api/audit";
import { useSession } from "../../auth/useSession";
import { useAsync } from "../../../utils/useAsync";
import { formatDateTime } from "../../../utils/format";
import PageError from "../../../components/PageError";
import CensusRow from "../../../components/CensusRow";
import { nameInitials } from "../../../components/census";

function recordLabel(entity: string) {
  if (entity.startsWith("patient/")) return "Chart";
  if (entity.startsWith("note/")) return "Note";
  if (entity.startsWith("medication_administration/")) return "Medication administration";
  return entity.replace(/[._]/g, " ");
}

export default function ChartActivity({ patientId }: { patientId: string }) {
  const { activeRole } = useSession();
  const audit = useAsync(() => listAudit(undefined, activeRole, patientId), [activeRole, patientId]);

  if (audit.error) return <PageError error={audit.error} />;

  const rows = audit.data ?? [];
  return (
    <Paper sx={{ overflow: "hidden", borderRadius: "16px" }}>
      {audit.loading && !audit.data ? <LinearProgress aria-label="Loading activity" /> : rows.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ p: 2.5 }}>
          Nothing has been recorded on this chart.
        </Typography>
      ) : (
        <Box component="ul" aria-label="Chart activity" sx={{ listStyle: "none", m: 0, p: 0, containerType: "inline-size" }}>
          {rows.map((event) => (
            <CensusRow
              key={event.id}
              initials={nameInitials(event.actorName)}
              title={event.actorName}
              meta={event.action.replace(/[._]/g, " ")}
              primary={event.detail || recordLabel(event.entity)}
              secondary={[formatDateTime(event.timestamp), event.result === "denied" ? "Denied" : "Allowed"].join(" · ")}
              ariaLabel={`${event.actorName} ${event.action}`}
              highlight={event.result === "denied"}
              wrap
            />
          ))}
        </Box>
      )}
    </Paper>
  );
}
