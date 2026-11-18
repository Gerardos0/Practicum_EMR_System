import csv
import re
import uuid
from datetime import datetime, timedelta, timezone
from io import StringIO

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.core.security import hash_password, verify_password
from app.models.audit import AuditEvent
from app.models.clinical import Course, Patient, PortalInvite
from app.models.user import Role, User
from app.services.portal_accounts import hash_code, normalize_login, username_to_email
from tests.test_workflows import course_id, login, patient_by_mrn


async def _admin_chart(client, mrn="TR-20003"):
    admin, _ = await login(client, "clarissa.dominguez@utep.edu")
    course = await course_id(client, admin, "PHAR 5320")
    patient = await patient_by_mrn(client, admin, course, "admin", mrn)
    return admin, patient


async def _invite(client, headers, patient_id):
    response = await client.post(f"/api/v1/patients/{patient_id}/portal-invite", headers=headers)
    assert response.status_code == 200, response.text
    return response.json()


async def _signup(client, code, username="rosa.patient", password="patient-pass-123"):
    return await client.post(
        "/api/v1/auth/patient-signup",
        json={"code": code, "username": username, "password": password},
    )


async def _new_patient_user(db_session, patient_id, email, *, archived_at=None, active=True):
    role = await db_session.scalar(select(Role).where(Role.code == "patient"))
    person = User(
        email=email,
        first_name="Test",
        last_name="Patient",
        hashed_password=hash_password("test-password-123"),
        must_change_password=False,
        is_active=active,
        archived_at=archived_at,
        portal_patient_id=patient_id,
        roles=[role],
    )
    db_session.add(person)
    await db_session.flush()
    return person


def test_patient_username_login_normalization_preserves_email_logins():
    assert normalize_login(" Rosa.Demo ") == "rosa.demo@patients.example.com"
    assert normalize_login(" Patient.Demo@Example.COM ") == "patient.demo@example.com"
    assert normalize_login("daniel.reyes@miners.utep.edu") == "daniel.reyes@miners.utep.edu"
    assert username_to_email("ROSA.DEMO") == "rosa.demo@patients.example.com"


@pytest.mark.asyncio
@pytest.mark.skip(reason="Patient sign-up is closed. Students, instructors, and administrators sign in.")
async def test_invite_signup_creates_patient_and_returns_portal_token(client, db_session):
    admin, patient = await _admin_chart(client)
    invite = await _invite(client, admin, patient["id"])
    assert len(invite["code"].replace("-", "")) == 8
    assert invite["expiresAt"]

    response = await _signup(client, invite["code"])
    assert response.status_code == 200, response.text
    token = response.json()
    assert token["mustChangePassword"] is False
    assert token["user"]["email"] == "rosa.patient@patients.example.com"
    assert [role["role"] for role in token["user"]["roles"]] == ["patient"]

    person = await db_session.scalar(
        select(User).options(selectinload(User.roles)).where(User.email == "rosa.patient@patients.example.com")
    )
    assert person is not None
    assert person.portal_patient_id is not None
    assert person.must_change_password is False
    stored_invite = await db_session.scalar(
        select(PortalInvite).where(PortalInvite.code_hash == hash_code(invite["code"]))
    )
    assert stored_invite is not None and stored_invite.used_at is not None
    assert stored_invite.used_by_user_id == person.id

    portal = await client.get("/api/v1/portal", headers={"Authorization": f"Bearer {token['access_token']}"})
    assert portal.status_code == 200, portal.text
    assert portal.json()["patient"]["mrn"] == patient["mrn"]


@pytest.mark.asyncio
async def test_email_signup_links_chart_or_creates_login_without_chart(client, db_session):
    admin, patient_out = await _admin_chart(client)
    patient = await db_session.get(Patient, uuid.UUID(patient_out["id"]))
    patient.portal_email = "rosa.chart@example.com"
    await db_session.flush()

    response = await client.post(
        "/api/v1/auth/patient-signup-by-email",
        json={"email": " Rosa.Chart@Example.com ", "password": "patient-pass-123"},
    )
    assert response.status_code == 200, response.text
    token = response.json()
    assert token["user"]["email"] == "rosa.chart@example.com"
    portal = await client.get("/api/v1/portal", headers={"Authorization": f"Bearer {token['access_token']}"})
    assert portal.status_code == 200, portal.text
    assert portal.json()["patient"]["mrn"] == patient_out["mrn"]

    signed_in = await client.post(
        "/api/v1/auth/login",
        data={"username": "rosa.chart@example.com", "password": "patient-pass-123"},
    )
    assert signed_in.status_code == 200, signed_in.text
    signed_in_portal = await client.get(
        "/api/v1/portal", headers={"Authorization": f"Bearer {signed_in.json()['access_token']}"}
    )
    assert signed_in_portal.status_code == 200, signed_in_portal.text
    assert signed_in_portal.json()["patient"]["mrn"] == patient_out["mrn"]

    missing = await client.post(
        "/api/v1/auth/patient-signup-by-email",
        json={"email": "no.chart@example.com", "password": "patient-pass-123"},
    )
    assert missing.status_code == 200, missing.text
    empty_token = missing.json()
    assert empty_token["user"]["email"] == "no.chart@example.com"
    empty_headers = {"Authorization": f"Bearer {empty_token['access_token']}"}
    empty_chart = await client.get("/api/v1/portal", headers=empty_headers)
    assert empty_chart.status_code == 200, empty_chart.text
    assert empty_chart.json() == {
        "patient": None,
        "labs": [],
        "last_visit": {"date": None, "type": None, "summary": None},
        "insurance": {"payer": None, "member_id": None, "group_number": None},
        "prescribed_medications": [],
        "medication_list": [],
    }
    empty_intake = await client.get("/api/v1/portal/intake", headers=empty_headers)
    assert empty_intake.status_code == 200, empty_intake.text
    assert empty_intake.json()["identity"]["mrn"] is None
    assert empty_intake.json()["editable"] is True
    prechart_data = empty_intake.json()["data"]
    prechart_data["phone"] = "915-555-0142"
    prechart_data["confirmedAccurate"] = True
    saved = await client.put("/api/v1/portal/intake", headers=empty_headers, json=prechart_data)
    assert saved.status_code == 200, saved.text
    queue = await client.get("/api/v1/users/prechart-intakes", headers=admin)
    assert queue.status_code == 200, queue.text
    submission = next(row for row in queue.json() if row["email"] == "no.chart@example.com")
    assert submission["data"]["phone"] == "915-555-0142"


@pytest.mark.asyncio
@pytest.mark.skip(reason="Patient sign-up is closed. Students, instructors, and administrators sign in.")
async def test_invalid_expired_used_and_revoked_codes_are_generic(client, db_session):
    admin, patient = await _admin_chart(client)
    missing = await _signup(client, "NOPE-NOPE")
    assert missing.status_code == 400
    assert missing.json()["detail"] == "That code isn't valid or has expired."

    expired = await _invite(client, admin, patient["id"])
    stored = await db_session.scalar(select(PortalInvite).where(PortalInvite.code_hash == hash_code(expired["code"])))
    stored.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
    await db_session.flush()
    response = await _signup(client, expired["code"], "expired.user")
    assert response.status_code == 400
    assert response.json()["detail"] == "That code isn't valid or has expired."

    # A second invite revokes the first even if the first has already expired.
    replacement = await _invite(client, admin, patient["id"])
    newer = await _invite(client, admin, patient["id"])
    assert replacement["code"] != newer["code"]
    old = await _signup(client, replacement["code"], "revoked.user")
    assert old.status_code == 400
    assert old.json()["detail"] == "That code isn't valid or has expired."


@pytest.mark.asyncio
@pytest.mark.skip(reason="Patient sign-up is closed. Students, instructors, and administrators sign in.")
async def test_used_invite_and_claimed_or_ineligible_chart_fail_generically(client, db_session):
    admin, patient = await _admin_chart(client)
    invite = await _invite(client, admin, patient["id"])
    first = await _signup(client, invite["code"], "claim.user")
    assert first.status_code == 200, first.text
    second = await _signup(client, invite["code"], "another.user")
    assert second.status_code == 400
    assert second.json()["detail"] == "That code isn't valid or has expired."
    assert await db_session.scalar(
        select(func.count(User.id)).where(User.email == "claim.user@patients.example.com")
    ) == 1


@pytest.mark.asyncio
@pytest.mark.skip(reason="Patient sign-up is closed. Students, instructors, and administrators sign in.")
async def test_chart_claimed_after_invite_and_ineligible_chart_are_generic(client, db_session):
    admin, patient = await _admin_chart(client)
    invite = await _invite(client, admin, patient["id"])
    claimed = await _new_patient_user(db_session, uuid.UUID(patient["id"]), "claimed@patients.example.com")
    response = await _signup(client, invite["code"], "claimed.second")
    assert response.status_code == 400
    assert response.json()["detail"] == "That code isn't valid or has expired."

    claimed.is_active = False
    await db_session.flush()
    renewed = await _invite(client, admin, patient["id"])
    chart = await db_session.get(Patient, uuid.UUID(patient["id"]))
    chart.mode = "case"
    await db_session.flush()
    ineligible = await _signup(client, renewed["code"], "ineligible.user")
    assert ineligible.status_code == 400
    assert ineligible.json()["detail"] == "That code isn't valid or has expired."


@pytest.mark.asyncio
@pytest.mark.skip(reason="Patient sign-up is closed. Students, instructors, and administrators sign in.")
async def test_signup_validates_username_password_and_checks_taken_name_after_code(client, db_session):
    admin, patient = await _admin_chart(client)
    invite = await _invite(client, admin, patient["id"])
    for username, password in (("bad", "valid-password-123"), ("valid.name", "short"), ("same.name", "same.name")):
        response = await _signup(client, invite["code"], username, password)
        assert response.status_code == 422, response.text

    role = await db_session.scalar(select(Role).where(Role.code == "patient"))
    db_session.add(User(
        email="taken.name@patients.example.com",
        first_name="Taken",
        last_name="Name",
        hashed_password=hash_password("another-password"),
        is_active=True,
        must_change_password=False,
        roles=[role],
    ))
    await db_session.flush()
    unavailable = await _signup(client, "NOPE-NOPE", "taken.name", "a-good-password")
    assert unavailable.status_code == 400
    assert unavailable.json()["detail"] == "That code isn't valid or has expired."
    response = await _signup(client, invite["code"], "taken.name", "a-good-password")
    assert response.status_code == 409
    assert response.json()["detail"] == "That username is taken. Try another."


@pytest.mark.asyncio
@pytest.mark.skip(reason="Patient sign-up is closed. Students, instructors, and administrators sign in.")
async def test_invite_admin_only_case_claim_and_rotation(client, db_session):
    admin, patient = await _admin_chart(client)
    student, _ = await login(client, "daniel.reyes@miners.utep.edu")
    denied = await client.post(f"/api/v1/patients/{patient['id']}/portal-invite", headers=student)
    assert denied.status_code == 403

    first = await _invite(client, admin, patient["id"])
    second = await _invite(client, admin, patient["id"])
    old_row = await db_session.scalar(select(PortalInvite).where(PortalInvite.code_hash == hash_code(first["code"])))
    assert old_row.revoked_at is not None
    assert (await _signup(client, first["code"], "rotated.user")).status_code == 400
    assert (await _signup(client, second["code"], "active.user")).status_code == 200
    claimed = await client.post(f"/api/v1/patients/{patient['id']}/portal-invite", headers=admin)
    assert claimed.status_code == 409
    assert claimed.json()["detail"] == "This chart already has a portal login. Reset its password instead."


@pytest.mark.asyncio
async def test_case_master_cannot_receive_invite_or_grant(client, db_session):
    admin, patient_out = await _admin_chart(client)
    patient = await db_session.get(Patient, __import__("uuid").UUID(patient_out["id"]))
    patient.mode = "case"
    await db_session.flush()
    invite = await client.post(f"/api/v1/patients/{patient.id}/portal-invite", headers=admin)
    grant = await client.post(
        "/api/v1/users/portal-access",
        headers=admin,
        json={"email": "case.patient@example.com", "fullName": "Case Patient", "patientId": str(patient.id)},
    )
    assert invite.status_code == 409
    assert grant.status_code == 409


@pytest.mark.asyncio
@pytest.mark.skip(reason="Patient sign-up is closed. Students, instructors, and administrators sign in.")
async def test_signup_throttles_ten_failed_codes_per_ip(client, db_session):
    for _ in range(10):
        response = await _signup(client, "INVALID1", "unknown.name")
        assert response.status_code == 400
    response = await _signup(client, "INVALID1", "unknown.name")
    assert response.status_code == 429
    assert response.json()["detail"] == "Too many attempts. Try again in 15 minutes."


@pytest.mark.asyncio
async def test_portal_access_grant_rejects_nonpatient_archived_and_claimed_accounts(client, db_session):
    admin, patient = await _admin_chart(client)
    for email in (
        "daniel.reyes@miners.utep.edu",
        "gerardo.sillas@utep.edu",
        "clarissa.dominguez@utep.edu",
    ):
        response = await client.post(
            "/api/v1/users/portal-access",
            headers=admin,
            json={"email": email, "fullName": "Test", "patientId": patient["id"]},
        )
        assert response.status_code == 409
        assert response.json()["detail"] == "That email already belongs to another account."

    archived = await _new_patient_user(
        db_session,
        uuid.UUID(patient["id"]),
        "archived@patients.example.com",
        archived_at=datetime.now(timezone.utc),
    )
    archived_response = await client.post(
        "/api/v1/users/portal-access",
        headers=admin,
        json={"email": archived.email, "fullName": "Archived", "patientId": patient["id"]},
    )
    assert archived_response.status_code == 409
    assert archived.archived_at is not None

    await _new_patient_user(db_session, uuid.UUID(patient["id"]), "owner@patients.example.com")
    claimed_response = await client.post(
        "/api/v1/users/portal-access",
        headers=admin,
        json={"email": "new.login@example.com", "fullName": "New Login", "patientId": patient["id"]},
    )
    assert claimed_response.status_code == 409


@pytest.mark.asyncio
@pytest.mark.skip(reason="Patient sign-up is closed. Students, instructors, and administrators sign in.")
async def test_bulk_provision_dry_run_apply_idempotency_csv_and_password_change(client, db_session):
    admin, _ = await login(client, "clarissa.dominguez@utep.edu")
    soft_deleted = await db_session.scalar(select(Patient).where(Patient.mrn == "TR-20003"))
    soft_deleted.deleted_at = datetime.now(timezone.utc)
    course = await db_session.scalar(select(Course).where(Course.code == "PHAR 5320"))
    course.status = "ended"
    await db_session.flush()
    inactive_preview = await client.post(
        "/api/v1/users/portal-logins/provision", headers=admin, json={"dryRun": True}
    )
    assert inactive_preview.status_code == 200
    assert inactive_preview.json()["skippedInactiveCourse"] >= 1
    assert "TR-20003" not in {row["mrn"] for row in inactive_preview.json()["rows"]}
    course.status = "active"
    await db_session.flush()

    before = await db_session.scalar(select(func.count(User.id)).where(User.email.like("%@patients.example.com")))
    preview = await client.post(
        "/api/v1/users/portal-logins/provision",
        headers=admin,
        json={"dryRun": True, "limit": 500},
    )
    assert preview.status_code == 200, preview.text
    plan = preview.json()
    assert plan["eligible"] >= 1
    assert plan["created"] == 0
    assert plan["rows"]
    assert all("temporaryPassword" not in row for row in plan["rows"])
    assert "temporaryPassword" not in preview.text
    assert await db_session.scalar(
        select(func.count(User.id)).where(User.email.like("%@patients.example.com"))
    ) == before
    assert "TR-20001" not in {row["mrn"] for row in plan["rows"]}
    assert "TR-20003" not in {row["mrn"] for row in plan["rows"]}
    assert all(row["mode"] in {"practice", "assessment"} for row in plan["rows"])
    limited = await client.post(
        "/api/v1/users/portal-logins/provision",
        headers=admin,
        json={"dryRun": True, "courseCode": "PHAR 5320", "limit": 1},
    )
    assert limited.status_code == 200
    assert len(limited.json()["rows"]) == min(1, limited.json()["eligible"])
    assert all(row["courseCode"] == "PHAR 5320" for row in limited.json()["rows"])

    denied = await client.post(
        "/api/v1/users/portal-logins/provision",
        headers=(await login(client, "daniel.reyes@miners.utep.edu"))[0],
        json={"dryRun": True},
    )
    assert denied.status_code == 403
    invalid_limit = await client.post(
        "/api/v1/users/portal-logins/provision", headers=admin, json={"limit": 501}
    )
    assert invalid_limit.status_code == 422

    applied = await client.post(
        "/api/v1/users/portal-logins/provision",
        headers=admin,
        json={"dryRun": False, "limit": 500},
    )
    assert applied.status_code == 200, applied.text
    assert applied.headers["content-type"].startswith("text/csv")
    assert applied.headers["cache-control"] == "no-store"
    assert "attachment; filename=\"patient-logins.csv\"" == applied.headers["content-disposition"]
    reader = csv.DictReader(StringIO(applied.text))
    assert reader.fieldnames == [
        "username", "temporaryPassword", "patientName", "mrn", "course", "mode"
    ]
    rows = list(reader)
    assert len(rows) <= 500
    assert len(rows) == plan["eligible"] - plan["remaining"]
    assert rows
    assert len({row["username"] for row in rows}) == len(rows)
    assert len({row["temporaryPassword"] for row in rows}) == len(rows)
    for row in rows:
        assert re.fullmatch(r"[a-z0-9][a-z0-9._-]{3,29}", row["username"])
        assert row["temporaryPassword"].isalnum() and len(row["temporaryPassword"]) == 12
        person = await db_session.scalar(
            select(User).options(selectinload(User.roles)).where(
                User.email == username_to_email(row["username"])
            )
        )
        assert person is not None and person.must_change_password is True
        assert [role.code for role in person.roles] == ["patient"]
        assert person.hashed_password != row["temporaryPassword"]
        assert verify_password(row["temporaryPassword"], person.hashed_password)

    repeated = await client.post(
        "/api/v1/users/portal-logins/provision",
        headers=admin,
        json={"dryRun": False, "limit": 500},
    )
    assert repeated.status_code == 200
    repeated_rows = list(csv.DictReader(StringIO(repeated.text)))
    assert repeated_rows == []
    assert await db_session.scalar(
        select(func.count(User.id)).where(User.email.like("%@patients.example.com"))
    ) == before + len(rows)
    provision_event = await db_session.scalar(
        select(AuditEvent).where(AuditEvent.action == "portal.logins_provisioned")
    )
    assert provision_event is not None
    assert provision_event.details["created"] == len(rows)
    assert "password" not in str(provision_event.details).lower()

    first, second = rows[:2]
    first_headers, _ = await login(client, first["username"], first["temporaryPassword"])
    blocked = await client.get("/api/v1/portal", headers=first_headers)
    assert blocked.status_code == 403
    changed = await client.post(
        "/api/v1/auth/change-password",
        headers=first_headers,
        json={"currentPassword": first["temporaryPassword"], "newPassword": "patient-changed-123"},
    )
    assert changed.status_code == 204, changed.text
    first_portal = await client.get("/api/v1/portal", headers=first_headers)
    assert first_portal.status_code == 200, first_portal.text
    assert first_portal.json()["patient"]["mrn"] == first["mrn"]
    second_headers, _ = await login(client, second["username"], second["temporaryPassword"])
    second_portal = await client.get("/api/v1/portal", headers=second_headers)
    assert second_portal.status_code == 403
    assert first["mrn"] not in str(second_portal.json())


@pytest.mark.asyncio
@pytest.mark.skip(reason="Patient sign-up is closed. Students, instructors, and administrators sign in.")
async def test_signup_audit_events_never_store_codes_or_passwords(client, db_session):
    admin, patient = await _admin_chart(client)
    invite = await _invite(client, admin, patient["id"])
    await _signup(client, "INVALID1", "audit.fail")
    await _signup(client, invite["code"], "audit.signup", "secret-pass-123")
    events = (await db_session.scalars(
        select(AuditEvent).where(AuditEvent.action.in_([
            "portal.invite_created", "portal.signup", "portal.signup_failed", "portal.logins_provisioned"
        ]))
    )).all()
    serialized = " ".join(str(event.details or {}) for event in events)
    assert invite["code"].replace("-", "") not in serialized
    assert "secret-pass-123" not in serialized
    assert all(event.details is None or "password" not in str(event.details).lower() for event in events)
    actions = {event.action for event in events}
    assert {"portal.invite_created", "portal.signup", "portal.signup_failed"} <= actions
