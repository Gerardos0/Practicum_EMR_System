from __future__ import annotations

import argparse
import asyncio
import csv
import os
from pathlib import Path
from urllib.parse import urlparse

from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.services.audit import log_event
from app.services.portal_accounts import provision_patient_logins


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Provision simulated patient portal logins.")
    parser.add_argument("--apply", action="store_true", help="Create accounts; default is dry run.")
    parser.add_argument("--modes", default="practice,assessment")
    parser.add_argument("--course", dest="course_code")
    parser.add_argument("--limit", type=int, default=500)
    parser.add_argument("--out")
    parser.add_argument("--confirm-host")
    return parser


def _csv_contents(rows) -> str:
    from io import StringIO

    output = StringIO(newline="")
    writer = csv.writer(output)
    writer.writerow(["username", "temporaryPassword", "patientName", "mrn", "course", "mode"])
    for row in rows:
        writer.writerow([
            row.username,
            row.temporary_password,
            row.patient_name,
            row.mrn,
            row.course_code,
            row.mode,
        ])
    return output.getvalue()


async def _run(args: argparse.Namespace, output_path: Path | None) -> int:
    modes = tuple(dict.fromkeys(item.strip() for item in args.modes.split(",") if item.strip()))
    if not modes or any(mode not in {"practice", "assessment"} for mode in modes):
        print("--modes must contain practice and/or assessment.")
        return 2

    host = urlparse(settings.DATABASE_URL).hostname or ""
    print(f"Database host: {host}")
    if host not in {"localhost", "127.0.0.1", "db"} and args.confirm_host != host:
        print("Refusing database host; pass --confirm-host with the exact host to proceed.")
        return 2

    if args.apply and output_path is None:
        print("--out is required with --apply.")
        return 2
    if output_path is not None and not output_path.parent.exists():
        print("Output directory does not exist.")
        return 2
    if output_path is not None and output_path.exists():
        print("Refusing to overwrite an existing output file.")
        return 2

    async with AsyncSessionLocal() as db:
        result = await provision_patient_logins(
            db,
            apply=args.apply,
            modes=modes,
            course_code=args.course_code,
            limit=args.limit,
        )
        if args.apply:
            await log_event(
                db,
                action="portal.logins_provisioned",
                entity_type="portal_logins",
                details={
                    "eligible": result.eligible,
                    "created": result.created,
                    "skipped_claimed": result.skipped_claimed,
                    "skipped_case_masters": result.skipped_case_masters,
                    "skipped_inactive_course": result.skipped_inactive_course,
                    "remaining": result.remaining,
                },
            )
            created_file = False
            try:
                assert output_path is not None
                with output_path.open("x", newline="", encoding="utf-8") as output:
                    output.write(_csv_contents(result.rows))
                created_file = True
                if os.name != "nt":
                    os.chmod(output_path, 0o600)
                await db.commit()
            except Exception:
                if created_file:
                    output_path.unlink(missing_ok=True)
                raise
        else:
            await db.rollback()

    print(
        "Counts: "
        f"eligible={result.eligible}, created={result.created}, "
        f"skipped_claimed={result.skipped_claimed}, "
        f"skipped_case_masters={result.skipped_case_masters}, "
        f"skipped_inactive_course={result.skipped_inactive_course}, remaining={result.remaining}"
    )
    if args.apply:
        print(f"Credentials file written: {output_path}")
        print("This file contains temporary passwords. Distribute it securely and delete it afterward.")
    else:
        print("Planned usernames: " + ", ".join(row.username for row in result.rows))
    return 0


def main() -> None:
    parser = _parser()
    args = parser.parse_args()
    if args.limit < 1 or args.limit > 500:
        parser.error("--limit must be between 1 and 500.")
    output_path = Path(args.out).expanduser() if args.out else None
    try:
        raise SystemExit(asyncio.run(_run(args, output_path)))
    except SystemExit:
        raise
    except Exception as error:
        parser.error(f"Provisioning failed ({type(error).__name__}).")


if __name__ == "__main__":
    main()
