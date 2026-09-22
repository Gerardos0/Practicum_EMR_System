"""Seed starting roles, disciplines, permissions, and an admin account.

Run from backend/:   python -m app.scripts.seed --admin-email admin@utep.edu
Safe to re-run: existing rows are kept, and role->permission mappings are
re-synced to match this file (so edit the mapping here, then re-run).

DRAFT permission mapping -- pending client answers to Week 0 questions
#2 (multiple roles?), #3 (instructor vs admin), #8 (who sees psych notes),
#9 (who can sign/co-sign notes).
"""
import argparse
import asyncio
import getpass

from sqlalchemy import select
from sqlalchemy.orm import selectinload

import app.models  # noqa: F401
from app.core.security import hash_password
from app.db.session import AsyncSessionLocal, engine
from app.models.user import Discipline, Permission, Role, User

PERMISSIONS = {
    "user:manage": "Create/edit accounts and assign roles",
    "audit:read": "Review the audit trail",
    "simulation:manage": "Create and reset simulated patients",
    "patient:read": "View patient charts",
    "patient:write": "Edit demographics, insurance, emergency contacts",
    "chart:write": "Edit history, allergies, problems, immunizations",
    "encounter:read": "View encounters",
    "encounter:write": "Create/close encounters",
    "note:write": "Write clinical notes",
    "note:cosign": "Co-sign student notes",
    "sensitive_note:read": "View psychology/psychiatry notes",
    "vitals:write": "Record vitals",
    "medication:read": "View medication list",
    "prescription:write": "Create simulated prescriptions",
    "scheduling:write": "Create/manage appointments",
}

DISCIPLINES = {
    "medicine": "Medicine",
    "nursing": "Nursing",
    "pharmacy": "Pharmacy",
    "physical_therapy": "Physical Therapy",
    "occupational_therapy": "Occupational Therapy",
    "social_work": "Social Work",
    "speech_language_pathology": "Speech-Language Pathology",
    "psychology": "Psychology / Psychiatry",
}

_THERAPY = ["patient:read", "encounter:read", "note:write", "medication:read"]

ROLES: dict[str, tuple[str, list[str]]] = {
    "admin": ("Administrator", list(PERMISSIONS)),
    "instructor": ("Instructor", [
        "user:manage", "audit:read", "simulation:manage", "patient:read",
        "encounter:read", "note:cosign", "medication:read", "sensitive_note:read",
    ]),
    "front_desk": ("Front Desk", ["patient:read", "patient:write", "scheduling:write"]),
    "physician": ("Physician / Medical Provider", [
        "patient:read", "chart:write", "encounter:read", "encounter:write", "note:write",
        "vitals:write", "medication:read", "prescription:write",
    ]),
    "nurse": ("Nurse", [
        "patient:read", "chart:write", "encounter:read", "note:write", "vitals:write", "medication:read",
    ]),
    "pharmacist": ("Pharmacist / Pharmacy Student", ["patient:read", "encounter:read", "medication:read"]),
    "physical_therapist": ("Physical Therapy", _THERAPY),
    "occupational_therapist": ("Occupational Therapy", _THERAPY),
    "social_worker": ("Social Work", _THERAPY),
    "slp": ("Speech-Language Pathology", _THERAPY),
    "psychology": ("Psychology / Psychiatry", _THERAPY + ["sensitive_note:read"]),
}


async def seed(admin_email: str | None, admin_password: str | None) -> None:
    async with AsyncSessionLocal() as db:
        # Permissions
        existing = {p.code: p for p in (await db.scalars(select(Permission))).all()}
        for code, desc in PERMISSIONS.items():
            if code not in existing:
                existing[code] = Permission(code=code, description=desc)
                db.add(existing[code])

        # Disciplines
        have = {d.code for d in (await db.scalars(select(Discipline))).all()}
        for code, name in DISCIPLINES.items():
            if code not in have:
                db.add(Discipline(code=code, name=name))

        # Roles + permission mapping (re-synced every run)
        roles = {
            r.code: r
            for r in (await db.scalars(select(Role).options(selectinload(Role.permissions)))).all()
        }
        for code, (name, perm_codes) in ROLES.items():
            role = roles.get(code)
            if role is None:
                role = Role(code=code, name=name, permissions=[])
                db.add(role)
                roles[code] = role
            role.permissions = [existing[p] for p in perm_codes]

        # Admin user
        if admin_email:
            email = admin_email.strip().lower()
            if await db.scalar(select(User).where(User.email == email)):
                print(f"Admin {email} already exists -- skipped.")
            else:
                db.add(User(
                    email=email,
                    first_name="Admin",
                    last_name="User",
                    hashed_password=hash_password(admin_password),
                    must_change_password=False,  # you chose this password yourself
                    roles=[roles["admin"]],
                ))
                print(f"Created admin {email}.")

        await db.commit()
    await engine.dispose()
    print(f"Seeded {len(PERMISSIONS)} permissions, {len(DISCIPLINES)} disciplines, {len(ROLES)} roles.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed EHR reference data")
    parser.add_argument("--admin-email", help="Create an admin account with this email")
    args = parser.parse_args()

    password = None
    if args.admin_email:
        password = getpass.getpass("Admin password (min 8 chars): ")
        if len(password) < 8:
            raise SystemExit("Password too short.")
        if password != getpass.getpass("Confirm password: "):
            raise SystemExit("Passwords don't match.")

    asyncio.run(seed(args.admin_email, password))


if __name__ == "__main__":
    main()
