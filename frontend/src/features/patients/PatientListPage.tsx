import { useMemo, useState } from "react";
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
  LinearProgress, Paper,
} from "@mui/material";
import { Link as RouterLink, useNavigate, useSearchParams } from "react-router-dom";
import { listPatients, resetPracticePatient, unassignCase, type PatientRow } from "../../api/patients";
import { useSession } from "../auth/useSession";
import { can } from "../../utils/permissions";
import { useAsync } from "../../utils/useAsync";
import CountTabs from "../../components/CountTabs";
import EmptyState from "../../components/EmptyState";
import { usePageHeading } from "../../components/usePageHeading";
import AssignCaseDialog from "./components/AssignCaseDialog";
import StatusBoard from "./StatusBoard";
import TrackerRow from "./TrackerRow";
import { byPatientName, matchesPatientQuery } from "./tracker";
import { CASELOAD_VIEWS, caseloadViewMeta, matchesCaseload, parseCaseloadView, type CaseloadView } from "./caseload";

export default function PatientListPage() {
  const navigate = useNavigate();
  const { user, activeRole, courseId } = useSession();
  const isStudent = activeRole === "student";
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const view = isStudent ? parseCaseloadView(params.get("view")) : undefined;
  const viewMeta = view ? caseloadViewMeta(view) : undefined;
  usePageHeading(viewMeta?.label ?? "Patients");
  const [resetTarget, setResetTarget] = useState<PatientRow>();
  const [unassignTarget, setUnassignTarget] = useState<PatientRow>();
  const [assignOpen, setAssignOpen] = useState(false);
  const [flash, setFlash] = useState<{ severity: "success" | "error"; text: string }>();

  const rows = useAsync(() => listPatients(activeRole, courseId), [activeRole, courseId]);
  const canAssign = can(activeRole, "patient:create");
  const canReset = can(activeRole, "patient:reset_practice");

  const clinical = useMemo(
    () => (rows.data ?? []).filter((r) => r.patient.mode !== "case"),
    [rows.data],
  );
  const scopeId = isStudent ? user.id : undefined;
  const searched = clinical.filter((r) => matchesPatientQuery(r, query));
  const visible = view
    ? searched.filter((r) => matchesCaseload(r, view, scopeId)).sort(byPatientName)
    : searched;

  const selectCategory = (id: CaseloadView) => {
    const next = new URLSearchParams(params);
    next.set("view", id);
    next.delete("list");
    setParams(next, { replace: true });
  };

  const doReset = async () => {
    if (!resetTarget) return;
    try {
      await resetPracticePatient(activeRole, resetTarget.patient.id);
      setFlash({
        severity: "success",
        text: `${resetTarget.patient.practiceLabel} was reset. Students' practice notes were archived.`,
      });
      setResetTarget(undefined);
      rows.reload();
    } catch (e) {
      setResetTarget(undefined);
      setFlash({ severity: "error", text: (e as Error).message || "Couldn't reset that practice patient." });
    }
  };

  const doUnassign = async () => {
    if (!unassignTarget) return;
    try {
      await unassignCase(activeRole, unassignTarget.patient.id);
      setFlash({
        severity: "success",
        text: unassignTarget.patient.mode === "simulation"
          ? `${unassignTarget.patient.lastName}, ${unassignTarget.patient.firstName} was ended.`
          : `${unassignTarget.patient.lastName}, ${unassignTarget.patient.firstName} was removed from ${unassignTarget.ownerName ?? "the student"}.`,
      });
      setUnassignTarget(undefined);
      rows.reload();
    } catch (e) {
      setUnassignTarget(undefined);
      setFlash({ severity: "error", text: (e as Error).message || "Couldn't remove that assignment." });
    }
  };

  return (
    <Box>
      {flash && (
        <Alert severity={flash.severity} onClose={() => setFlash(undefined)} sx={{ mb: 2 }}>{flash.text}</Alert>
      )}

      {rows.loading && !rows.data ? <LinearProgress aria-label="Loading patients" /> : view && viewMeta ? (
        <Paper sx={{ overflow: "hidden", borderRadius: "16px" }}>
          <CountTabs
            ariaLabel="Patient categories"
            idPrefix="caseload-tab"
            panelId="caseload-panel"
            value={view}
            onChange={(id) => selectCategory(id as CaseloadView)}
            tabs={CASELOAD_VIEWS.map((item) => ({
              id: item.id,
              label: item.short,
              count: searched.filter((row) => matchesCaseload(row, item.id, scopeId)).length,
            }))}
            action={(
              <Button
                component={RouterLink}
                to={query ? `/patients?q=${encodeURIComponent(query)}` : "/patients"}
                size="small"
                variant="contained"
                color="secondary"
              >
                All patients
              </Button>
            )}
          />
          <Box role="tabpanel" id="caseload-panel" aria-labelledby={`caseload-tab-${view}`} sx={{ bgcolor: "#fff" }}>
            {visible.length === 0 ? (
              <Box sx={{ px: 2, py: 2.5 }}>
                <EmptyState title={query ? "No patients match that search" : viewMeta.emptyTitle}>
                  {query ? "Try a last name, a date of birth, or the full MRN." : viewMeta.emptyBody}
                </EmptyState>
              </Box>
            ) : (
              <Box component="ul" aria-label={viewMeta.label} sx={{ listStyle: "none", m: 0, p: 0, containerType: "inline-size" }}>
                {visible.map((row) => (
                  <TrackerRow
                    key={row.patient.id}
                    row={row}
                    isStudent={isStudent}
                    userId={user.id}
                    canAssign={canAssign}
                    canReset={canReset}
                    onOpen={() => navigate(`/patients/${row.patient.id}`)}
                    onReset={() => setResetTarget(row)}
                    onUnassign={() => setUnassignTarget(row)}
                  />
                ))}
              </Box>
            )}
          </Box>
        </Paper>
      ) : (
        <StatusBoard
          rows={searched}
          query={query}
          onAssign={() => setAssignOpen(true)}
          onReset={setResetTarget}
          onUnassign={setUnassignTarget}
        />
      )}

      <Dialog open={Boolean(resetTarget)} onClose={() => setResetTarget(undefined)}>
        <DialogTitle>Reset {resetTarget?.patient.practiceLabel}?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            The chart goes back to its original state for the next group. Practice notes students wrote on this patient are archived, not deleted.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetTarget(undefined)}>Cancel</Button>
          <Button variant="contained" onClick={doReset}>Reset patient</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(unassignTarget)} onClose={() => setUnassignTarget(undefined)}>
        <DialogTitle>
          {unassignTarget?.patient.mode === "simulation"
            ? "End this simulation?"
            : `Remove this case from ${unassignTarget?.ownerName ?? "the student"}?`}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {unassignTarget?.patient.mode === "simulation"
              ? `${unassignTarget.patient.lastName}, ${unassignTarget.patient.firstName} leaves the list for everyone assigned to it. Graded charts are not affected.`
              : `${unassignTarget?.patient.lastName}, ${unassignTarget?.patient.firstName} will disappear from their patient list. Their notes on this copy are no longer reachable. Other students' copies are unchanged.`}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUnassignTarget(undefined)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={doUnassign}>
            {unassignTarget?.patient.mode === "simulation" ? "End simulation" : "Remove assignment"}
          </Button>
        </DialogActions>
      </Dialog>

      {assignOpen && (
        <AssignCaseDialog
          open
          rows={rows.data ?? []}
          onClose={() => setAssignOpen(false)}
          onAssigned={(assigned) => {
            const names = assigned.map((p) => `${p.lastName}, ${p.firstName}`).join("; ");
            setFlash({
              severity: "success",
              text: `Assigned ${assigned.length === 1 ? "a case" : `${assigned.length} copies`}: ${names}.`,
            });
            rows.reload();
          }}
        />
      )}
    </Box>
  );
}
