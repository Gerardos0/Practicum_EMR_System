"""Visit steps, a second encounter, and the three account types."""

import pytest

from tests.test_workflows import course_id, login, patient_by_mrn

DEMO = "practicum-demo"


@pytest.mark.asyncio
async def test_patient_signup_is_closed(client):
    signup = await client.post(
        "/api/v1/auth/patient-signup",
        json={"code": "ABCD-EFGH", "username": "rosa.patient", "password": "patient-pass-123"},
    )
    email = await client.post(
        "/api/v1/auth/patient-signup-by-email",
        json={"email": "rosa.chart@example.com", "password": "patient-pass-123"},
    )
    assert signup.status_code == 403
    assert email.status_code == 403
    response = await client.post(
        "/api/v1/auth/login",
        data={"username": "patient.demo@example.com", "password": DEMO},
    )
    assert response.status_code == 403
    assert "password" not in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_student_cannot_skip_a_visit_step(client):
    headers, _ = await login(client, "daniel.reyes@miners.utep.edu")
    course = await course_id(client, headers, "PHAR 5320")
    rosa = await patient_by_mrn(client, headers, course, "student", "TR-20001")
    jumped = await client.patch(
        f"/api/v1/patients/{rosa['id']}/status",
        headers=headers,
        params={"role": "student"},
        json={"encounter": "Closed"},
    )
    assert jumped.status_code == 409


@pytest.mark.asyncio
async def test_check_in_records_who_did_it(client):
    student, body = await login(client, "daniel.reyes@miners.utep.edu")
    instructor, _ = await login(client, "gerardo.sillas@utep.edu")
    course = await course_id(client, student, "PHAR 5320")
    rosa = await patient_by_mrn(client, student, course, "student", "TR-20001")
    prepared = await client.patch(
        f"/api/v1/patients/{rosa['id']}/status",
        headers=instructor,
        params={"role": "instructor"},
        json={"encounter": "Scheduled"},
    )
    assert prepared.status_code == 200, prepared.text
    checked = await client.patch(
        f"/api/v1/patients/{rosa['id']}/status",
        headers=student,
        params={"role": "student"},
        json={"encounter": "Checked in"},
    )
    assert checked.status_code == 200, checked.text
    visit = next(item for item in checked.json()["visits"] if item["current"])
    assert visit["checkedInByName"] == body["user"]["fullName"]
    assert visit["checkedInAt"]


@pytest.mark.asyncio
async def test_second_visit_keeps_the_first_encounter(client):
    instructor, _ = await login(client, "gerardo.sillas@utep.edu")
    course = await course_id(client, instructor, "PHAR 5320")
    rosa = await patient_by_mrn(client, instructor, course, "instructor", "TR-20001")
    checked_out = await client.patch(
        f"/api/v1/patients/{rosa['id']}/status",
        headers=instructor,
        params={"role": "instructor"},
        json={"encounter": "Checked out"},
    )
    assert checked_out.status_code == 200, checked_out.text
    first_id = checked_out.json()["encounter"]["id"]

    opened = await client.post(
        f"/api/v1/patients/{rosa['id']}/encounters",
        headers=instructor,
        params={"role": "instructor"},
    )
    assert opened.status_code == 200, opened.text
    body = opened.json()
    assert body["status"]["encounter"] == "Scheduled"
    assert body["encounter"]["id"] != first_id
    assert any(visit["id"] == first_id and visit["status"] == "Checked out" for visit in body["visits"])
    assert any(visit["id"] == body["encounter"]["id"] and visit["current"] for visit in body["visits"])


@pytest.mark.asyncio
async def test_assessment_checkout_waits_for_instructor_signoff(client):
    student, student_body = await login(client, "daniel.reyes@miners.utep.edu")
    instructor, _ = await login(client, "gerardo.sillas@utep.edu")
    course = await course_id(client, student, "PHAR 5320")
    charts = await client.get("/api/v1/patients", headers=student, params={"course_id": course, "role": "student"})
    assert charts.status_code == 200, charts.text
    owner_id = student_body["user"]["id"]
    owned = next(
        row["patient"]
        for row in charts.json()
        if row["patient"]["mode"] == "assessment" and row["patient"].get("ownerId") == owner_id
    )
    moved = await client.patch(
        f"/api/v1/patients/{owned['id']}/status",
        headers=instructor,
        params={"role": "instructor"},
        json={"encounter": "In progress"},
    )
    assert moved.status_code == 200, moved.text
    blocked = await client.patch(
        f"/api/v1/patients/{owned['id']}/status",
        headers=student,
        params={"role": "student"},
        json={"encounter": "Checked out"},
    )
    assert blocked.status_code == 409
    assert "co-signs" in blocked.json()["detail"]
