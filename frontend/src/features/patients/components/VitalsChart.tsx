import { useMemo, useState } from "react";
import { Box, IconButton, Typography } from "@mui/material";
import AddRounded from "@mui/icons-material/AddRounded";
import RemoveRounded from "@mui/icons-material/RemoveRounded";
import type { Patient, Vital } from "../../../types";
import { utep } from "../../../theme/tokens";

type Range = "year" | "month" | "week" | "day" | "hour";

const RANGES: { id: Range; label: string; points: number }[] = [
  { id: "year", label: "Year", points: 12 },
  { id: "month", label: "Month", points: 10 },
  { id: "week", label: "Week", points: 7 },
  { id: "day", label: "Day", points: 13 },
  { id: "hour", label: "Hour", points: 8 },
];

interface Metric {
  id: string;
  label: string;
  valueLabel: string;
  unit: string;
  current: number;
  high?: boolean;
}

function seedFrom(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 33 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function trend(seed: number, current: number, n: number, amplitude: number) {
  return Array.from({ length: n }, (_, i) => {
    if (i === n - 1) return current;
    const t = i / Math.max(n - 1, 1);
    const wave = Math.sin(t * Math.PI * 2.15 + (seed % 7)) * amplitude;
    const wobble = Math.sin(t * 9 + seed) * (amplitude * 0.18);
    return Math.round((current - amplitude * 0.25 + wave + wobble) * 10) / 10;
  });
}

function labelsFor(range: Range, n: number) {
  if (range === "year") {
    return Array.from({ length: n }, (_, i) =>
      new Date(2026, i, 1).toLocaleDateString("en-US", { month: "short" }),
    );
  }
  if (range === "week") return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].slice(0, n);
  if (range === "hour") {
    return Array.from({ length: n }, (_, i) => `${(8 + i).toString().padStart(2, "0")}:00`);
  }
  const start = new Date("2026-09-10");
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return `${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  });
}

function firstNumber(s: string) {
  const m = s.match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : undefined;
}

function parseBp(vitals: Vital[]) {
  const raw = vitals.find((v) => /^bp$/i.test(v.label) || /blood pressure/i.test(v.label))?.value;
  if (!raw) return undefined;
  const m = raw.match(/(\d+)\s*\/\s*(\d+)/);
  return m ? { sys: Number(m[1]), dia: Number(m[2]) } : undefined;
}

export function metricsFromPatient(p: Patient): Metric[] {
  const metrics: Metric[] = [];
  const pulse = p.vitals.find((v) => /pulse|heart/i.test(v.label));
  if (pulse) {
    const current = firstNumber(pulse.value);
    if (current != null) {
      metrics.push({
        id: "hr", label: "Heart rate", valueLabel: String(Math.round(current)), unit: "bpm",
        current, high: current > 100,
      });
    }
  }
  const bp = parseBp(p.vitals);
  if (bp) {
    metrics.push({
      id: "sys", label: "BP systolic", valueLabel: String(bp.sys), unit: "mmHg",
      current: bp.sys, high: bp.sys >= 140,
    });
    metrics.push({
      id: "dia", label: "BP diastolic", valueLabel: String(bp.dia), unit: "mmHg",
      current: bp.dia, high: bp.dia >= 90,
    });
  }
  for (const lab of p.labs.filter((l) => /glucose|a1c/i.test(l.name))) {
    const current = firstNumber(lab.value);
    if (current == null) continue;
    metrics.push({
      id: `lab-${lab.id}`, label: lab.name, valueLabel: lab.value, unit: lab.unit,
      current, high: lab.flag === "H",
    });
  }
  for (const v of p.vitals) {
    if (/pulse|heart|^bp$|blood pressure/i.test(v.label)) continue;
    const current = firstNumber(v.value);
    if (current == null) continue;
    const id = v.label.toLowerCase().replace(/\s+/g, "-");
    const high =
      /temp/i.test(v.label) ? current >= 100.4
      : /rr|respir/i.test(v.label) ? current > 20
      : /spo/i.test(v.label) ? current < 92
      : undefined;
    metrics.push({ id, label: v.label, valueLabel: v.value, unit: "", current, high });
  }
  return metrics;
}

export default function VitalsChart({ patient }: { patient: Patient }) {
  const metrics = useMemo(() => metricsFromPatient(patient), [patient]);
  const [selected, setSelected] = useState(metrics[0]?.id ?? "");
  const [range, setRange] = useState<Range>("day");
  const active = metrics.find((m) => m.id === selected) ?? metrics[0];
  const rangeIdx = RANGES.findIndex((r) => r.id === range);

  const { points, labels } = useMemo(() => {
    if (!active) return { points: [] as number[], labels: [] as string[] };
    const spec = RANGES.find((r) => r.id === range)!;
    const amp = active.current < 40 ? Math.max(active.current * 0.06, 0.4) : Math.max(active.current * 0.08, 4);
    return {
      points: trend(seedFrom(patient.id + active.id), active.current, spec.points, amp),
      labels: labelsFor(range, spec.points),
    };
  }, [active, patient.id, range]);

  if (!active) {
    return <Typography variant="body2" color="text.secondary">No vitals recorded for this visit.</Typography>;
  }

  const shiftRange = (dir: 1 | -1) => {
    const next = Math.min(RANGES.length - 1, Math.max(0, rangeIdx + dir));
    setRange(RANGES[next].id);
  };

  return (
    <Box>
      <Box role="tablist" aria-label="Vital signs" sx={{ display: "flex", gap: 0.75, flexWrap: "nowrap", overflowX: "auto", mb: 2, pb: 0.5 }}>
        {metrics.map((m) => {
          const on = m.id === active.id;
          return (
            <Box
              key={m.id} component="button" type="button" role="tab" aria-selected={on}
              onClick={() => setSelected(m.id)}
              sx={{
                appearance: "none", border: on ? "none" : `1px solid ${utep.line}`,
                cursor: "pointer", textAlign: "left", px: 1.5, py: 1, minWidth: 108, flexShrink: 0,
                borderRadius: "12px", bgcolor: on ? utep.navy : "#F7F8FB", color: on ? "#fff" : utep.ink,
                "&:focus-visible": { outline: `3px solid ${utep.orange}`, outlineOffset: 2 },
              }}
            >
              <Typography sx={{ fontSize: 12, fontWeight: 600, opacity: 0.85, lineHeight: 1.2 }}>{m.label}</Typography>
              <Typography sx={{ fontSize: 16, fontWeight: 800, lineHeight: 1.3, color: on ? utep.orange : m.high ? utep.alert : utep.navy }}>
                {m.high ? "▲ " : "● "}{m.valueLabel}
                {m.unit && <Box component="span" sx={{ fontSize: 12, fontWeight: 600, ml: 0.5, opacity: 0.8 }}>{m.unit}</Box>}
              </Typography>
            </Box>
          );
        })}
      </Box>

      <TrendSvg points={points} labels={labels} />

      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1.25, flexWrap: "wrap" }}>
        <IconButton aria-label="Narrower time range" size="small" onClick={() => shiftRange(1)} disabled={rangeIdx === RANGES.length - 1}>
          <AddRounded fontSize="small" />
        </IconButton>
        <IconButton aria-label="Wider time range" size="small" onClick={() => shiftRange(-1)} disabled={rangeIdx === 0}>
          <RemoveRounded fontSize="small" />
        </IconButton>
        {RANGES.map((r) => {
          const on = r.id === range;
          return (
            <Box
              key={r.id} component="button" type="button" onClick={() => setRange(r.id)}
              sx={{
                appearance: "none", border: "none", background: "none", cursor: "pointer",
                px: 1, py: 0.5, fontWeight: on ? 800 : 600, fontSize: 13,
                color: on ? utep.navy : utep.ink2,
                borderBottom: on ? `2px solid ${utep.orange}` : "2px solid transparent",
                "&:focus-visible": { outline: `3px solid ${utep.navy}`, outlineOffset: 2 },
              }}
            >
              {r.label}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

function TrendSvg({ points, labels }: { points: number[]; labels: string[] }) {
  const w = 720;
  const h = 220;
  const pad = { l: 40, r: 8, t: 12, b: 28 };
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const niceMin = min - span * 0.15;
  const niceMax = max + span * 0.15;
  const niceSpan = niceMax - niceMin;
  const x = (i: number) => pad.l + (i / Math.max(points.length - 1, 1)) * (w - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - niceMin) / niceSpan) * (h - pad.t - pad.b);
  const line = points.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `${line} L${x(points.length - 1).toFixed(1)},${h - pad.b} L${pad.l},${h - pad.b} Z`;
  const ticks = 5;
  const yTicks = Array.from({ length: ticks }, (_, i) => niceMin + (niceSpan * i) / (ticks - 1));
  const labelEvery = Math.ceil(labels.length / 8);

  return (
    <Box sx={{ width: "100%", overflow: "hidden" }}>
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Vital sign trend" style={{ width: "100%", height: "auto", display: "block" }}>
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} stroke={utep.line} strokeDasharray="4 6" />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fill={utep.ink2} fontSize="11" fontFamily="Public Sans, sans-serif">
              {Math.round(t)}
            </text>
          </g>
        ))}
        <path d={area} fill={utep.orange} fillOpacity="0.12" />
        <path d={line} fill="none" stroke={utep.navy} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((v, i) => (
          <circle key={i} cx={x(i)} cy={y(v)} r={i === points.length - 1 ? 5 : 3.5} fill={i === points.length - 1 ? utep.orange : utep.navy} stroke="#fff" strokeWidth="1.5" />
        ))}
        {labels.map((label, i) =>
          i % labelEvery === 0 ? (
            <text key={label + i} x={x(i)} y={h - 8} textAnchor="middle" fill={utep.ink2} fontSize="11" fontFamily="Public Sans, sans-serif">
              {label}
            </text>
          ) : null,
        )}
      </svg>
    </Box>
  );
}
