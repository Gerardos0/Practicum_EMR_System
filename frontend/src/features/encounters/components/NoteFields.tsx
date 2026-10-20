import { useState } from "react";
import { Autocomplete, Box, Button, Chip, InputAdornment, Stack, TextField, Typography } from "@mui/material";
import type { IcdCode, NoteComment, NoteTemplateId, Patient } from "../../../types";
import { TEMPLATES, type TemplateField } from "../noteTemplates";
import { ICD10 } from "../icd10";
import DictationButton from "../../../components/DictationButton";
import MedRecTable, { parseMedRec } from "./MedRecTable";
import FeedbackThread from "./FeedbackThread";
import { utep } from "../../../theme/tokens";

type Setter = (id: string, next: string | ((prev: string) => string)) => void;

interface Props {
  templateId: NoteTemplateId;
  patient: Patient;
  content: Record<string, string>;
  diagnoses: IcdCode[];
  readOnly?: boolean;
  errors?: Set<string>;
  onField?: Setter;
  onDiagnoses?: (d: IcdCode[]) => void;
  comments?: NoteComment[];
  onComment?: (sectionId: string, body: string) => Promise<void>;
}

const SOAP = new Set(["S", "O", "A", "P"]);

export default function NoteFields({
  templateId, patient, content, diagnoses, readOnly, errors, onField, onDiagnoses, comments, onComment,
}: Props) {
  const template = TEMPLATES[templateId];
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [commentError, setCommentError] = useState("");

  const send = async (sectionId: string) => {
    if (!onComment || !draft.trim()) return;
    setSending(true);
    setCommentError("");
    try {
      await onComment(sectionId, draft.trim());
      setDraft("");
      setOpenSection(null);
    } catch (e) {
      setCommentError((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <Stack spacing={3.5}>
      {template.sections.map((section) => {
        const sectionComments = (comments ?? []).filter((item) => item.sectionId === section.id);
        return (
        <Box component="section" key={section.id} aria-labelledby={`sec-${section.id}`}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 1.5, flexWrap: "wrap" }}>
            {SOAP.has(section.id) && (
              <Box aria-hidden sx={{ width: 30, height: 30, borderRadius: 1, bgcolor: utep.navy, color: "#fff", display: "grid", placeItems: "center", fontWeight: 800 }}>
                {section.id}
              </Box>
            )}
            <Typography id={`sec-${section.id}`} component="h3" variant="h6" sx={{ flex: 1 }}>{section.title}</Typography>
            {onComment && (
              <Button type="button" size="small" onClick={() => { setOpenSection(section.id); setDraft(""); setCommentError(""); }}>
                Comment on this section
              </Button>
            )}
          </Box>
          {sectionComments.length > 0 && <Box sx={{ mb: 1.5 }}><FeedbackThread items={sectionComments} hideSection /></Box>}
          {onComment && openSection === section.id && (
            <Stack spacing={1} sx={{ mb: 1.5 }}>
              <TextField
                label={`Comment on ${section.title}`}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                multiline
                minRows={2}
                fullWidth
              />
              {commentError && <Typography variant="body2" color="error">{commentError}</Typography>}
              <Box sx={{ display: "flex", gap: 1 }}>
                <Button type="button" variant="contained" size="small" disabled={sending || !draft.trim()} onClick={() => send(section.id)}>
                  Save comment
                </Button>
                <Button type="button" size="small" onClick={() => setOpenSection(null)}>Cancel</Button>
              </Box>
            </Stack>
          )}
          <Stack spacing={2}>
            {section.fields.map((f) => (
              <Field
                key={f.id} field={f} patient={patient} value={content[f.id] ?? ""} diagnoses={diagnoses}
                readOnly={readOnly} error={errors?.has(f.id)} onField={onField} onDiagnoses={onDiagnoses}
              />
            ))}
          </Stack>
        </Box>
        );
      })}
    </Stack>
  );
}

function Field({
  field: f, patient, value, diagnoses, readOnly, error, onField, onDiagnoses,
}: {
  field: TemplateField; patient: Patient; value: string; diagnoses: IcdCode[];
  readOnly?: boolean; error?: boolean; onField?: Setter; onDiagnoses?: (d: IcdCode[]) => void;
}) {
  const label = f.required && !readOnly ? `${f.label} *` : f.label;

  if (f.kind === "medrec") {
    return (
      <MedRecTable
        medications={patient.medications} value={parseMedRec(value)} readOnly={readOnly}
        onChange={(v) => onField?.(f.id, JSON.stringify(v))}
      />
    );
  }

  if (f.kind === "icd10") {
    if (readOnly) {
      return (
        <ReadBlock label={f.label}>
          {diagnoses.length ? diagnoses.map((d) => <Typography key={d.code} variant="body2"><b>{d.code}</b> {d.label}</Typography>) : null}
        </ReadBlock>
      );
    }
    return (
      <Autocomplete
        multiple options={ICD10} value={diagnoses}
        getOptionLabel={(o) => `${o.code} ${o.label}`}
        isOptionEqualToValue={(a, b) => a.code === b.code}
        onChange={(_, v) => onDiagnoses?.(v)}
        renderValue={(v, getItemProps) =>
          v.map((o, i) => {
            const { key, ...rest } = getItemProps({ index: i });
            return <Chip key={key} {...rest} size="small" label={`${o.code} ${o.label}`} />;
          })
        }
        renderInput={(params) => (
          <TextField
            {...params} id={`field-${f.id}`} label={label} placeholder={diagnoses.length ? "" : "Search by code or condition"}
            error={error} helperText={error ? "Add at least one diagnosis." : "Primary diagnosis first."}
          />
        )}
      />
    );
  }

  if (readOnly) {
    return <ReadBlock label={f.label}>{value ? <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>{value}</Typography> : null}</ReadBlock>;
  }

  return (
    <TextField
      id={`field-${f.id}`} label={label} placeholder={f.placeholder} fullWidth
      multiline={f.kind === "textarea"} minRows={f.kind === "textarea" ? f.rows ?? 3 : undefined}
      value={value} error={error} helperText={error ? "Required before you sign." : undefined}
      onChange={(e) => onField?.(f.id, e.target.value)}
      slotProps={f.kind === "textarea" ? { input: {
        endAdornment: (
          <InputAdornment position="end" sx={{ alignSelf: "flex-start", mt: 1 }}>
            <DictationButton label={f.label} onText={(t) => onField?.(f.id, (prev) => (prev ? `${prev} ${t}` : t))} />
          </InputAdornment>
        ),
      } } : undefined}
    />
  );
}

function ReadBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box>
      <Typography variant="subtitle2" color="text.secondary">{label}</Typography>
      {children ?? <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic" }}>Not documented</Typography>}
    </Box>
  );
}
