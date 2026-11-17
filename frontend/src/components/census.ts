export function nameInitials(name: string) {
  const cleaned = name.trim();
  if (!cleaned) return "?";
  if (cleaned.includes(",")) {
    const [last, first] = cleaned.split(",").map((part) => part.trim());
    return `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase() || "?";
  }
  const parts = cleaned.split(/\s+/);
  return `${parts[0]?.[0] ?? ""}${parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : ""}`.toUpperCase() || "?";
}
