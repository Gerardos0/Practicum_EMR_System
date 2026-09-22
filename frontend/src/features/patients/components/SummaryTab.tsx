import type { ReactNode } from "react";
import { Alert, Box, Button, Paper, Stack, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import type { ClinicalNote, EncounterStatus, Patient } from "../../../types";
import { useSession } from "../../auth/AuthContext";
import { can } from "../../../utils/permissions";
import { formatDate } from "../../../utils/format";
import NotesList from "../../encounters/components/NotesList";

const FLOW: EncounterStatus[] = ["Scheduled", "Checked in", "In progress", "Checked out"];
const ADVANCE_LABEL: Partial<Record<EncounterStatus, string>> = {
  "Checked in": "Check in",
  "In progress": "Start visit",
  "Checked out": "Check out",
};

interface Props {
  patient: Patient;
  notes: ClinicalNote[];
  onAdvance: (next: EncounterStatus) => Promise<void>;
}

export default function SummaryTab({ patient: p, notes, onAdvance }: Props) {
  const navigate = useNavigate();
  const { user, activeRole } = useSession();
  const isAuthor = can(activeRole, "note:author");

  const idx = FLOW.indexOf(p.status.encounter);
  const next = idx >= 0 && idx < FLOW.length - 1 ? FLOW[idx + 1] : undefined;
  const needsCosign = next === "Checked out" && p.mode === "assessment" && !notes.some((n) => n.status === "cosigned");

  const mine = notes.filter((n) => n.authorId === user.id);
  const openNote = mine.find((n) => n.status === "draft" || n.status === "returned");
  const submitted = p.mode === "assessment" && mine.some((n) => n.status === "pending_review" || n.status === "cosigned");

  const noteButton = !isAuthor ? null : openNote ? (
    <Button variant="contained" onClick={() => navigate(`/patients/${p.id}/notes/${openNote.id}`)}>
      {openNote.status === "returned" ? "Revise returned note" : "Continue note"}
    </Button>
  ) : !submitted ? (
    <Button variant="contained" onClick={() => navigate(`/patients/${p.id}/notes/new`)}>Start note</Button>
  ) : null;

  return (
    <Box sx={{ display: "grid", gap: 2.5, gridTemplateColumns: { xs: "1fr", lg: "360px 1fr" }, alignItems: "start" }}>
      <Stack spacing={2}>
        <Card title="Problem list">
          {p.problems.map((pr) => (
            <Typography key={pr.description} variant="body2">
              {pr.code && <b>{pr.code} </b>}{pr.description}{pr.since && <Typography component="span" variant="body2" color="text.secondary"> since {pr.since}</Typography>}
            </Typography>
          ))}
        </Card>
        <Card title="Medications">
          {p.medications.map((m) => (
            <Typography key={m.id} variant="body2">{m.name} {m.dose} {m.route}, {m.frequency.toLowerCase()}</Typography>
          ))}
        </Card>
        <Card title="Vitals today">
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr auto", rowGap: 0.25 }}>
            {p.vitals.map((v) => (
              <Box key={v.label} sx={{ display: "contents" }}>
                <Typography variant="body2">{v.label}</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, textAlign: "right" }}>{v.value}</Typography>
              </Box>
            ))}
          </Box>
        </Card>
        <Card title="Recent labs">
          {p.labs.length === 0 && <Typography variant="body2" color="text.secondary">None on file</Typography>}
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr auto", rowGap: 0.25 }}>
            {p.labs.map((l) => (
              <Box key={l.id} sx={{ display: "contents" }}>
                <Typography variant="body2">{l.name}</Typography>
                <Typography variant="body2" sx={{ textAlign: "right", fontWeight: l.flag ? 700 : 400, color: l.flag ? "error.main" : undefined }}>
                  {l.value} {l.unit}{l.flag ? ` ${l.flag}` : ""}
                </Typography>
              </Box>
            ))}
          </Box>
        </Card>
      </Stack>

      <Stack spacing={2}>
        <Paper sx={{ p: 2.5 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap", mb: 2 }}>
            <Box sx={{ flex: 1, minWidth: 200 }}>
              <Typography component="h2" variant="h6">{p.encounter.type}</Typography>
              <Typography variant="body2" color="text.secondary">{formatDate(p.encounter.date)}, visit status: {p.status.encounter}</Typography>
            </Box>
            {next && can(activeRole, "encounter:advance") && (
              <Button variant="outlined" disabled={needsCosign} onClick={() => onAdvance(next)}>
                {ADVANCE_LABEL[next]}
              </Button>
            )}
            {noteButton}
          </Box>
          {needsCosign && isAuthor && (
            <Alert severity="info" sx={{ mb: 2 }}>You can check the patient out once your instructor co-signs your note.</Alert>
          )}
          <Typography variant="subtitle2">Chief complaint</Typography>
          <Typography variant="body2" sx={{ mb: 1.5 }}>{p.chiefComplaint}</Typography>
          <Typography variant="subtitle2">History of present illness</Typography>
          <Typography variant="body2" sx={{ mb: 1.5, maxWidth: "75ch" }}>{p.hpi}</Typography>
          <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { md: "repeat(3, 1fr)" } }}>
            <Detail label="Family history" value={p.familyHistory} />
            <Detail label="Surgical history" value={p.surgicalHistory} />
            <Detail label="Social history" value={p.socialHistory} />
          </Box>
        </Paper>

        <Paper sx={{ p: 2.5 }}>
          <Typography component="h2" variant="h6" sx={{ mb: 1.5 }}>Notes on this encounter</Typography>
          <NotesList notes={notes} patientId={p.id} reviewer={!isAuthor} emptyAction={noteButton} />
        </Paper>
      </Stack>
    </Box>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Paper sx={{ p: 2 }}>
      <Typography component="h2" variant="subtitle2" sx={{ mb: 1 }}>{title}</Typography>
      {children}
    </Paper>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography variant="subtitle2">{label}</Typography>
      <Typography variant="body2">{value}</Typography>
    </Box>
  );
}
