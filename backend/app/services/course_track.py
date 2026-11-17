"""Which course a chart belongs to. Pharmacy and nursing stay separate."""

PHARMACY = "pharmacy"
NURSING = "nursing"


def track_for_code(code: str | None) -> str | None:
    token = (code or "").strip().upper()
    if token.startswith("PHAR"):
        return PHARMACY
    if token.startswith("PHYT"):
        return NURSING
    return None


def course_track(course) -> str | None:
    stored = getattr(course, "track", None) if course is not None else None
    if stored in {PHARMACY, NURSING}:
        return stored
    return track_for_code(getattr(course, "code", None) if course is not None else None)
