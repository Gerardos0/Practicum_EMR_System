// UTEP EMR design tokens. Replaces the old utepGlass.ts.
// Navy carries text and primary actions; orange is reserved for the brand bar
// and the training stripe so it keeps its meaning. All text pairs pass WCAG AA.
export const utep = {
  navy: "#0E2250",
  navyDark: "#081636",
  orange: "#EE8B3C",
  orangeSoft: "#FDF1E6",
  ink: "#172033",
  ink2: "#46536A",
  line: "#D6DCE4",
  page: "#F3F5F8",
  paper: "#FFFFFF",
  alert: "#B42318",
  alertSoft: "#FEF3F2",
} as const;

export const fontFamily = [
  '"Public Sans"', // USWDS typeface, built for government accessibility
  '"Segoe UI"',
  "Roboto",
  "Helvetica",
  "Arial",
  "sans-serif",
].join(",");

/** Diagonal navy/orange hazard stripe that marks simulated records. */
export const trainingStripe = `repeating-linear-gradient(135deg, ${utep.orange} 0 10px, ${utep.navy} 10px 20px)`;
