import { useState } from "react";
import {
  Alert, Box, Button, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography,
} from "@mui/material";
import type { Patient } from "../../../types";
import {
  createClinicalOrder, listClinicalOrders, updateClinicalOrder, type ClinicalOrderRecord,
} from "../../../api/chart";
import { useSession } from "../../auth/useSession";
import { canChartPatient } from "../../chart/access";
import { useAsync } from "../../../utils/useAsync";
import { formatDateTime } from "../../../utils/format";
import { utep } from "../../../theme/tokens";
import EmptyState from "../../../components/EmptyState";

type Kind = "lab" | "procedure";
type Priority = "routine" | "stat";

const EMPTY = { kind: "lab" as Kind, name: "", priority: "routine" as Priority, specimen: "", instructions: "" };

function useOrderList(patient: Patient) {
  const { user, activeRole } = useSession();
  const editable = canChartPatient(activeRole, patient, user.id);
  const orders = useAsync(() => listClinicalOrders(activeRole, patient.id), [activeRole, patient.id]);
  return { activeRole, editable, orders };
}

function OrderFields({
  draft,
  setDraft,
  lockKind,
}: {
  draft: typeof EMPTY;
  setDraft: (next: typeof EMPTY) => void;
  lockKind?: boolean;
}) {
  return (
    <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" } }}>
      <TextField
        select
        label="Kind"
        value={draft.kind}
        disabled={lockKind}
        onChange={(e) => setDraft({ ...draft, kind: e.target.value as Kind })}
      >
        <MenuItem value="lab">Lab</MenuItem>
        <MenuItem value="procedure">Procedure</MenuItem>
      </TextField>
      <TextField select label="Priority" value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: e.target.value as Priority })}>
        <MenuItem value="routine">Routine</MenuItem>
        <MenuItem value="stat">STAT</MenuItem>
      </TextField>
      <TextField
        label={draft.kind === "lab" ? "Lab test" : "Procedure"}
        value={draft.name}
        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        placeholder={draft.kind === "lab" ? "Basic metabolic panel" : "ECG"}
        sx={{ gridColumn: { sm: "1 / -1" } }}
      />
      {draft.kind === "lab" && (
        <TextField label="Specimen" value={draft.specimen} onChange={(e) => setDraft({ ...draft, specimen: e.target.value })} placeholder="Blood" />
      )}
      <TextField
        label="Instructions"
        value={draft.instructions}
        onChange={(e) => setDraft({ ...draft, instructions: e.target.value })}
        placeholder="Fasting, timing, or what to collect"
        sx={{ gridColumn: draft.kind === "lab" ? undefined : { sm: "1 / -1" } }}
      />
    </Box>
  );
}

function OrderTable({
  rows,
  editable,
  onEdit,
  onCancel,
}: {
  rows: ClinicalOrderRecord[];
  editable: boolean;
  onEdit?: (row: ClinicalOrderRecord) => void;
  onCancel?: (row: ClinicalOrderRecord) => void;
}) {
  if (rows.length === 0) {
    return <EmptyState title="No lab or procedure orders">Orders placed on this pharmacy chart show up here.</EmptyState>;
  }
  return (
    <Box sx={{ overflowX: "auto" }}>
      <Table size="small" aria-label="Lab and procedure orders">
        <TableHead>
          <TableRow sx={{ "& th": { color: utep.navy, fontWeight: 700 } }}>
            <TableCell>Kind</TableCell>
            <TableCell>Order</TableCell>
            <TableCell>Priority</TableCell>
            <TableCell>Details</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Ordered</TableCell>
            {editable && <TableCell />}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id} sx={row.status === "cancelled" ? { opacity: 0.6 } : undefined}>
              <TableCell sx={{ textTransform: "capitalize" }}>{row.kind}</TableCell>
              <TableCell sx={{ fontWeight: 700, color: utep.navy }}>{row.name}</TableCell>
              <TableCell>{row.priority === "stat" ? "STAT" : "Routine"}</TableCell>
              <TableCell>{[row.specimen, row.instructions].filter(Boolean).join(" · ") || "—"}</TableCell>
              <TableCell sx={{ textTransform: "capitalize" }}>{row.status}</TableCell>
              <TableCell>{row.orderedByName} · {formatDateTime(row.orderedAt)}</TableCell>
              {editable && (
                <TableCell align="right">
                  {row.status === "ordered" && (
                    <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
                      <Button size="small" variant="outlined" onClick={() => onEdit?.(row)}>Edit</Button>
                      <Button size="small" color="inherit" onClick={() => onCancel?.(row)}>Cancel</Button>
                    </Stack>
                  )}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}

export function EnterOrders({ patient }: { patient: Patient }) {
  const { activeRole, editable, orders } = useOrderList(patient);
  const [draft, setDraft] = useState(EMPTY);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const place = async () => {
    const name = draft.name.trim();
    if (!name) {
      setError("Name the order.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await createClinicalOrder(activeRole, patient.id, {
        kind: draft.kind,
        name,
        priority: draft.priority,
        specimen: draft.kind === "lab" ? draft.specimen.trim() : "",
        instructions: draft.instructions.trim(),
      });
      setDraft(EMPTY);
      await orders.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack spacing={2}>
      {error && <Alert severity="error">{error}</Alert>}
      {editable ? (
        <Paper sx={{ p: 2.5, borderRadius: "16px" }}>
          <Typography component="h2" variant="h6" sx={{ color: utep.navy, mb: 1.5 }}>Enter orders</Typography>
          <OrderFields draft={draft} setDraft={setDraft} />
          <Button sx={{ mt: 1.5 }} variant="contained" disabled={busy} onClick={place}>Place order</Button>
        </Paper>
      ) : (
        <EmptyState title="Enter orders">This chart is open for review. The assigned student enters orders.</EmptyState>
      )}
      <Paper sx={{ borderRadius: "16px" }}>
        <Typography component="h2" variant="h6" sx={{ p: 2, pb: 1, color: utep.navy }}>Orders just placed</Typography>
        <OrderTable rows={orders.data ?? []} editable={false} />
      </Paper>
    </Stack>
  );
}

export function EditOrders({ patient }: { patient: Patient }) {
  const { activeRole, editable, orders } = useOrderList(patient);
  const [draft, setDraft] = useState(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const startEdit = (row: ClinicalOrderRecord) => {
    setEditing(row.id);
    setDraft({
      kind: row.kind,
      name: row.name,
      priority: row.priority,
      specimen: row.specimen ?? "",
      instructions: row.instructions ?? "",
    });
    setError("");
  };

  const save = async () => {
    if (!editing) return;
    const name = draft.name.trim();
    if (!name) {
      setError("Name the order.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await updateClinicalOrder(activeRole, patient.id, editing, {
        name,
        priority: draft.priority,
        specimen: draft.kind === "lab" ? draft.specimen.trim() : "",
        instructions: draft.instructions.trim(),
      });
      setEditing(null);
      setDraft(EMPTY);
      await orders.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const cancelOrder = async (row: ClinicalOrderRecord) => {
    setBusy(true);
    setError("");
    try {
      await updateClinicalOrder(activeRole, patient.id, row.id, { status: "cancelled" });
      if (editing === row.id) {
        setEditing(null);
        setDraft(EMPTY);
      }
      await orders.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack spacing={2}>
      {error && <Alert severity="error">{error}</Alert>}
      {editable && editing && (
        <Paper sx={{ p: 2.5, borderRadius: "16px" }}>
          <Typography component="h2" variant="h6" sx={{ color: utep.navy, mb: 1.5 }}>Edit orders</Typography>
          <OrderFields draft={draft} setDraft={setDraft} lockKind />
          <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
            <Button variant="contained" disabled={busy} onClick={save}>Save order</Button>
            <Button variant="text" disabled={busy} onClick={() => { setEditing(null); setDraft(EMPTY); }}>Close</Button>
          </Stack>
        </Paper>
      )}
      <Paper sx={{ borderRadius: "16px" }}>
        <Typography component="h2" variant="h6" sx={{ p: 2, pb: 1, color: utep.navy }}>Edit orders</Typography>
        <OrderTable rows={orders.data ?? []} editable={editable} onEdit={startEdit} onCancel={cancelOrder} />
      </Paper>
    </Stack>
  );
}
