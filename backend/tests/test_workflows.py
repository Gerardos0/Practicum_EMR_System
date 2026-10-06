import pytest

DEMO = "practicum-demo"


async def login(client, email: str, password: str = DEMO):
    response = await client.post("/api/v1/auth/login", data={"username": email, "password": password})
    assert response.status_code == 200, response.text
    body = response.json()
    return {"Authorization": f"Bearer {body['access_token']}"}, body


async def course_id(client, headers, code: str) -> str:
    response = await client.get("/api/v1/courses", headers=headers)
    assert response.status_code == 200, response.text
    match = next(item for item in response.json() if item["code"] == code)
    return match["id"]


async def patient_by_mrn(client, headers, course: str, role: str, mrn: str) -> dict:
    response = await client.get("/api/v1/patients", headers=headers, params={"course_id": course, "role": role})
    assert response.status_code == 200, response.text
    return next(row["patient"] for row in response.json() if row["patient"]["mrn"] == mrn)


@pytest.mark.asyncio
async def test_login_rejects_non_utep_email(client):
    response = await client.post("/api/v1/auth/login", data={"username": "ada@example.com", "password": "whatever"})
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_me_returns_frontend_role_shape(client):
    headers, body = await login(client, "daniel.reyes@miners.utep.edu")
    assert body["mustChangePassword"] is False
    roles = body["user"]["roles"]
    assert roles == [{"role": "student", "discipline": "pharmacy", "courseIds": roles[0]["courseIds"]}]
    me = await client.get("/api/v1/auth/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["fullName"] == "Daniel Reyes"


@pytest.mark.asyncio
async def test_student_cannot_see_another_students_assessment(client):
    headers, _ = await login(client, "daniel.reyes@miners.utep.edu")
    course = await course_id(client, headers, "PHAR 5320")
    listed = await client.get("/api/v1/patients", headers=headers, params={"course_id": course, "role": "student"})
    mrns = {row["patient"]["mrn"] for row in listed.json()}
    assert "TR-20001" in mrns
    assert "TR-10057-ST" not in mrns

    instructor, _ = await login(client, "gerardo.sillas@utep.edu")
    sam = await patient_by_mrn(client, instructor, course, "instructor", "TR-10057-ST")
    denied = await client.get(f"/api/v1/patients/{sam['id']}", headers=headers, params={"role": "student"})
    assert denied.status_code == 403


@pytest.mark.asyncio
async def test_student_advances_encounter_but_cannot_reset(client):
    headers, _ = await login(client, "daniel.reyes@miners.utep.edu")
    course = await course_id(client, headers, "PHAR 5320")
    rosa = await patient_by_mrn(client, headers, course, "student", "TR-20001")
    blocked = await client.patch(
        f"/api/v1/patients/{rosa['id']}/status",
        headers=headers,
        params={"role": "student"},
        json={"lifecycle": "Inactive"},
    )
    assert blocked.status_code == 403
    moved = await client.patch(
        f"/api/v1/patients/{rosa['id']}/status",
        headers=headers,
        params={"role": "student"},
        json={"encounter": "In progress"},
    )
    assert moved.status_code == 200
    assert moved.json()["status"]["encounter"] == "In progress"
    reset = await client.post(f"/api/v1/patients/{rosa['id']}/reset", headers=headers, params={"role": "student"})
    assert reset.status_code == 403


@pytest.mark.asyncio
async def test_instructor_reset_restores_practice_chart(client):
    headers, _ = await login(client, "gerardo.sillas@utep.edu")
    course = await course_id(client, headers, "PHAR 5320")
    rosa = await patient_by_mrn(client, headers, course, "instructor", "TR-20001")
    await client.patch(
        f"/api/v1/patients/{rosa['id']}/status",
        headers=headers,
        params={"role": "instructor"},
        json={"encounter": "Checked out"},
    )
    reset = await client.post(f"/api/v1/patients/{rosa['id']}/reset", headers=headers, params={"role": "instructor"})
    assert reset.status_code == 204
    again = await client.get(f"/api/v1/patients/{rosa['id']}", headers=headers, params={"role": "instructor"})
    assert again.json()["status"]["encounter"] == "Checked in"
    assert any(med["name"] == "Lisinopril" for med in again.json()["medications"])


@pytest.mark.asyncio
async def test_note_sign_version_and_cosign(client):
    student, _ = await login(client, "daniel.reyes@miners.utep.edu")
    instructor, _ = await login(client, "gerardo.sillas@utep.edu")
    course = await course_id(client, student, "PHAR 5320")
    rosa = await patient_by_mrn(client, student, course, "student", "TR-20001")
    created = await client.post(
        f"/api/v1/patients/{rosa['id']}/notes",
        headers=student,
        params={"role": "student"},
        json={"templateId": "pharmacy_mtm", "discipline": "pharmacy"},
    )
    assert created.status_code == 200, created.text
    note_id = created.json()["id"]
    saved = await client.patch(
        f"/api/v1/notes/{note_id}",
        headers=student,
        params={"role": "student"},
        json={"expectedVersion": 1, "content": {"reason": "Blood pressure follow-up"}},
    )
    assert saved.status_code == 200
    assert saved.json()["version"] == 2
    stale = await client.patch(
        f"/api/v1/notes/{note_id}",
        headers=student,
        params={"role": "student"},
        json={"expectedVersion": 1, "content": {"reason": "stale"}},
    )
    assert stale.status_code == 409
    signed = await client.post(
        f"/api/v1/notes/{note_id}/sign",
        headers=student,
        params={"role": "student"},
        json={"expectedVersion": 2},
    )
    assert signed.status_code == 200
    assert signed.json()["status"] == "signed"

    sam = await patient_by_mrn(client, instructor, course, "instructor", "TR-10057-ST")
    meds = {item["name"] for item in sam["medications"]}
    assert meds == {"Metformin", "Multivitamin"}
    queue = await client.get("/api/v1/review-queue", headers=instructor, params={"course_id": course, "role": "instructor"})
    assert queue.status_code == 200
    pending = next(item for item in queue.json() if item["patient"]["mrn"] == "TR-10057-ST")
    denied = await client.post(
        f"/api/v1/notes/{pending['note']['id']}/cosign",
        headers=student,
        params={"role": "student"},
        json={"comment": "no"},
    )
    assert denied.status_code == 403
    cosigned = await client.post(
        f"/api/v1/notes/{pending['note']['id']}/cosign",
        headers=instructor,
        params={"role": "instructor"},
        json={"comment": "Plan is appropriate."},
    )
    assert cosigned.status_code == 200, cosigned.text
    assert cosigned.json()["status"] == "cosigned"
    assert cosigned.json()["cosignedByName"] == "Gerardo Sillas"


@pytest.mark.asyncio
async def test_return_and_resubmit(client):
    instructor, _ = await login(client, "gerardo.sillas@utep.edu")
    sam_headers, _ = await login(client, "sam.torres@miners.utep.edu")
    course = await course_id(client, instructor, "PHAR 5320")
    queue = await client.get("/api/v1/review-queue", headers=instructor, params={"course_id": course, "role": "instructor"})
    pending = next(item["note"] for item in queue.json() if item["note"]["status"] == "pending_review")
    returned = await client.post(
        f"/api/v1/notes/{pending['id']}/return",
        headers=instructor,
        params={"role": "instructor"},
        json={"comment": "Address adherence."},
    )
    assert returned.status_code == 200
    assert returned.json()["status"] == "returned"
    resigned = await client.post(
        f"/api/v1/notes/{pending['id']}/sign",
        headers=sam_headers,
        params={"role": "student"},
        json={"expectedVersion": returned.json()["version"]},
    )
    assert resigned.status_code == 200, resigned.text
    assert resigned.json()["status"] == "pending_review"


@pytest.mark.asyncio
async def test_roster_import_and_audit(client):
    headers, _ = await login(client, "gerardo.sillas@utep.edu")
    course = await course_id(client, headers, "PHAR 5320")
    imported = await client.post(
        f"/api/v1/courses/{course}/roster/import",
        headers=headers,
        params={"role": "instructor"},
        json={
            "discipline": "pharmacy",
            "rows": [{"fullName": "New Student", "email": "new.student@miners.utep.edu", "universityId": "800999999"}],
        },
    )
    assert imported.status_code == 200, imported.text
    assert imported.json()["added"] == 1
    assert imported.json()["temporaryPasswords"][0]["email"] == "new.student@miners.utep.edu"
    again = await client.post(
        f"/api/v1/courses/{course}/roster/import",
        headers=headers,
        params={"role": "instructor"},
        json={
            "discipline": "pharmacy",
            "rows": [{"fullName": "New Student", "email": "new.student@miners.utep.edu", "universityId": "800999999"}],
        },
    )
    assert again.json()["alreadyEnrolled"] == 1
    student, _ = await login(client, "daniel.reyes@miners.utep.edu")
    hidden = await client.get("/api/v1/audit", headers=student, params={"course_id": course, "role": "student"})
    assert hidden.status_code == 403
    audit = await client.get("/api/v1/audit", headers=headers, params={"course_id": course, "role": "instructor"})
    assert audit.status_code == 200
    actions = {item["action"] for item in audit.json()}
    assert "roster.import" in actions
    assert "chart.view" in actions


@pytest.mark.asyncio
async def test_instructor_assigns_and_unassigns_assessment_copy(client):
    instructor, _ = await login(client, "gerardo.sillas@utep.edu")
    student, me = await login(client, "daniel.reyes@miners.utep.edu")
    course = await course_id(client, instructor, "PHAR 5320")
    source = await patient_by_mrn(client, instructor, course, "instructor", "TR-10057-AR")

    blocked = await client.post(
        "/api/v1/patients",
        headers=student,
        params={"course_id": course, "role": "student"},
        json={"sourcePatientId": source["id"], "ownerId": me["user"]["id"]},
    )
    assert blocked.status_code == 403

    assigned = await client.post(
        "/api/v1/patients",
        headers=instructor,
        params={"course_id": course, "role": "instructor"},
        json={"sourcePatientId": source["id"], "ownerId": me["user"]["id"]},
    )
    assert assigned.status_code == 200, assigned.text
    body = assigned.json()
    assert body["ownerId"] == me["user"]["id"]
    listed = await client.get("/api/v1/patients", headers=student, params={"course_id": course, "role": "student"})
    assert body["id"] in {row["patient"]["id"] for row in listed.json()}

    again = await client.post(
        "/api/v1/patients",
        headers=instructor,
        params={"course_id": course, "role": "instructor"},
        json={"sourcePatientId": source["id"], "ownerId": me["user"]["id"]},
    )
    assert again.status_code == 409

    removed = await client.delete(
        f"/api/v1/patients/{body['id']}",
        headers=instructor,
        params={"role": "instructor"},
    )
    assert removed.status_code == 204
    after = await client.get("/api/v1/patients", headers=student, params={"course_id": course, "role": "student"})
    assert body["id"] not in {row["patient"]["id"] for row in after.json()}

    reassigned = await client.post(
        "/api/v1/patients",
        headers=instructor,
        params={"course_id": course, "role": "instructor"},
        json={"sourcePatientId": source["id"], "ownerId": me["user"]["id"]},
    )
    assert reassigned.status_code == 200, reassigned.text
