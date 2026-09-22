import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert, Box, Breadcrumbs, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
  Divider, LinearProgress, Link, MenuItem, Paper, Stack, TextField, Typography,
} from "@mui/material";
import { Link as RouterLink, useNavigate, useParams } from "react-router-dom";
import type { ClinicalNote, IcdCode, NoteTemplateId, Patient, User } from "../../types";
import { getPatient } from "../../api/patients";
import { addAddendum, createDraft, getNote, listNotesForPatient, saveDraft, signNote } from "../../api/notes";
import { listInstructors } from "../../api/courses";
import { useSession } from "../auth/AuthContext";
import { formatTime } from "../../utils/format";
import NoteStatusChip from "../../components/NoteStatusChip";
import PageError from "../../components/PageError";
import PatientBanner from "../patients/components/PatientBanner";
import ChartReference from "../patients/components/ChartReference";
import NoteFields from "./components/NoteFields";
import NoteProgress from "./components/NoteProgress";
import FeedbackThread from "./components/FeedbackThread";
import Addenda from "./components/Addenda";
import { TEMPLATES, defaultTemplateFor, missingRequired, templatesFor } from "./noteTemplates";

type SaveState = "idle" | "saving" | "saved" | "error";

export default function NoteEditorPage() {
  const { patientId = "", noteId = "new" } = useParams();
  const navigate = useNavigate();
  const { user, activeRole, discipline, courseId } = useSession();

  const [patient, setPatient] = useState<Patient>();
  const [note, setNote] = useState<ClinicalNote>();
  const [instructors, setInstructors] = useState<User[]>([]);
  const [loadError, setLoadError] = useState<Error>();

  // Editable draft state
  const [templateId, setTemplateId] = useState<NoteTemplateId>(defaultTemplateFor(discipline));
  const [content, setContent] = useState<Record<string, string>>({});
  const [diagnoses, setDiagnoses] = useState<IcdCode[]>([]);
  const [routedToId, setRoutedToId] = useState("");

  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [savedAt, setSavedAt] = useState<string>();
  const [error, setError] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // ---- Load (or create) the note ---------------------------------------------------------
  const creating = useRef(false);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const p = await getPatient(user, activeRole, patientId);
        if (!alive) return;
        setPatient(p);
        setInstructors(await listInstructors(courseId));

        if (noteId === "new") {
          if (creating.current) return;
          creating.current = true;
          // Reuse an open draft rather than creating duplicates.
          const existing = (await listNotesForPatient(user, activeRole, patientId)).find(
            (n) => n.authorId === user.id && (n.status === "draft" || n.status === "returned"),
          );
          const n = existing ?? (await createDraft(user, discipline ?? "pharmacy", p, defaultTemplateFor(discipline)));
          navigate(`/patients/${patientId}/notes/${n.id}`, { replace: true });
          return;
        }
        const n = await getNote(user, activeRole, noteId);
        if (!alive) return;
        hydrate(n);
      } catch (e) {
        if (alive) setLoadError(e as Error);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, noteId]);

  const version = useRef(0);
  const hydrate = (n: ClinicalNote) => {
    setNote(n);
    version.current = n.version;
    setTemplateId(n.templateId);
    setContent(n.content);
    setDiagnoses(n.diagnoses);
    setRoutedToId(n.routedToId ?? "");
  };

  // ---- Autosave with optimistic concurrency ----------------------------------------------
  const latest = useRef({ templateId, content, diagnoses, routedToId });
  latest.current = { templateId, content, diagnoses, routedToId };
  const changeSeq = useRef(0);
  const savedSeq = useRef(0);
  const saving = useRef(false);

  const editable = Boolean(note && note.authorId === user.id && (note.status === "draft" || note.status === "returned"));

  const save = useCallback(async (): Promise<boolean> => {
    if (!note || saving.current) return false;
    const seq = changeSeq.current;
    if (seq === savedSeq.current) return true;
    saving.current = true;
    setSaveState("saving");
    try {
      const res = await saveDraft(user, note.id, version.current, {
        ...latest.current, routedToId: latest.current.routedToId || undefined,
      });
      version.current = res.version;
      savedSeq.current = seq;
      setSavedAt(res.updatedAt);
      setSaveState("saved");
      return true;
    } catch (e) {
      setSaveState("error");
      setError((e as Error).message);
      return false;
    } finally {
      saving.current = false;
    }
  }, [note, user]);

  const markDirty = () => {
    changeSeq.current += 1;
    setSaveState((s) => (s === "error" ? s : "idle"));
  };

  useEffect(() => {
    if (!editable || changeSeq.current === savedSeq.current) return;
    const t = setTimeout(save, 1200);
    return () => clearTimeout(t);
  }, [content, diagnoses, templateId, routedToId, editable, save]);

  // Warn before closing the tab with unsaved edits.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (changeSeq.current !== savedSeq.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  const setField = (id: string, next: string | ((prev: string) => string)) => {
    markDirty();
    setContent((c) => ({ ...c, [id]: typeof next === "function" ? next(c[id] ?? "") : next }));
  };

  // ---- Sign ------------------------------------------------------------------------------
  const missing = missingRequired(templateId, content, diagnoses.length);
  const needsRoute = note?.mode === "assessment" && !routedToId;

  const trySign = () => {
    setShowErrors(true);
    if (missing.length || needsRoute) {
      const first = missing[0] ? `field-${missing[0]}` : "route-select";
      document.getElementById(first)?.focus();
      return;
    }
    setConfirmOpen(true);
  };

  const doSign = async () => {
    setConfirmOpen(false);
    if (!(await save())) return;
    try {
      hydrate(await signNote(user, note!.id, version.current));
      setShowErrors(false);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (loadError) return <PageError error={loadError} />;
  if (!patient || !note) return <LinearProgress aria-label="Loading note" />;

  const isAssessment = note.mode === "assessment";
  const reviewer = instructors.find((i) => i.id === (note.routedToId ?? routedToId));
  const errorSet = showErrors ? new Set(missing) : undefined;
  const choices = templatesFor(discipline);

  return (
    <Stack spacing={2}>
      <Breadcrumbs>
        <Link component={RouterLink} to="/patients" underline="hover">Patients</Link>
        <Link component={RouterLink} to={`/patients/${patient.id}`} underline="hover">{patient.lastName}, {patient.firstName}</Link>
        <Typography color="text.primary">{TEMPLATES[templateId].name}</Typography>
      </Breadcrumbs>

      <PatientBanner patient={patient} compact />

      <Box sx={{ display: "grid", gap: 2.5, gridTemplateColumns: { xs: "1fr", lg: "1fr 340px" }, alignItems: "start" }}>
        {/* Editor */}
        <Paper component="article" aria-label="Note" sx={{ p: { xs: 2, md: 3 } }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap", mb: 2.5 }}>
            <Box sx={{ flex: 1, minWidth: 220 }}>
              <Typography component="h2" variant="h5">{TEMPLATES[templateId].name}</Typography>
              <Typography variant="body2" color="text.secondary">
                {patient.encounter.type}, {note.authorName}
              </Typography>
            </Box>
            <NoteStatusChip status={note.status} />
            {editable && note.status === "draft" && choices.length > 1 && (
              <TextField
                select size="small" label="Template" value={templateId} sx={{ minWidth: 240 }}
                onChange={(e) => { markDirty(); setTemplateId(e.target.value as NoteTemplateId); }}
              >
                {choices.map((t) => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
              </TextField>
            )}
          </Box>

          {note.status === "returned" && (
            <Alert severity="error" sx={{ mb: 2.5 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Your instructor returned this note. Revise it and resubmit.</Typography>
              <FeedbackThread items={note.feedback} />
            </Alert>
          )}
          {note.status === "pending_review" && (
            <Alert severity="info" sx={{ mb: 2.5 }}>
              Submitted to {reviewer?.fullName ?? "your instructor"}. You can edit again only if it's returned.
            </Alert>
          )}
          {note.status === "cosigned" && note.feedback.length > 0 && (
            <Alert severity="success" sx={{ mb: 2.5 }}><FeedbackThread items={note.feedback} /></Alert>
          )}
          {error && <Alert severity="error" onClose={() => setError("")} sx={{ mb: 2.5 }}>{error}</Alert>}

          <NoteFields
            templateId={templateId} patient={patient} content={content} diagnoses={diagnoses}
            readOnly={!editable} errors={errorSet}
            onField={setField} onDiagnoses={(d) => { markDirty(); setDiagnoses(d); }}
          />

          {(note.status === "signed" || note.status === "cosigned") && (
            <>
              <Divider sx={{ my: 3 }} />
              <Addenda
                items={note.addenda}
                onAdd={note.authorId === user.id ? async (body) => hydrate(await addAddendum(user, note.id, body)) : undefined}
              />
            </>
          )}
        </Paper>

        {/* Side panel */}
        <Stack spacing={2} sx={{ position: { lg: "sticky" }, top: { lg: 88 } }}>
          <Paper sx={{ p: 2.5 }}>
            <Typography component="h2" variant="subtitle1" sx={{ mb: 1 }}>{isAssessment ? "Submission" : "Practice note"}</Typography>
            <NoteProgress note={note} />

            {editable && (
              <Stack spacing={1.5} sx={{ mt: 2 }}>
                {isAssessment && (
                  <TextField
                    select id="route-select" label="Send for co-signature to" value={routedToId}
                    error={showErrors && needsRoute} helperText={showErrors && needsRoute ? "Choose your reviewing instructor." : undefined}
                    onChange={(e) => { markDirty(); setRoutedToId(e.target.value); }}
                  >
                    {instructors.map((i) => <MenuItem key={i.id} value={i.id}>{i.fullName}</MenuItem>)}
                  </TextField>
                )}
                {showErrors && missing.length > 0 && (
                  <Alert severity="warning">Complete {missing.length} required {missing.length === 1 ? "field" : "fields"} before signing.</Alert>
                )}
                <Button variant="contained" size="large" onClick={trySign}>
                  {!isAssessment ? "Sign note" : note.status === "returned" ? "Sign and resubmit" : "Sign and submit for review"}
                </Button>
                <Typography variant="caption" color="text.secondary" role="status" aria-live="polite">
                  {saveState === "saving" && "Saving…"}
                  {saveState === "saved" && savedAt && `Draft saved at ${formatTime(savedAt)}`}
                  {saveState === "idle" && (changeSeq.current !== savedSeq.current ? "Unsaved changes" : "Drafts save automatically")}
                  {saveState === "error" && "Not saved. See the message above."}
                </Typography>
              </Stack>
            )}
            {isAssessment && (
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.5 }}>
                You sign as the author. The note isn't final until an instructor co-signs. Prescribing is simulated.
              </Typography>
            )}
          </Paper>

          <Paper sx={{ overflow: "hidden" }}>
            <Typography component="h2" variant="subtitle1" sx={{ px: 2, pt: 1.5 }}>Chart</Typography>
            <ChartReference patient={patient} />
          </Paper>
        </Stack>
      </Box>

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>{isAssessment ? "Sign and submit this note?" : "Sign this note?"}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {isAssessment
              ? `It goes to ${reviewer?.fullName ?? "your instructor"} for review. You won't be able to edit it unless it's returned.`
              : "Signed notes are locked. You can still add an addendum."}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Keep editing</Button>
          <Button variant="contained" onClick={doSign}>{isAssessment ? "Sign and submit" : "Sign note"}</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
