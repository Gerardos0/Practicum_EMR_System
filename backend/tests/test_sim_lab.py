"""Sim Center lab check-in."""

from datetime import date

import pytest

from tests.test_workflows import course_id, login


@pytest.mark.asyncio
async def test_instructor_assigns_student_sees_mine_and_clear(client):
    instructor, _ = await login(client, "gerardo.sillas@utep.edu")
    student, student_body = await login(client, "daniel.reyes@miners.utep.edu")
    course = await course_id(client, instructor, "PHAR 5320")
    today = date.today().isoformat()
    student_id = student_body["user"]["id"]

    rooms = await client.get(
        f"/api/v1/courses/{course}/sim-lab/rooms",
        headers=instructor,
        params={"role": "instructor"},
    )
    assert rooms.status_code == 200, rooms.text
    catalog = rooms.json()
    assert any(r["number"] == "109" for r in catalog)
    assert any(r["number"] == "126" and r["bedCount"] == 10 for r in catalog)
    room_127 = next(r for r in catalog if r["number"] == "127")
    assert room_127["bedCount"] == 5
    assert room_127["bedOptions"] == ["A", "B", "C", "D", "E"]
    room_109 = next(r for r in catalog if r["number"] == "109")
    assert room_109["bedOptions"] == ["A", "B", "C", "D", "E"]
    assert room_109["softCapacity"] == 25

    denied_board = await client.get(
        f"/api/v1/courses/{course}/sim-lab/assignments",
        headers=student,
        params={"role": "student", "session_date": today},
    )
    assert denied_board.status_code == 403

    assigned = await client.post(
        f"/api/v1/courses/{course}/sim-lab/assignments",
        headers=instructor,
        params={"role": "instructor"},
        json={
            "userId": student_id,
            "roomId": room_109["id"],
            "sessionDate": today,
            "bed": "B",
            "roleLabel": "Nurse",
        },
    )
    assert assigned.status_code == 200, assigned.text
    body = assigned.json()
    assert body["room"]["number"] == "109"
    assert body["bed"] == "B"
    assert body["roleLabel"] == "Nurse"
    assert body["studentName"] == "Daniel Reyes"

    mine = await client.get(
        f"/api/v1/courses/{course}/sim-lab/mine",
        headers=student,
        params={"role": "student", "session_date": today},
    )
    assert mine.status_code == 200, mine.text
    assert len(mine.json()) == 1
    assert mine.json()[0]["room"]["number"] == "109"

    moved = await client.post(
        f"/api/v1/courses/{course}/sim-lab/assignments",
        headers=instructor,
        params={"role": "instructor"},
        json={
            "userId": student_id,
            "roomId": next(r["id"] for r in catalog if r["number"] == "106"),
            "sessionDate": today,
            "timeBlock": "9:00–10:00",
        },
    )
    assert moved.status_code == 200, moved.text
    assert moved.json()["room"]["number"] == "106"
    assert moved.json()["timeBlock"] == "9:00–10:00"
    assert moved.json()["id"] == body["id"]

    cleared = await client.post(
        f"/api/v1/courses/{course}/sim-lab/assignments/{body['id']}/clear",
        headers=instructor,
        params={"role": "instructor"},
    )
    assert cleared.status_code == 200, cleared.text

    empty = await client.get(
        f"/api/v1/courses/{course}/sim-lab/mine",
        headers=student,
        params={"role": "student", "session_date": today},
    )
    assert empty.status_code == 200
    assert empty.json() == []


@pytest.mark.asyncio
async def test_reserved_bed_cannot_be_assigned_twice(client):
    instructor, _ = await login(client, "gerardo.sillas@utep.edu")
    _, daniel = await login(client, "daniel.reyes@miners.utep.edu")
    _, peter = await login(client, "peter.parker@miners.utep.edu")
    course = await course_id(client, instructor, "PHAR 5320")
    today = date.today().isoformat()
    rooms = await client.get(
        f"/api/v1/courses/{course}/sim-lab/rooms",
        headers=instructor,
        params={"role": "instructor"},
    )
    room_109 = next(r for r in rooms.json() if r["number"] == "109")
    room_106 = next(r for r in rooms.json() if r["number"] == "106")

    first = await client.post(
        f"/api/v1/courses/{course}/sim-lab/assignments",
        headers=instructor,
        params={"role": "instructor"},
        json={"userId": daniel["user"]["id"], "roomId": room_109["id"], "sessionDate": today, "bed": "C"},
    )
    assert first.status_code == 200, first.text

    taken = await client.post(
        f"/api/v1/courses/{course}/sim-lab/assignments",
        headers=instructor,
        params={"role": "instructor"},
        json={"userId": peter["user"]["id"], "roomId": room_109["id"], "sessionDate": today, "bed": "C"},
    )
    assert taken.status_code == 409, taken.text

    other_hour = await client.post(
        f"/api/v1/courses/{course}/sim-lab/assignments",
        headers=instructor,
        params={"role": "instructor"},
        json={
            "userId": daniel["user"]["id"],
            "roomId": room_106["id"],
            "sessionDate": today,
            "bed": "A",
            "timeBlock": "9:00–10:00",
        },
    )
    assert other_hour.status_code == 200, other_hour.text
    same_hour = await client.post(
        f"/api/v1/courses/{course}/sim-lab/assignments",
        headers=instructor,
        params={"role": "instructor"},
        json={
            "userId": peter["user"]["id"],
            "roomId": room_106["id"],
            "sessionDate": today,
            "bed": "A",
            "timeBlock": "9:00–10:00",
        },
    )
    assert same_hour.status_code == 409, same_hour.text
    later = await client.post(
        f"/api/v1/courses/{course}/sim-lab/assignments",
        headers=instructor,
        params={"role": "instructor"},
        json={
            "userId": peter["user"]["id"],
            "roomId": room_106["id"],
            "sessionDate": today,
            "bed": "A",
            "timeBlock": "10:00–11:00",
        },
    )
    assert later.status_code == 200, later.text

    await client.post(
        f"/api/v1/courses/{course}/sim-lab/assignments/{other_hour.json()['id']}/clear",
        headers=instructor,
        params={"role": "instructor"},
    )
    await client.post(
        f"/api/v1/courses/{course}/sim-lab/assignments/{later.json()['id']}/clear",
        headers=instructor,
        params={"role": "instructor"},
    )
