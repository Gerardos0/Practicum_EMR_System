"""Pharmacy lab and procedure orders stay off the nursing course."""

import pytest

from tests.test_chart_phase1 import CASE, _assigned_chart
from tests.test_workflows import course_id, login


@pytest.mark.asyncio
async def test_courses_split_pharmacy_and_nursing(client):
    instructor, _ = await login(client, "gerardo.sillas@utep.edu")
    response = await client.get("/api/v1/courses", headers=instructor)
    assert response.status_code == 200, response.text
    tracks = {row["code"]: row["track"] for row in response.json()}
    assert tracks["PHAR 5320"] == "pharmacy"
    assert tracks["PHYT 6310"] == "nursing"


@pytest.mark.asyncio
async def test_pharmacy_student_enters_and_edits_orders(client):
    _, student, chart = await _assigned_chart(client)
    created = await client.post(
        f"/api/v1/patients/{chart['id']}/orders",
        headers=student,
        params={"role": "student"},
        json={"kind": "lab", "name": "Basic metabolic panel", "priority": "stat", "specimen": "Blood", "instructions": "Fasting"},
    )
    assert created.status_code == 200, created.text
    order = created.json()
    assert order["kind"] == "lab"
    assert order["status"] == "ordered"
    assert order["priority"] == "stat"
    assert order["orderedByName"]

    procedure = await client.post(
        f"/api/v1/patients/{chart['id']}/orders",
        headers=student,
        params={"role": "student"},
        json={"kind": "procedure", "name": "ECG"},
    )
    assert procedure.status_code == 200, procedure.text
    assert procedure.json()["kind"] == "procedure"
    assert procedure.json()["priority"] == "routine"

    edited = await client.patch(
        f"/api/v1/patients/{chart['id']}/orders/{order['id']}",
        headers=student,
        params={"role": "student"},
        json={"name": "Comprehensive metabolic panel", "priority": "routine", "instructions": "Morning draw"},
    )
    assert edited.status_code == 200, edited.text
    assert edited.json()["name"] == "Comprehensive metabolic panel"
    assert edited.json()["priority"] == "routine"

    cancelled = await client.patch(
        f"/api/v1/patients/{chart['id']}/orders/{order['id']}",
        headers=student,
        params={"role": "student"},
        json={"status": "cancelled"},
    )
    assert cancelled.status_code == 200, cancelled.text
    assert cancelled.json()["status"] == "cancelled"

    again = await client.patch(
        f"/api/v1/patients/{chart['id']}/orders/{order['id']}",
        headers=student,
        params={"role": "student"},
        json={"name": "Should stay cancelled"},
    )
    assert again.status_code == 409


@pytest.mark.asyncio
async def test_nursing_course_rejects_orders(client):
    instructor, _ = await login(client, "gerardo.sillas@utep.edu")
    course = await course_id(client, instructor, "PHYT 6310")
    created = await client.post(
        "/api/v1/cases",
        headers=instructor,
        params={"course_id": course, "role": "instructor"},
        json=CASE,
    )
    assert created.status_code == 200, created.text
    denied = await client.post(
        f"/api/v1/patients/{created.json()['id']}/orders",
        headers=instructor,
        params={"role": "instructor"},
        json={"kind": "lab", "name": "CBC"},
    )
    assert denied.status_code == 403, denied.text
