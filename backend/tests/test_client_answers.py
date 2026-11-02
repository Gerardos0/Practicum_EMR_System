import io

import pytest
from docx import Document
from openpyxl import load_workbook

from app.services.case_import import template_workbook
from app.services.reference_data import lexicomp_status, search_cpt
from app.services.rubric_import import guide_from_upload
from tests.test_workflows import course_id, login, patient_by_mrn


def test_cpt_list_has_no_prices_and_includes_office_codes():
    codes = {row["code"] for row in search_cpt("")}
    assert {"99211", "99212", "99213", "99214", "99215"} <= codes
    for row in search_cpt("99213"):
        assert set(row) == {"code", "label"}


def test_lexicomp_is_unconfigured_without_a_url(monkeypatch):
    monkeypatch.setattr("app.services.reference_data.settings.LEXICOMP_URL", None)
    status = lexicomp_status()
    assert status["configured"] is False
    assert status["url"] is None


def test_word_rubric_becomes_criteria():
    document = Document()
    document.add_heading("Subjective (4 points)", level=1)
    document.add_paragraph("Chief concern and medication experience.")
    document.add_heading("Plan (4 points)", level=1)
    document.add_paragraph("Numbered recommendations and follow-up.")
    buffer = io.BytesIO()
    document.save(buffer)
    guide = guide_from_upload("SOAP.docx", buffer.getvalue())
    assert [item["label"] for item in guide["criteria"]] == ["Subjective", "Plan"]
    assert guide["criteria"][0]["max_points"] == 4


def test_case_template_headers_match_the_importer():
    book = load_workbook(io.BytesIO(template_workbook()))
    headers = [cell.value for cell in next(book["Cases"].iter_rows(max_row=1))]
    assert headers[0] == "first_name"
    assert "allergies" in headers
    assert headers[-3:] == ["unit", "room", "bed"]


@pytest.mark.asyncio
async def test_student_archives_a_medication_and_cannot_edit_locked_diagnoses(client):
    student, _ = await login(client, "daniel.reyes@miners.utep.edu")
    course = await course_id(client, student, "PHAR 5320")
    chart = await patient_by_mrn(client, student, course, "student", "TR-20001")
    medication_id = chart["medications"][0]["id"]

    archived = await client.post(
        f"/api/v1/patients/{chart['id']}/medications/{medication_id}/discontinue",
        headers=student,
        params={"role": "student"},
    )
    assert archived.status_code == 200, archived.text
    updated = next(item for item in archived.json()["medications"] if item["id"] == medication_id)
    assert updated["status"] == "discontinued"

    removed = await client.delete(
        f"/api/v1/patients/{chart['id']}/medications/{medication_id}",
        headers=student,
        params={"role": "student"},
    )
    assert removed.status_code == 409

    mistake = await client.delete(
        f"/api/v1/patients/{chart['id']}/medications/{medication_id}",
        headers=student,
        params={"role": "student", "reason": "entered_in_error"},
    )
    assert mistake.status_code == 200, mistake.text
    assert all(item["id"] != medication_id for item in mistake.json()["medications"])

    blocked = await client.post(
        f"/api/v1/patients/{chart['id']}/problems",
        headers=student,
        params={"role": "student"},
        json={"description": "Student-added diagnosis", "code": "I10"},
    )
    assert blocked.status_code == 403


@pytest.mark.asyncio
async def test_instructor_cannot_enroll_students(client):
    instructor, _ = await login(client, "joe.mota@utep.edu")
    course = await course_id(client, instructor, "PHAR 5320")
    response = await client.post(
        f"/api/v1/courses/{course}/roster/import",
        headers=instructor,
        json={
            "discipline": "pharmacy",
            "role": "student",
            "rows": [{"fullName": "New Student", "email": "new.student2@miners.utep.edu", "universityId": "800888888"}],
        },
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_addendum_reopens_a_signed_note_for_grading(client):
    instructor, instructor_session = await login(client, "gerardo.sillas@utep.edu")
    student, me = await login(client, "daniel.reyes@miners.utep.edu")
    course = await course_id(client, instructor, "PHAR 5320")
    masters = await client.get("/api/v1/cases", headers=instructor, params={"course_id": course, "role": "instructor"})
    master = next(row for row in masters.json() if row["mrn"] == "CASE-10001")
    assigned = await client.post(
        "/api/v1/patients",
        headers=instructor,
        params={"course_id": course, "role": "instructor"},
        json={"sourcePatientId": master["id"], "ownerId": me["user"]["id"]},
    )
    assert assigned.status_code == 200, assigned.text
    created = await client.post(
        f"/api/v1/patients/{assigned.json()['id']}/notes",
        headers=student,
        params={"role": "student"},
        json={"templateId": "pharmacy_soap", "discipline": "pharmacy"},
    )
    assert created.status_code == 200, created.text
    note_id = created.json()["id"]
    routed = await client.patch(
        f"/api/v1/notes/{note_id}",
        headers=student,
        params={"role": "student"},
        json={"expectedVersion": created.json()["version"], "routedToId": instructor_session["user"]["id"]},
    )
    signed = await client.post(
        f"/api/v1/notes/{note_id}/sign",
        headers=student,
        params={"role": "student"},
        json={"expectedVersion": routed.json()["version"]},
    )
    assert signed.status_code == 200, signed.text
    cosigned = await client.post(
        f"/api/v1/notes/{note_id}/cosign",
        headers=instructor,
        params={"role": "instructor"},
        json={"comment": "Accepted."},
    )
    assert cosigned.json()["bodyLocked"] is True
    edited = await client.patch(
        f"/api/v1/notes/{note_id}",
        headers=student,
        params={"role": "student"},
        json={"expectedVersion": cosigned.json()["version"], "content": {"subjective": "Changed after signature"}},
    )
    assert edited.status_code == 409
    addendum = await client.post(
        f"/api/v1/notes/{note_id}/addenda",
        headers=student,
        params={"role": "student"},
        json={"body": "Corrected the follow-up interval."},
    )
    assert addendum.status_code == 200, addendum.text
    assert addendum.json()["status"] == "pending_review"
    assert addendum.json()["addenda"][0]["body"] == "Corrected the follow-up interval."
