import { Autocomplete, Box, Chip, InputAdornment, Stack, TextField, Typography } from "@mui/material";
import type { IcdCode, NoteTemplateId, Patient } from "../../../types";
import { TEMPLATES, type TemplateField } from "../noteTemplates";
import { ICD10 } from "../icd10";
import DictationButton from "../../../components/DictationButton";
import MedRecTable, { parseMedRec } from "./MedRecTable";
import { utep } from "../../../theme/tokens";

type Setter = (id: string, next: string | ((prev: string) => string)) => void;

interface Props {
  templateId: NoteTemplateId;
  patient: Patient;
  content: Record<string, string>;
  diagnoses: IcdCode[];
  readOnly?: boolean;
  /** Field ids to flag as missing. */
  errors?: Set<string>;
  onField?: Setter;
  onDiagnoses?: (d: IcdCode[]) => void;
}

const SOAP = new Set(["S", "O", "A", "P"]);

/** Renders any template, editable or as a clean read-only document for review. */
export default function NoteFields({ templateId, patient, content, diagnoses, readOnly, errors, onField, onDiagnoses }: Props) {
  const template = TEMPLATES[templateId];

  return (
    <Stack spacing={3.5}>
      {template.sections.map((section) => (
        <Box component="section" key={section.id} aria-labelledby={`sec-${section.id}`}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 1.5 }}>
            {SOAP.has(section.id) && (
              <Box aria-hidden sx={{ width: 30, height: 30, borderRadius: 1, bgcolor: utep.navy, color: "#fff", display: "grid", placeItems: "center", fontWeight: 800 }}>
                {section.id}
              </Box>
            )}
            <Typography id={`sec-${section.id}`} component="h3" variant="h6">{section.title}</Typography>
          </Box>
          <Stack spacing={2}>
            {section.fields.map((f) => (
              <Field
                key={f.id} field={f} patient={patient} value={content[f.id] ?? ""} diagnoses={diagnoses}
                readOnly={readOnly} error={errors?.has(f.id)} onField={onField} onDiagnoses={onDiagnoses}
              />
            ))}
          </Stack>
        </Box>
      ))}
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
        renderTags={(v, getTagProps) =>
          v.map((o, i) => {
            const { key, ...rest } = getTagProps({ index: i });
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
      InputProps={f.kind === "textarea" ? {
        endAdornment: (
          <InputAdornment position="end" sx={{ alignSelf: "flex-start", mt: 1 }}>
            <DictationButton label={f.label} onText={(t) => onField?.(f.id, (prev) => (prev ? `${prev} ${t}` : t))} />
          </InputAdornment>
        ),
      } : undefined}
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
