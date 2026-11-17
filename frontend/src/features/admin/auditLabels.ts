export function actionLabel(action: string, detail?: string): string {
  if (action === "note.view_sensitive" && detail === "psychiatry") return "Opened a psychiatry note";
  const labels: Record<string, string> = {
    "auth.login": "Signed in",
    "auth.login_failed": "Sign-in failed",
    "auth.locked": "Account locked",
    "auth.logout": "Signed out",
    "auth.password_changed": "Changed password",
    "chart.view": "Opened a chart",
    "note.view": "Opened a note",
    "note.view_sensitive": "Opened a protected note",
    "note.view_psychiatry": "Opened a psychiatry note",
    "portal.view": "Opened the patient portal",
    "ai.suggest": "Asked for a suggestion",
    "sim_lab.assign": "Checked a student into lab",
    "sim_lab.clear": "Cleared a lab bed",
  };
  return labels[action] ?? action.replace(/[._]/g, " ");
}
