import { useEffect, useState } from "react";
import { Box, Button, LinearProgress, Tab, Tabs, Typography } from "@mui/material";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { getPatient, updatePatientStatus } from "../../api/patients";
import { recordPresence } from "../../api/chart";
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
import { simulationNoteAction } from "./simulation";
import ChartActivity from "./components/ChartActivity";
import VisitsTab from "./components/VisitsTab";

const TABS = [
  { id: "summary", label: "Overview" },
  { id: "visits", label: "Visits" },
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

  const patient = useAsync(() => getPatient(activeRole, patientId), [patientId, activeRole]);
  const notes = useAsync(() => listNotesForPatient(activeRole, patientId), [patientId, activeRole]);
  const heading = patient.data
    ? `${patient.data.lastName}, ${patient.data.firstName}`
    : "Patient chart";
  usePageHeading(heading);
  const chartId = patient.data?.id;

  useEffect(() => {
    if (!chartId) return;
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
  }, [chartId, patientId, activeRole]);

  if (patient.error) return <PageError error={patient.error} />;
  if (!patient.data) return <LinearProgress aria-label="Loading chart" />;
  const p = patient.data;
  const chartable = canChartPatient(activeRole, p, user.id);
  const isAuthor = can(activeRole, "note:author") && chartable;
  const mine = (notes.data ?? []).filter((n) => n.authorId === user.id);
  const openNote = mine.find((n) => n.status === "draft" || n.status === "returned");
  const simAction = p.mode === "simulation" ? simulationNoteAction(p, notes.data ?? [], user.id) : undefined;
  const noteAction = simAction !== undefined ? (simAction ? (
    <Button variant="contained" color="secondary" onClick={() => navigate(simAction.href)}>{simAction.label}</Button>
  ) : undefined) : !isAuthor ? undefined : (
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

      <Tabs
        value={tab}
        onChange={(_, next: TabId) => setParams({ tab: next }, { replace: true })}
        variant="scrollable"
        scrollButtons="auto"
        aria-label="Chart sections"
        sx={{
          mt: 2,
          mb: 2,
          minHeight: 44,
          borderBottom: `1px solid ${utep.lineSoft}`,
          "& .MuiTab-root": { minHeight: 44, px: 1.75 },
        }}
      >
        {visibleTabs.map((t) => (
          <Tab
            key={t.id}
            value={t.id}
            label={t.id === "notes" && notes.data ? `${t.label} (${notes.data.length})` : t.label}
          />
        ))}
      </Tabs>

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
        {tab === "visits" && (
          <VisitsTab patient={p} notes={notes.data ?? []} onChange={patient.setData} />
        )}
        {tab === "notes" && (
          <Box sx={{ py: 0.5 }}>
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
          </Box>
        )}
        {tab === "medications" && <MedicationsTab patient={p} onChange={patient.setData} />}
        {tab === "labs" && <LabsTab patient={p} onChange={patient.setData} />}
        {tab === "appointments" && <SchedulingTab patient={p} section="appointments" />}
        {tab === "referrals" && <SchedulingTab patient={p} section="referrals" />}
        {tab === "activity" && activeRole === "admin" && <ChartActivity patientId={p.id} />}
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
