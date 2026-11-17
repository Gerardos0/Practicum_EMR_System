import { useState } from "react";
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, LinearProgress,
} from "@mui/material";
import { useSearchParams } from "react-router-dom";
import { listPatients, resetPracticePatient, unassignCase, type PatientRow } from "../../api/patients";
import { useSession } from "../auth/useSession";
import { useAsync } from "../../utils/useAsync";
import AssignCaseDialog from "../patients/components/AssignCaseDialog";
import PharmacyWorklist from "../patients/PharmacyWorklist";
import { matchesPatientQuery } from "../patients/tracker";

export default function PharmacyDashboard() {
  const { activeRole, courseId } = useSession();
  const [params] = useSearchParams();
  const query = params.get("q") ?? "";
  const rows = useAsync(() => listPatients(activeRole, courseId), [activeRole, courseId]);
  const [resetTarget, setResetTarget] = useState<PatientRow>();
  const [unassignTarget, setUnassignTarget] = useState<PatientRow>();
  const [assignOpen, setAssignOpen] = useState(false);
  const [flash, setFlash] = useState<{ severity: "success" | "error"; text: string }>();

  const searched = (rows.data ?? [])
    .filter((row) => row.patient.mode !== "case")
    .filter((row) => matchesPatientQuery(row, query));

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
      {rows.loading && !rows.data ? <LinearProgress aria-label="Loading patients" /> : (
        <PharmacyWorklist
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
