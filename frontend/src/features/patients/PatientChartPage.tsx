import { useEffect, useState } from "react";
import { Alert, Box, Button, LinearProgress, Paper, Typography } from "@mui/material";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { getPatient, updatePatientStatus } from "../../api/patients";
import { recordPresence, updatePlacement } from "../../api/chart";
import { listNotesForPatient } from "../../api/notes";
import { useSession } from "../auth/useSession";
import { can } from "../../utils/permissions";
import { canChartPatient } from "../chart/access";
import { useAsync } from "../../utils/useAsync";
import { utep } from "../../theme/tokens";
import PageError from "../../components/PageError";
import { usePageHeading } from "../../components/usePageHeading";
import BackLink from "../../components/BackLink";
import PatientBanner from "./components/PatientBanner";
import StatusDialog from "./components/StatusDialog";
import SummaryTab from "./components/SummaryTab";
import NotesList from "../encounters/components/NotesList";
import MedicationsTab from "../medications/MedicationsTab";
import LabsTab from "../labs/LabsTab";
import SchedulingTab from "../scheduling/SchedulingTab";
import ChartActivity from "./components/ChartActivity";

const TABS = [
  { id: "summary", label: "Overview" },
  { id: "labs", label: "Labs" },
  { id: "medications", label: "Medications" },
  { id: "notes", label: "Notes" },
  { id: "appointments", label: "Appointments" },
  { id: "referrals", label: "Referrals" },
  { id: "activity", label: "Activity" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export default function PatientChartPage() {
  const { patientId = "" } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { user, activeRole } = useSession();
  const visibleTabs = TABS.filter((item) => item.id !== "activity" || activeRole === "admin");
  const tab = (visibleTabs.find((item) => item.id === params.get("tab"))?.id ?? "summary") as TabId;
  const [statusOpen, setStatusOpen] = useState(false);
  const [placement, setPlacement] = useState({ unit: "", room: "", bed: "" });

  const patient = useAsync(() => getPatient(activeRole, patientId), [patientId, activeRole]);
  const notes = useAsync(() => listNotesForPatient(activeRole, patientId), [patientId, activeRole]);
  const heading = patient.data
    ? `${patient.data.lastName}, ${patient.data.firstName}`
    : "Patient chart";
  usePageHeading(heading);

  useEffect(() => {
    if (!patient.data) return;
    let lastInput = Date.now();
    const mark = () => { lastInput = Date.now(); };
    window.addEventListener("pointerdown", mark);
    window.addEventListener("pointermove", mark);
    window.addEventListener("keydown", mark);
    const beat = () => {
      const active = document.visibilityState === "visible" && Date.now() - lastInput < 60_000;
      if (!active) return;
      recordPresence(activeRole, patientId).catch(() => undefined);
    };
    beat();
    const timer = window.setInterval(beat, 25_000);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("pointerdown", mark);
      window.removeEventListener("pointermove", mark);
      window.removeEventListener("keydown", mark);
    };
  }, [patient.data?.id, patientId, activeRole]);

  if (patient.error) return <PageError error={patient.error} />;
  if (!patient.data) return <LinearProgress aria-label="Loading chart" />;
  const p = patient.data;
  const chartable = canChartPatient(activeRole, p, user.id);
  const isAuthor = can(activeRole, "note:author") && chartable;
  const mine = (notes.data ?? []).filter((n) => n.authorId === user.id);
  const openNote = mine.find((n) => n.status === "draft" || n.status === "returned");
  const noteAction = !isAuthor ? undefined : (
    <Button
      variant="contained"
      color="secondary"
      onClick={() => navigate(openNote ? `/patients/${p.id}/notes/${openNote.id}` : `/patients/${p.id}/notes/new`)}
    >
      {openNote ? (openNote.status === "returned" ? "Revise returned note" : "Continue note") : "Start note"}
    </Button>
  );

  return (
    <Box>
      <Box sx={{ mb: 2 }}>
        <BackLink
          to={activeRole === "admin" ? "/admin" : "/patients"}
          label={activeRole === "admin" ? "Return to administration" : "Return to patients"}
        />
      </Box>

      <PatientBanner
        patient={p}
        onEditStatus={can(activeRole, "patient:update_status") ? () => setStatusOpen(true) : undefined}
      />

      {!chartable && (
        <Alert severity="info" sx={{ mt: 2 }}>
          View only. You can review this chart. Only the assigned student can change it or write the note.
        </Alert>
      )}

      {can(activeRole, "patient:update_status") && (
        <Paper sx={{ p: 2, my: 2, display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
          <Typography variant="subtitle2" sx={{ mr: 1 }}>Bed assignment</Typography>
          <input aria-label="Unit" placeholder={p.unit || "Unit"} value={placement.unit} onChange={(e) => setPlacement({ ...placement, unit: e.target.value })} />
          <input aria-label="Room" placeholder={p.room || "Room"} value={placement.room} onChange={(e) => setPlacement({ ...placement, room: e.target.value })} />
          <input aria-label="Bed" placeholder={p.bed || "Bed"} value={placement.bed} onChange={(e) => setPlacement({ ...placement, bed: e.target.value })} />
          <Button size="small" onClick={async () => patient.setData(await updatePlacement(activeRole, p.id, placement))}>Save placement</Button>
        </Paper>
      )}

      <Box sx={{ display: "grid", gap: 2, mt: 2, gridTemplateColumns: { xs: "1fr", md: "180px minmax(0, 1fr)" }, alignItems: "start" }}>
      <Box
        role="tablist"
        aria-label="Chart sections"
        sx={{ display: "flex", gap: 0.75, flexDirection: { xs: "row", md: "column" }, flexWrap: "wrap" }}
      >
        {visibleTabs.map((t) => {
          const selected = tab === t.id;
          const label = t.id === "notes" && notes.data ? `${t.label} (${notes.data.length})` : t.label;
          return (
            <Box
              key={t.id}
              component="button"
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setParams({ tab: t.id }, { replace: true })}
              sx={{
                border: "none",
                cursor: "pointer",
                px: 1.75,
                py: 1,
                borderRadius: "999px",
                fontWeight: 700,
                fontSize: 14,
                fontFamily: "inherit",
                bgcolor: selected ? utep.navy : "#fff",
                color: selected ? "#fff" : utep.navy,
                boxShadow: selected ? "none" : `inset 0 0 0 1px ${utep.line}`,
                "&:focus-visible": { outline: `3px solid ${utep.orange}`, outlineOffset: 2 },
              }}
            >
              {label}
            </Box>
          );
        })}
      </Box>

      <Box role="tabpanel" aria-label={TABS.find((t) => t.id === tab)?.label}>
        {tab === "summary" && (
          <SummaryTab
            patient={p}
            notes={notes.data ?? []}
            onChange={patient.setData}
            onAdvance={async (next) => {
              patient.setData(await updatePatientStatus(activeRole, p.id, { encounter: next }));
            }}
          />
        )}
        {tab === "notes" && (
          <Paper sx={{ p: 2.5, borderRadius: "16px" }}>
            {notes.loading ? (
              <LinearProgress aria-label="Loading notes" />
            ) : (
              <NotesList
                notes={notes.data ?? []}
                patientId={p.id}
                reviewer={!can(activeRole, "note:author")}
                emptyAction={noteAction}
                emptyBody={chartable ? undefined : "This chart is open for review. The note stays with the assigned student."}
              />
            )}
          </Paper>
        )}
        {tab === "medications" && <MedicationsTab patient={p} onChange={patient.setData} />}
        {tab === "labs" && <LabsTab patient={p} onChange={patient.setData} />}
        {tab === "appointments" && <SchedulingTab patient={p} section="appointments" />}
        {tab === "referrals" && <SchedulingTab patient={p} section="referrals" />}
        {tab === "activity" && activeRole === "admin" && <ChartActivity patientId={p.id} />}
      </Box>
      </Box>

      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2 }}>
        Opening this chart was recorded in the activity log.
      </Typography>

      {statusOpen && (
        <StatusDialog
          open patient={p} onClose={() => setStatusOpen(false)}
          onSave={async (status) => patient.setData(await updatePatientStatus(activeRole, p.id, status))}
        />
      )}
    </Box>
  );
}
