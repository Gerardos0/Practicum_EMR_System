import { useMemo, useState } from "react";
import {
  Alert, Box, Button, FormControl, InputLabel, LinearProgress, MenuItem, Select,
  Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography,
} from "@mui/material";
import { useSession } from "../auth/useSession";
import { useAsync } from "../../utils/useAsync";
import { usePageHeading } from "../../components/usePageHeading";
import PageError from "../../components/PageError";
import { listRoster } from "../../api/roster";
import {
  assignSimLab, assignmentSummary, clearSimLabAssignment,
  listSimLabAssignments, listSimLabRooms, type SimLabRoom,
} from "../../api/simLab";
import { utep } from "../../theme/tokens";
import LabFloorMap from "./LabFloorMap";

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const ROLE_OPTIONS = ["", "Patient", "Nurse", "Provider"];
const BLOCK_OPTIONS = ["", "8:00–9:00", "9:00–10:00", "10:00–11:00", "11:00–12:00", "13:00–14:00", "14:00–15:00"];

function formatDay(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
      <Box sx={{ width: 14, height: 10, borderRadius: "2px", bgcolor: color, border: `1px solid ${color}` }} />
      <Typography sx={{ color: utep.ink2, fontSize: 12, lineHeight: 1 }}>{label}</Typography>
    </Box>
  );
}

export default function LabCheckinPage() {
  usePageHeading("Lab check-in");
  const { activeRole, courseId } = useSession();
  const [sessionDate, setSessionDate] = useState(todayISO);
  const [userId, setUserId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [bed, setBed] = useState("");
  const [roleLabel, setRoleLabel] = useState("");
  const [timeBlock, setTimeBlock] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);

  const rooms = useAsync(
    () => (courseId ? listSimLabRooms(courseId, activeRole) : Promise.resolve([])),
    [courseId, activeRole],
  );
  const roster = useAsync(
    () => (courseId ? listRoster(courseId) : Promise.resolve([])),
    [courseId],
  );
  const board = useAsync(
    () => (courseId
      ? listSimLabAssignments(courseId, activeRole, sessionDate)
      : Promise.resolve([])),
    [courseId, activeRole, sessionDate, tick],
  );

  const selectedRoom: SimLabRoom | undefined = useMemo(
    () => rooms.data?.find((r) => r.id === roomId),
    [rooms.data, roomId],
  );
  const students = useMemo(() => {
    const assigned = new Set((board.data ?? []).map((a) => a.userId));
    return (roster.data ?? [])
      .filter((u) => u.rosterStatus !== "inactive")
      .sort((a, b) => a.fullName.localeCompare(b.fullName))
      .map((u) => ({ ...u, assigned: assigned.has(u.id) }));
  }, [roster.data, board.data]);

  if (!courseId) return <Alert severity="info">Select a course first.</Alert>;
  if (rooms.error) return <PageError error={rooms.error} />;
  if (!rooms.data) return <LinearProgress aria-label="Loading rooms" />;

  async function save(next?: { roomId: string; bed: string }) {
    const rid = next?.roomId ?? roomId;
    const chosenBed = next?.bed ?? bed;
    const room = rooms.data?.find((item) => item.id === rid);
    setError("");
    setMessage("");
    if (!userId || !rid) {
      setError("Choose a student and a bed.");
      return;
    }
    if (room && room.bedCount > 1 && !chosenBed) {
      setError("Pick a bed.");
      return;
    }
    setBusy(true);
    try {
      const row = await assignSimLab(courseId, activeRole, {
        userId,
        roomId: rid,
        sessionDate,
        bed: chosenBed || undefined,
        roleLabel: roleLabel || undefined,
        timeBlock: room?.timing === "hour" ? (timeBlock || undefined) : undefined,
      });
      setRoomId(rid);
      setBed(chosenBed);
      setMessage(`${row.studentName} is in ${assignmentSummary(row)}.`);
      setTick((n) => n + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't check them in.");
    } finally {
      setBusy(false);
    }
  }

  function pickBed(nextRoomId: string, nextBed: string) {
    setRoomId(nextRoomId);
    setBed(nextBed);
    const room = rooms.data?.find((item) => item.id === nextRoomId);
    if (room?.timing !== "hour") setTimeBlock("");
    if (!userId) {
      setError("Choose a student first.");
      setMessage("");
      return;
    }
    void save({ roomId: nextRoomId, bed: nextBed });
  }

  async function clearRow(id: string) {
    setBusy(true);
    setError("");
    try {
      await clearSimLabAssignment(courseId, activeRole, id);
      setMessage("Cleared.");
      setTick((n) => n + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't remove that.");
    } finally {
      setBusy(false);
    }
  }

  const kindLabel = (kind: string) => {
    if (kind === "big_lab") return "Big lab";
    if (kind === "ward") return "Lab";
    if (kind === "testing") return "Testing";
    return "Exam";
  };

  return (
    <Box sx={{ display: "grid", gap: 2, maxWidth: 1100, mx: "auto" }}>
      <Typography sx={{ color: utep.ink2, textAlign: "center", maxWidth: 640, mx: "auto", lineHeight: 1.5 }}>
        Choose a student, then click a bed. Testing and exam rooms can be booked again for a later hour.
      </Typography>

      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <LabFloorMap
          rooms={rooms.data}
          assignments={board.data ?? []}
          timeBlock={timeBlock}
          onPick={pickBed}
        />
        <Box sx={{ display: "flex", gap: 2.5, justifyContent: "center", alignItems: "center", mt: 1.25 }}>
          <Swatch color={utep.orange} label="Open" />
          <Swatch color={utep.navy} label="Reserved" />
        </Box>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}
      {message && <Alert severity="success" onClose={() => setMessage("")}>{message}</Alert>}

      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, alignItems: "start" }}>
        <Box sx={{ display: "flex", flexDirection: "column", border: `1px solid ${utep.line}`, borderRadius: 2, overflow: "hidden", bgcolor: utep.paper }}>
          <Typography sx={{ px: 2, py: 1.25, fontWeight: 700, lineHeight: 1.4, borderBottom: `1px solid ${utep.line}` }}>
            Assign
          </Typography>
          <Box sx={{ display: "grid", gap: 1.5, p: 2 }}>
          <TextField
            label="Lab date"
            type="date"
            size="small"
            value={sessionDate}
            onChange={(e) => setSessionDate(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <FormControl size="small" fullWidth>
            <InputLabel id="student-label">Student</InputLabel>
            <Select
              labelId="student-label"
              label="Student"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
            >
              {students.map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  {s.fullName}{s.assigned ? " (assigned)" : ""}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" fullWidth>
            <InputLabel id="room-label">Room</InputLabel>
            <Select
              labelId="room-label"
              label="Room"
              value={roomId}
              onChange={(e) => {
                setRoomId(e.target.value);
                setBed("");
                setTimeBlock("");
              }}
            >
              {(rooms.data ?? []).map((r) => (
                <MenuItem key={r.id} value={r.id}>
                  {r.number} · {kindLabel(r.kind)}
                  {r.bedCount > 1 ? ` · ${r.bedCount} beds` : ""}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {selectedRoom && selectedRoom.bedCount > 1 && (
            <FormControl size="small" fullWidth>
              <InputLabel id="bed-label">Bed</InputLabel>
              <Select
                labelId="bed-label"
                label="Bed"
                value={bed}
                onChange={(e) => setBed(e.target.value)}
              >
                {selectedRoom.bedOptions.map((b) => (
                  <MenuItem key={b} value={b}>Bed {b}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          <FormControl size="small" fullWidth>
            <InputLabel id="role-label">Role (optional)</InputLabel>
            <Select
              labelId="role-label"
              label="Role (optional)"
              value={roleLabel}
              onChange={(e) => setRoleLabel(e.target.value)}
            >
              {ROLE_OPTIONS.map((r) => (
                <MenuItem key={r || "none"} value={r}>{r || "None"}</MenuItem>
              ))}
            </Select>
          </FormControl>
          {selectedRoom?.timing === "hour" && (
            <FormControl size="small" fullWidth>
              <InputLabel id="block-label">Time block (optional)</InputLabel>
              <Select
                labelId="block-label"
                label="Time block (optional)"
                value={timeBlock}
                onChange={(e) => setTimeBlock(e.target.value)}
              >
                {BLOCK_OPTIONS.map((b) => (
                  <MenuItem key={b || "none"} value={b}>{b || "None"}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          <Button variant="contained" disabled={busy} onClick={() => save()}>
            Check in
          </Button>
          </Box>
        </Box>

        <Box sx={{ border: `1px solid ${utep.line}`, borderRadius: 2, overflow: "hidden", bgcolor: utep.paper, display: "flex", flexDirection: "column" }}>
          <Typography sx={{ px: 2, py: 1.25, fontWeight: 700, lineHeight: 1.4, borderBottom: `1px solid ${utep.line}` }}>
            Checked in · {formatDay(sessionDate)}
          </Typography>
          {board.loading && !board.data ? (
            <LinearProgress />
          ) : (board.data?.length ?? 0) === 0 ? (
            <Typography sx={{ p: 2, color: utep.ink2, textAlign: "center" }}>No students checked in for this date.</Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Student</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Assignment</TableCell>
                  <TableCell align="right" sx={{ width: 88 }} />
                </TableRow>
              </TableHead>
              <TableBody>
                {(board.data ?? []).map((row) => (
                  <TableRow key={row.id}>
                    <TableCell sx={{ verticalAlign: "middle" }}>{row.studentName}</TableCell>
                    <TableCell sx={{ verticalAlign: "middle" }}>{assignmentSummary(row)}</TableCell>
                    <TableCell align="right" sx={{ verticalAlign: "middle" }}>
                      <Button size="small" disabled={busy} onClick={() => clearRow(row.id)}>
                        Clear
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Box>
      </Box>
    </Box>
  );
}
