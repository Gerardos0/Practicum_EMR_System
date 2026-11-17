import { useMemo, useState } from "react";
import { Box, Typography } from "@mui/material";
import type { Patient, Vital } from "../../../types";
import { utep } from "../../../theme/tokens";

interface Point {
  at: number | null;
  value: number;
  caption: string;
}

interface Series {
  id: string;
  label: string;
  unit: string;
  valueLabel: string;
  note?: string;
  points: Point[];
}

function firstNumber(s: string) {
  const match = s.match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : undefined;
}

function when(vital: Vital): number | null {
  if (!vital.recordedAt) return null;
  const time = new Date(vital.recordedAt).getTime();
  return Number.isNaN(time) ? null : time;
}

function caption(at: number | null) {
  if (at == null) return "On file";
  return new Date(at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function readings(vitals: Vital[], include: (vital: Vital) => boolean, valueOf: (vital: Vital) => number | undefined): Point[] {
  return vitals
    .filter((vital) => vital.status !== "entered_in_error" && include(vital))
    .map((vital) => {
      const value = valueOf(vital);
      const at = when(vital);
      return value == null ? null : { at, value, caption: caption(at) };
    })
    .filter((point): point is Point => point != null)
    .sort((a, b) => (a.at ?? 0) - (b.at ?? 0));
}

function seriesFrom(patient: Patient): Series[] {
  const vitals = patient.vitals;
  const series: Series[] = [];
  const pulse = readings(vitals, (vital) => /pulse|heart/i.test(vital.label), (vital) => firstNumber(vital.value));
  if (pulse.length) {
    const current = pulse[pulse.length - 1].value;
    series.push({
      id: "hr", label: "Heart rate", unit: "bpm", valueLabel: String(Math.round(current)),
      note: current > 100 ? "High" : current < 50 ? "Low" : undefined, points: pulse,
    });
  }
  const bp = readings(vitals, (vital) => /^bp$/i.test(vital.label) || /blood pressure/i.test(vital.label), (vital) => {
    const match = vital.value.match(/(\d+)\s*\/\s*(\d+)/);
    return match ? Number(match[1]) : undefined;
  });
  const dia = readings(vitals, (vital) => /^bp$/i.test(vital.label) || /blood pressure/i.test(vital.label), (vital) => {
    const match = vital.value.match(/(\d+)\s*\/\s*(\d+)/);
    return match ? Number(match[2]) : undefined;
  });
  if (bp.length) {
    series.push({
      id: "sys", label: "BP systolic", unit: "mmHg", valueLabel: String(bp[bp.length - 1].value),
      note: bp[bp.length - 1].value >= 140 ? "High" : undefined, points: bp,
    });
  }
  if (dia.length) {
    series.push({
      id: "dia", label: "BP diastolic", unit: "mmHg", valueLabel: String(dia[dia.length - 1].value),
      note: dia[dia.length - 1].value >= 90 ? "High" : undefined, points: dia,
    });
  }
  const seen = new Set<string>();
  for (const vital of vitals) {
    if (vital.status === "entered_in_error" || /pulse|heart|^bp$|blood pressure/i.test(vital.label)) continue;
    const id = vital.label.toLowerCase();
    if (seen.has(id)) continue;
    seen.add(id);
    const points = readings(vitals, (item) => item.label.toLowerCase() === id, (item) => firstNumber(item.value));
    if (!points.length) continue;
    const current = points[points.length - 1].value;
    const note = /pain/i.test(vital.label) ? (current >= 7 ? "High" : undefined)
      : /temp/i.test(vital.label) ? (current >= 100.4 ? "High" : undefined)
      : /rr|respir/i.test(vital.label) ? (current > 20 ? "High" : current < 10 ? "Low" : undefined)
      : /spo/i.test(vital.label) ? (current < 92 ? "Low" : undefined)
      : undefined;
    series.push({ id, label: vital.label, unit: "", valueLabel: String(current), note, points });
  }
  return series;
}

function scaleFor(series: Series, values: number[]) {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const label = series.label;
  let min = lo;
  let max = hi;
  if (series.id === "hr") { min = Math.min(50, lo); max = Math.max(120, hi); }
  else if (series.id === "sys") { min = Math.min(80, lo); max = Math.max(180, hi); }
  else if (series.id === "dia") { min = Math.min(40, lo); max = Math.max(110, hi); }
  else if (/spo/i.test(label)) { min = Math.min(88, lo); max = 100; }
  else if (/respir|^rr\b/i.test(label)) { min = Math.min(8, lo); max = Math.max(36, hi); }
  else if (/temp/i.test(label)) { min = Math.min(96, lo); max = Math.max(104, hi); }
  else if (/pain/i.test(label)) { min = 0; max = 10; }
  else {
    const pad = Math.max((hi - lo) * 0.35, Math.abs(hi) * 0.08, 1);
    min = lo - pad;
    max = hi + pad;
  }
  if (max <= min) max = min + 1;
  return { min, max };
}

function tickText(n: number) {
  const rounded = Math.abs(n) >= 10 ? Math.round(n) : Math.round(n * 10) / 10;
  return String(rounded);
}

function axisLabels(points: Point[]) {
  const days = new Set(points.map((point) => (point.at == null ? "" : new Date(point.at).toDateString())));
  return points.map((point) => {
    if (point.at == null) return "On file";
    const date = new Date(point.at);
    if (days.size <= 1) return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  });
}

export default function VitalsChart({ patient }: { patient: Patient }) {
  const series = useMemo(() => seriesFrom(patient), [patient]);
  const [selected, setSelected] = useState(series[0]?.id ?? "");
  const active = series.find((item) => item.id === selected) ?? series[0];

  if (!active) {
    return <Typography variant="body2" color="text.secondary">No numeric vitals yet.</Typography>;
  }

  return (
    <Box>
      <Box role="tablist" aria-label="Vital signs" sx={{ display: "flex", gap: 0.75, flexWrap: "nowrap", overflowX: "auto", pb: 0.5 }}>
        {series.map((item) => {
          const on = item.id === active.id;
          return (
            <Box
              key={item.id} component="button" type="button" role="tab" aria-selected={on}
              onClick={() => setSelected(item.id)}
              sx={{
                appearance: "none", border: on ? "none" : `1px solid ${utep.line}`,
                cursor: "pointer", textAlign: "left", px: 1.5, py: 1, minWidth: 108, flexShrink: 0,
                borderRadius: "12px", bgcolor: on ? utep.navy : "#F7F8FB", color: on ? "#fff" : utep.ink,
                "&:focus-visible": { outline: `3px solid ${utep.orange}`, outlineOffset: 2 },
              }}
            >
              <Typography sx={{ fontSize: 12, fontWeight: 600, opacity: 0.85, lineHeight: 1.2 }}>{item.label}</Typography>
              <Typography sx={{ fontSize: 16, fontWeight: 800, lineHeight: 1.3, color: on ? "#fff" : item.note ? utep.alert : utep.navy }}>
                {item.valueLabel}
                {item.unit && <Box component="span" sx={{ fontSize: 12, fontWeight: 600, ml: 0.5, opacity: 0.8 }}>{item.unit}</Box>}
              </Typography>
              {item.note && (
                <Typography sx={{ fontSize: 11, fontWeight: 700, lineHeight: 1.2, color: on ? utep.orange : utep.alert }}>{item.note}</Typography>
              )}
            </Box>
          );
        })}
      </Box>

      {active.points.length > 1 && (
        <TrendSvg series={active} />
      )}
    </Box>
  );
}

function TrendSvg({ series }: { series: Series }) {
  const points = series.points.map((point) => point.value);
  const labels = axisLabels(series.points);
  const w = 640;
  const h = 148;
  const pad = { l: 36, r: 12, t: 16, b: 26 };
  const { min, max } = scaleFor(series, points);
  const span = max - min;
  const x = (i: number) => pad.l + (i / Math.max(points.length - 1, 1)) * (w - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - min) / span) * (h - pad.t - pad.b);
  const line = points.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const seen = new Set<string>();
  const yTicks = [0, 1, 2, 3]
    .map((i) => min + (span * i) / 3)
    .filter((tick) => {
      const text = tickText(tick);
      if (seen.has(text)) return false;
      seen.add(text);
      return true;
    });
  const labelEvery = Math.ceil(labels.length / 5);

  return (
    <Box sx={{ width: "100%", mt: 1.5 }}>
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`${series.label} over time`} style={{ width: "100%", height: "auto", display: "block" }}>
        {yTicks.map((tick) => (
          <g key={tickText(tick)}>
            <line x1={pad.l} x2={w - pad.r} y1={y(tick)} y2={y(tick)} stroke={utep.line} />
            <text x={pad.l - 6} y={y(tick) + 4} textAnchor="end" fill={utep.ink2} fontSize="11" fontFamily="Source Sans 3, sans-serif">
              {tickText(tick)}
            </text>
          </g>
        ))}
        <path d={line} fill="none" stroke={utep.navy} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((value, i) => (
          <circle key={i} cx={x(i)} cy={y(value)} r={i === points.length - 1 ? 4.5 : 3} fill={i === points.length - 1 ? utep.orange : utep.navy}>
            <title>{`${series.label} ${value} · ${series.points[i].caption}`}</title>
          </circle>
        ))}
        {labels.map((label, i) =>
          i % labelEvery === 0 || i === labels.length - 1 ? (
            <text key={`${label}-${i}`} x={x(i)} y={h - 6} textAnchor="middle" fill={utep.ink2} fontSize="11" fontFamily="Source Sans 3, sans-serif">
              {label}
            </text>
          ) : null,
        )}
      </svg>
    </Box>
  );
}
