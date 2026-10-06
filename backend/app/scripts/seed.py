"""Demo courses, users, and charts."""
import argparse
import asyncio
import getpass
import os
import uuid
from datetime import date, datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.orm import selectinload

import app.models  # noqa: F401
from app.core.config import settings
from app.core.security import hash_password
from app.db.session import AsyncSessionLocal, engine
from app.models.audit import AuditEvent
from app.models.clinical import (
    Allergy,
    Appointment,
    ClinicalNote,
    Course,
    NoteComment,
    CourseMembership,
    Encounter,
    LabResult,
    Medication,
    Patient,
    Problem,
    Referral,
    Vital,
)
from app.models.user import Discipline, Permission, Role, User
from app.services.access import ROLE_PERMISSIONS
from app.services.charts import chart_snapshot

NS = uuid.UUID("8f3c1a2e-6b4d-4e7a-9c11-2d5e6f708192")


def sid(key: str) -> uuid.UUID:
    return uuid.uuid5(NS, key)


DISCIPLINES = {
    "pharmacy": "Pharmacy",
    "physical_therapy": "Physical Therapy",
    "occupational_therapy": "Occupational Therapy",
    "speech_language_pathology": "Speech-Language Pathology",
    "nursing": "Nursing",
}

PERMISSIONS = {
    "patient:create": "Create a patient chart",
    "patient:update_status": "Change lifecycle, encounter, or care-setting status",
    "patient:reset_practice": "Restore a practice chart to its starting state",
    "encounter:advance": "Advance the encounter status during a visit",
    "note:author": "Write and sign a clinical note",
    "note:cosign": "Co-sign or return a student note",
    "referral:create": "Write a referral",
    "roster:import": "Import or remove students on a course roster",
    "audit:view": "Review the audit trail",
}


def _demo_password() -> str | None:
    if os.environ.get("SEED_DEMO_PASSWORD"):
        return os.environ["SEED_DEMO_PASSWORD"]
    if settings.ENVIRONMENT == "production":
        return None
    return "practicum-demo"


async def seed(admin_email: str | None, admin_password: str | None) -> None:
    async with AsyncSessionLocal() as db:
        permissions = await _upsert_permissions(db)
        disciplines = await _upsert_disciplines(db)
        roles = await _upsert_roles(db, permissions)
        await _drop_obsolete(db)
        await _seed_courses_and_people(db, roles, disciplines, _demo_password())
        if admin_email and admin_password:
            await _ensure_admin(db, roles["admin"], admin_email, admin_password)
        await db.commit()
    print(f"Seeded {len(PERMISSIONS)} permissions, {len(DISCIPLINES)} disciplines, {len(ROLE_PERMISSIONS)} roles.")


async def _upsert_permissions(db) -> dict[str, Permission]:
    existing = {row.code: row for row in (await db.scalars(select(Permission))).all()}
    for code, description in PERMISSIONS.items():
        if code not in existing:
            row = Permission(code=code, description=description)
            db.add(row)
            existing[code] = row
    await db.flush()
    return existing


async def _upsert_disciplines(db) -> dict[str, Discipline]:
    existing = {row.code: row for row in (await db.scalars(select(Discipline))).all()}
    for code, name in DISCIPLINES.items():
        if code not in existing:
            row = Discipline(code=code, name=name)
            db.add(row)
            existing[code] = row
    await db.flush()
    return existing


async def _upsert_roles(db, permissions: dict[str, Permission]) -> dict[str, Role]:
    existing = {
        row.code: row
        for row in (await db.scalars(select(Role).options(selectinload(Role.permissions)))).all()
    }
    names = {
        "student": "Student",
        "instructor": "Instructor",
        "admin": "Administrator",
        "front_desk": "Front Desk",
        "patient": "Patient",
    }
    for code, perm_codes in ROLE_PERMISSIONS.items():
        role = existing.get(code)
        if role is None:
            role = Role(code=code, name=names[code])
            db.add(role)
            existing[code] = role
            await db.flush()
        await db.refresh(role, attribute_names=["permissions"])
        role.permissions = [permissions[item] for item in perm_codes]
    await db.flush()
    return existing


async def _drop_obsolete(db) -> None:
    for role in (await db.scalars(select(Role))).all():
        if role.code not in ROLE_PERMISSIONS:
            await db.delete(role)
    for perm in (await db.scalars(select(Permission))).all():
        if perm.code not in PERMISSIONS:
            await db.delete(perm)
    all_disciplines = (await db.scalars(select(Discipline))).all()
    stale = [row.id for row in all_disciplines if row.code not in DISCIPLINES]
    if stale:
        await db.execute(update(User).where(User.discipline_id.in_(stale)).values(discipline_id=None))
        for row in all_disciplines:
            if row.code not in DISCIPLINES:
                await db.delete(row)
    await db.flush()


async def _seed_courses_and_people(db, roles, disciplines, password: str | None) -> None:
    if password is None:
        return
    phar = await _course(db, "PHAR 5320", "Pharmacotherapy Skills Lab", "Fall 2026", "SOAP-note-rubric.pdf")
    pt = await _course(db, "PHYT 6310", "Clinical Practice I", "Fall 2026", "PT-daily-note-rubric.pdf")
    hashed = hash_password(password)
    daniel = await _person(db, "daniel.reyes@miners.utep.edu", "Daniel", "Reyes", "800123456", "4412", hashed)
    clarissa = await _person(db, "clarissa.dominguez@miners.utep.edu", "Clarissa", "Dominguez", "800654321", "9087", hashed)
    gerardo = await _person(db, "gerardo.sillas@utep.edu", "Gerardo", "Sillas", None, "2260", hashed)
    joe = await _person(db, "joe.mota@utep.edu", "Joe", "Mota", None, "5521", hashed)
    ana = await _person(db, "ana.rios@miners.utep.edu", "Ana", "Rios", "800111111", None, hashed)
    sam = await _person(db, "sam.torres@miners.utep.edu", "Sam", "Torres", "800222222", None, hashed)
    luis = await _person(db, "luis.ortega@miners.utep.edu", "Luis", "Ortega", "800333333", None, hashed)
    if roles["admin"] not in gerardo.roles:
        gerardo.roles.append(roles["admin"])
    pharmacy = disciplines["pharmacy"]
    therapy = disciplines["physical_therapy"]
    await _member(db, daniel, phar, roles["student"], pharmacy)
    await _member(db, clarissa, phar, roles["student"], pharmacy)
    await _member(db, ana, phar, roles["student"], pharmacy)
    await _member(db, sam, phar, roles["student"], pharmacy)
    await _member(db, luis, pt, roles["student"], therapy)
    await _member(db, gerardo, phar, roles["instructor"], None)
    await _member(db, gerardo, pt, roles["instructor"], None)
    await _member(db, joe, phar, roles["instructor"], None)
    await _charts(db, phar, pt, ana, sam, luis, gerardo)
    await _more_demo(db, phar, daniel, clarissa, ana, gerardo, pharmacy, therapy)


async def _course(db, code: str, title: str, term: str, rubric: str) -> Course:
    course = await db.scalar(select(Course).where(Course.code == code))
    if course is None:
        course = Course(code=code, title=title, term=term, rubric_file_name=rubric)
        db.add(course)
        await db.flush()
    return course


async def _person(db, email, first, last, university_id, phone, hashed) -> User:
    user = await db.scalar(select(User).options(selectinload(User.roles)).where(User.email == email))
    if user is None:
        user = User(
            email=email,
            first_name=first,
            last_name=last,
            university_id=university_id,
            phone_last4=phone,
            hashed_password=hashed,
            must_change_password=False,
            is_active=True,
        )
        db.add(user)
        await db.flush()
    await db.refresh(user, attribute_names=["roles"])
    return user


async def _member(db, user: User, course: Course, role: Role, discipline: Discipline | None) -> None:
    found = await db.scalar(
        select(CourseMembership).where(
            CourseMembership.user_id == user.id,
            CourseMembership.course_id == course.id,
            CourseMembership.role_id == role.id,
        )
    )
    if found is None:
        db.add(
            CourseMembership(
                user_id=user.id,
                course_id=course.id,
                role_id=role.id,
                discipline_id=discipline.id if discipline else None,
            )
        )


async def _ensure_admin(db, admin_role: Role, email: str, password: str) -> None:
    user = await db.scalar(select(User).options(selectinload(User.roles)).where(User.email == email.strip().lower()))
    if user:
        print(f"Admin {email} already exists -- skipped.")
        return
    db.add(
        User(
            email=email.strip().lower(),
            first_name="Admin",
            last_name="User",
            hashed_password=hash_password(password),
            must_change_password=False,
            roles=[admin_role],
        )
    )


async def _charts(db, phar: Course, pt: Course, ana: User, sam: User, luis: User, gerardo: User) -> None:
    if await db.scalar(select(Patient).where(Patient.mrn == "TR-20001")):
        return
    pharmacy = await db.scalar(select(Discipline).where(Discipline.code == "pharmacy"))
    rosa = _patient(
        mrn="TR-20001", first="Rosa", last="Villalobos", preferred="Rosie", dob="1958-07-02", sex="Female",
        pronouns="she/her", course=phar, mode="practice", case_key="practice_a", label="Test Patient A",
        cc="Blood pressure check and medication review.",
        hpi="68-year-old female with hypertension here for a 3-month follow-up. Reports occasional ankle swelling in the evenings.",
        lifecycle="Active", encounter_status="Checked in", care="Outpatient",
        family="Sister: stroke at 70.", surgical="Cholecystectomy (2004).", social="Widowed, lives alone. Former smoker, quit 2001.",
        encounter_type="Office visit",
    )
    rosa.allergies.append(Allergy(substance="Sulfa drugs", reaction="Rash", severity="mild"))
    rosa.medications.extend([
        Medication(name="Lisinopril", dose="10 mg", route="PO", frequency="Once daily", indication="Hypertension"),
        Medication(name="Amlodipine", dose="5 mg", route="PO", frequency="Once daily", indication="Hypertension"),
    ])
    rosa.problems.append(Problem(code="I10", description="Essential hypertension", since="2012"))
    rosa.labs.extend([
        LabResult(name="Potassium", value="4.6", unit="mmol/L", reference_range="3.5–5.1", collected_at=date(2026, 9, 10)),
        LabResult(name="Serum creatinine", value="1.1", unit="mg/dL", reference_range="0.6–1.1", collected_at=date(2026, 9, 10)),
    ])
    rosa.vitals.extend([
        Vital(label="BP", value="146/88 mmHg"), Vital(label="Pulse", value="72 bpm"),
        Vital(label="SpO₂", value="97%"), Vital(label="Weight", value="71 kg"),
    ])
    marcus = _patient(
        mrn="TR-20002", first="Marcus", last="Hill", preferred=None, dob="1992-01-19", sex="Male", pronouns=None,
        course=pt, mode="practice", case_key="practice_b", label="Test Patient B",
        cc="Right knee stiffness 6 weeks after ACL reconstruction.",
        hpi="34-year-old male, 6 weeks post right ACL reconstruction. Pain 3/10 with stairs. Walking without crutches.",
        lifecycle="Active", encounter_status="Scheduled", care="Outpatient", program="Plan of care active",
        family="Noncontributory.", surgical="Right ACL reconstruction (Aug 2026).", social="Recreational soccer player. Office job.",
        encounter_type="PT visit #4",
    )
    marcus.medications.append(Medication(name="Ibuprofen", dose="400 mg", route="PO", frequency="Every 8 hours as needed", indication="Knee pain"))
    marcus.problems.append(Problem(description="Status post right ACL reconstruction", since="2026-08"))
    marcus.vitals.extend([Vital(label="BP", value="122/78 mmHg"), Vital(label="Pulse", value="64 bpm")])
    einstein_ana = _t2dm(phar, ana, "TR-10057-AR")
    einstein_sam = _t2dm(phar, sam, "TR-10057-ST")
    linh = _patient(
        mrn="TR-10088-LO", first="Linh", last="Nguyen", preferred=None, dob="1981-05-30", sex="Female",
        pronouns="she/her", course=pt, mode="assessment", case_key="case_lbp", owner=luis,
        cc="Low back pain for 3 weeks after lifting boxes.",
        hpi="45-year-old female with low back pain radiating to the right buttock, worse with sitting. No numbness or bowel/bladder changes.",
        lifecycle="Active", encounter_status="Checked in", care="Outpatient",
        family="Noncontributory.", surgical="None.", social="Warehouse supervisor. Walks 3x/week.",
        encounter_type="PT evaluation",
    )
    linh.allergies.append(Allergy(substance="Codeine", reaction="Nausea", severity="mild"))
    linh.medications.append(Medication(name="Naproxen", dose="220 mg", route="PO", frequency="Twice daily", indication="Back pain"))
    linh.problems.append(Problem(code="M54.50", description="Low back pain, unspecified"))
    linh.vitals.extend([Vital(label="BP", value="118/74 mmHg"), Vital(label="Pulse", value="70 bpm")])
    for chart in (rosa, marcus, einstein_ana, einstein_sam, linh):
        db.add(chart)
    await db.flush()
    for practice in (rosa, marcus):
        await db.refresh(
            practice,
            attribute_names=["allergies", "medications", "problems", "labs", "vitals", "encounter"],
        )
        practice.snapshot = chart_snapshot(practice)
    signed = datetime(2026, 9, 22, 15, 40, tzinfo=timezone.utc)
    note = ClinicalNote(
        patient_id=einstein_sam.id,
        encounter_id=einstein_sam.encounter.id,
        template_id="pharmacy_mtm",
        author_id=sam.id,
        discipline_id=pharmacy.id,
        mode="assessment",
        status="pending_review",
        version=4,
        content={
            "reason": "Diabetes follow-up, elevated home glucose.",
            "med_experience": "Takes metformin in the morning, forgets ~2x/week. No cost issues.",
            "objective": "A1C 10.5%, FBG 212, SCr 0.9, eGFR 92. BP 138/86.",
            "dtp": "Needs additional therapy: A1C far above goal on metformin monotherapy at low dose. Adherence: missed doses.",
            "rationale": "A1C >10% on low-dose metformin; renal function allows titration.",
            "recommendations": "1. Increase metformin to 1000 mg twice daily over 4 weeks.\n2. Discuss adding a second agent.",
            "followup": "Recheck A1C in 3 months.",
        },
        diagnoses=[{"code": "E11.65", "label": "Type 2 diabetes mellitus with hyperglycemia"}],
        routed_to_id=gerardo.id,
        signed_at=signed,
        created_at=datetime(2026, 9, 22, 15, 2, tzinfo=timezone.utc),
        updated_at=signed,
    )
    db.add(note)
    db.add(Appointment(patient_id=einstein_ana.id, when=datetime(2026, 12, 15, 9, 30, tzinfo=timezone.utc), kind="Diabetes follow-up", with_whom="Pharmacy clinic"))
    db.add(Appointment(patient_id=marcus.id, when=datetime(2026, 9, 29, 14, 0, tzinfo=timezone.utc), kind="PT visit #5", with_whom="Physical Therapy"))
    await db.flush()
    db.add(AuditEvent(occurred_at=datetime(2026, 9, 22, 15, 2, 11, tzinfo=timezone.utc), actor_user_id=sam.id, action="chart.view", entity_type="patient", entity_id=str(einstein_sam.id), result="ok", course_id=phar.id))
    db.add(AuditEvent(occurred_at=datetime(2026, 9, 22, 15, 40, 2, tzinfo=timezone.utc), actor_user_id=sam.id, action="note.sign_submit", entity_type="note", entity_id=str(note.id), result="ok", course_id=phar.id))


async def _more_demo(db, phar, daniel, clarissa, ana, gerardo, pharmacy, therapy) -> None:
    rosa = await db.scalar(select(Patient).where(Patient.mrn == "TR-20001"))
    if rosa is not None and not await db.scalar(select(Appointment.id).where(Appointment.patient_id == rosa.id)):
        db.add(Appointment(
            patient_id=rosa.id,
            when=datetime(2026, 10, 20, 15, 0, tzinfo=timezone.utc),
            kind="Blood pressure follow-up",
            with_whom="Pharmacy clinic",
        ))
        db.add(Referral(
            patient_id=rosa.id,
            to_discipline_id=therapy.id,
            reason="Ankle swelling on amlodipine. Please evaluate gait and edema.",
            urgency="routine",
            created_by_id=daniel.id,
        ))

    if await db.scalar(select(Patient.id).where(Patient.mrn == "TR-20003")) is None:
        elena = _patient(
            mrn="TR-20003", first="Elena", last="Vasquez", preferred=None, dob="1976-11-02", sex="Female",
            pronouns="she/her", course=phar, mode="practice", case_key="practice_c", label="Test Patient C",
            cc="Asthma follow-up. Using her rescue inhaler most days.",
            hpi="49-year-old female with asthma since childhood. Albuterol several times a day for the past month. Wakes up short of breath twice a week. No fever.",
            lifecycle="Active", encounter_status="Scheduled", care="Outpatient",
            family="Brother: asthma.", surgical="None.", social="Teacher. No tobacco. Cat at home.",
            encounter_type="Office visit",
        )
        elena.allergies.append(Allergy(substance="Aspirin", reaction="Wheezing", severity="moderate"))
        elena.medications.extend([
            Medication(name="Albuterol", dose="2 puffs", route="Inhaled", frequency="Every 4 hours as needed", indication="Asthma"),
            Medication(name="Fluticasone", dose="110 mcg", route="Inhaled", frequency="Twice daily", indication="Asthma", adherence="Misses evening dose"),
        ])
        elena.problems.append(Problem(code="J45.30", description="Mild persistent asthma, uncomplicated", since="childhood"))
        elena.labs.append(LabResult(name="Peak flow", value="310", unit="L/min", reference_range="380–450", flag="L", collected_at=date(2026, 10, 1)))
        elena.vitals.extend([
            Vital(label="BP", value="128/76 mmHg"), Vital(label="Pulse", value="88 bpm"),
            Vital(label="SpO₂", value="96%"), Vital(label="Weight", value="64 kg"),
        ])
        db.add(elena)
        await db.flush()
        await db.refresh(elena, attribute_names=["allergies", "medications", "problems", "labs", "vitals", "encounter"])
        elena.snapshot = chart_snapshot(elena)
        db.add(Appointment(
            patient_id=elena.id,
            when=datetime(2026, 10, 28, 16, 30, tzinfo=timezone.utc),
            kind="Inhaler technique check",
            with_whom="Pharmacy clinic",
        ))

    if await db.scalar(select(Patient.id).where(Patient.mrn == "TR-10021-DR")) is None:
        helen = _patient(
            mrn="TR-10021-DR", first="Helen", last="Cho", preferred=None, dob="1954-04-18", sex="Female",
            pronouns="she/her", course=phar, mode="assessment", case_key="case_hf", owner=daniel,
            cc="More short of breath when walking to the mailbox.",
            hpi="72-year-old female with heart failure. Weight up 4 pounds in a week. Taking furosemide most mornings. Ankles swollen by evening. No chest pain.",
            lifecycle="Active", encounter_status="In progress", care="Outpatient",
            family="Father: heart failure.", surgical="Hysterectomy (2008).", social="Lives with her daughter. No tobacco.",
            encounter_type="Office visit",
        )
        helen.allergies.append(Allergy(substance="Lisinopril", reaction="Cough", severity="mild"))
        helen.medications.extend([
            Medication(name="Furosemide", dose="20 mg", route="PO", frequency="Once daily", indication="Heart failure", adherence="Skips the dose when she has plans"),
            Medication(name="Carvedilol", dose="6.25 mg", route="PO", frequency="Twice daily", indication="Heart failure"),
        ])
        helen.problems.append(Problem(code="I50.22", description="Chronic systolic heart failure", since="2019"))
        helen.labs.append(LabResult(name="BNP", value="840", unit="pg/mL", reference_range="<100", flag="H", collected_at=date(2026, 10, 2)))
        helen.vitals.extend([
            Vital(label="BP", value="108/64 mmHg"), Vital(label="Pulse", value="92 bpm"),
            Vital(label="SpO₂", value="94%"), Vital(label="Weight", value="81 kg"),
        ])
        db.add(helen)
        await db.flush()
        db.add(ClinicalNote(
            patient_id=helen.id,
            encounter_id=helen.encounter.id,
            template_id="pharmacy_mtm",
            author_id=daniel.id,
            discipline_id=pharmacy.id,
            mode="assessment",
            status="draft",
            version=2,
            content={
                "reason": "Short of breath and a 4-pound weight gain.",
                "med_experience": "Takes furosemide in the morning. Skips it when she will be out of the house.",
            },
            diagnoses=[],
        ))

    if await db.scalar(select(Patient.id).where(Patient.mrn == "TR-10030-CD")) is None:
        oscar = _patient(
            mrn="TR-10030-CD", first="Oscar", last="Nguyen", preferred=None, dob="1961-08-09", sex="Male",
            pronouns="he/him", course=phar, mode="assessment", case_key="case_statin", owner=clarissa,
            cc="Here to talk about his cholesterol medicine.",
            hpi="64-year-old male with type 2 diabetes and an LDL of 148. Not on a statin. Says a neighbor told him statins ruin your muscles. No muscle pain now.",
            lifecycle="Active", encounter_status="Checked out", care="Outpatient",
            family="Mother: stroke at 68.", surgical="None.", social="Retired bus driver. Former smoker, quit 2015.",
            encounter_type="Office visit",
        )
        oscar.medications.append(Medication(name="Metformin", dose="1000 mg", route="PO", frequency="Twice daily", indication="Type 2 diabetes"))
        oscar.problems.extend([
            Problem(code="E11.9", description="Type 2 diabetes mellitus without complications", since="2014"),
            Problem(code="E78.5", description="Hyperlipidemia, unspecified", since="2024"),
        ])
        oscar.labs.append(LabResult(name="LDL cholesterol", value="148", unit="mg/dL", reference_range="<100", flag="H", collected_at=date(2026, 9, 28)))
        oscar.vitals.extend([Vital(label="BP", value="136/82 mmHg"), Vital(label="Pulse", value="74 bpm")])
        db.add(oscar)
        await db.flush()
        returned = ClinicalNote(
            patient_id=oscar.id,
            encounter_id=oscar.encounter.id,
            template_id="pharmacy_mtm",
            author_id=clarissa.id,
            discipline_id=pharmacy.id,
            mode="assessment",
            status="returned",
            version=3,
            content={
                "reason": "Cholesterol follow-up.",
                "recommendations": "Start a statin.",
                "rationale": "LDL is high.",
            },
            diagnoses=[{"code": "E78.5", "label": "Hyperlipidemia, unspecified"}],
            routed_to_id=gerardo.id,
            signed_at=datetime(2026, 10, 3, 18, 10, tzinfo=timezone.utc),
        )
        db.add(returned)
        await db.flush()
        db.add(NoteComment(
            note_id=returned.id,
            author_id=gerardo.id,
            body="Name the statin and dose, and say why a moderate-intensity statin fits this patient.",
            kind="returned",
            created_at=datetime(2026, 10, 4, 15, 0, tzinfo=timezone.utc),
        ))

    ana_chart = await db.scalar(select(Patient).where(Patient.mrn == "TR-10057-AR"))
    if ana_chart is not None and not await db.scalar(select(ClinicalNote.id).where(ClinicalNote.patient_id == ana_chart.id, ClinicalNote.archived.is_(False))):
        done = datetime(2026, 9, 30, 17, 5, tzinfo=timezone.utc)
        db.add(ClinicalNote(
            patient_id=ana_chart.id,
            encounter_id=ana_chart.encounter.id,
            template_id="pharmacy_mtm",
            author_id=ana.id,
            discipline_id=pharmacy.id,
            mode="assessment",
            status="cosigned",
            version=5,
            content={
                "reason": "Diabetes follow-up, home glucose 180–230.",
                "recommendations": "Increase metformin to 1000 mg twice daily. Recheck A1C in 3 months.",
                "rationale": "A1C 10.5% on metformin 500 mg daily, with missed doses. Renal function is fine.",
            },
            diagnoses=[{"code": "E11.65", "label": "Type 2 diabetes mellitus with hyperglycemia"}],
            routed_to_id=gerardo.id,
            signed_at=datetime(2026, 9, 30, 16, 40, tzinfo=timezone.utc),
            cosigned_at=done,
            cosigned_by_id=gerardo.id,
            updated_at=done,
        ))


def _t2dm(course: Course, owner: User, mrn: str) -> Patient:
    chart = _patient(
        mrn=mrn, first="Albert", last="Einstein", preferred=None, dob="1969-03-14", sex="Male", pronouns="he/him",
        course=course, mode="assessment", case_key="case_t2dm", owner=owner,
        cc='Diabetes follow-up. "My sugars have been running high."',
        hpi="57-year-old male with type 2 diabetes diagnosed 10 years ago, on metformin 500 mg daily. Reports home fasting readings of 180–230 mg/dL for the past 2 months. Occasionally misses the dose. Denies hypoglycemia. Reports increased thirst.",
        lifecycle="Active", encounter_status="Checked in", care="Outpatient",
        family="Mother: type 2 diabetes. Father: hypertension.", surgical="Appendectomy (1990).",
        social="Married. Never smoker. Alcohol 2 drinks/week. No drug use. Takes a daily multivitamin.",
        encounter_type="Office visit",
    )
    chart.allergies.append(Allergy(substance="Penicillin", reaction="Hives", severity="moderate"))
    chart.medications.extend([
        Medication(name="Metformin", dose="500 mg", route="PO", frequency="Once daily", indication="Type 2 diabetes", adherence="Misses ~2 doses/week"),
        Medication(name="Multivitamin", dose="1 tablet", route="PO", frequency="Once daily", indication="Supplement"),
    ])
    chart.problems.append(Problem(code="E11.65", description="Type 2 diabetes mellitus with hyperglycemia", since="2016"))
    collected = date(2026, 9, 15)
    chart.labs.extend([
        LabResult(name="Hemoglobin A1C", value="10.5", unit="%", reference_range="4.0–5.6", flag="H", collected_at=collected),
        LabResult(name="Fasting glucose", value="212", unit="mg/dL", reference_range="70–99", flag="H", collected_at=collected),
        LabResult(name="Serum creatinine", value="0.9", unit="mg/dL", reference_range="0.7–1.3", collected_at=collected),
        LabResult(name="eGFR", value="92", unit="mL/min/1.73m²", reference_range=">60", collected_at=collected),
        LabResult(name="Potassium", value="4.2", unit="mmol/L", reference_range="3.5–5.1", collected_at=collected),
        LabResult(name="LDL cholesterol", value="96", unit="mg/dL", reference_range="<100", collected_at=collected),
    ])
    chart.vitals.extend([
        Vital(label="BP", value="138/86 mmHg"), Vital(label="Pulse", value="78 bpm"),
        Vital(label="SpO₂", value="98%"), Vital(label="Weight", value="98 kg"),
        Vital(label="Height", value="178 cm"), Vital(label="BMI", value="30.9"),
    ])
    return chart


def _patient(**kwargs) -> Patient:
    return Patient(
        mrn=kwargs["mrn"],
        first_name=kwargs["first"],
        last_name=kwargs["last"],
        preferred_name=kwargs.get("preferred"),
        dob=date.fromisoformat(kwargs["dob"]),
        sex_at_birth=kwargs["sex"],
        pronouns=kwargs.get("pronouns"),
        course_id=kwargs["course"].id,
        mode=kwargs["mode"],
        case_key=kwargs["case_key"],
        owner_id=kwargs["owner"].id if kwargs.get("owner") else None,
        practice_label=kwargs.get("label"),
        chief_complaint=kwargs["cc"],
        hpi=kwargs["hpi"],
        lifecycle=kwargs["lifecycle"],
        encounter_status=kwargs["encounter_status"],
        care_setting=kwargs["care"],
        program=kwargs.get("program"),
        family_history=kwargs["family"],
        surgical_history=kwargs["surgical"],
        social_history=kwargs["social"],
        is_training=True,
        encounter=Encounter(type=kwargs["encounter_type"], date=date(2026, 9, 22)),
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed EHR reference data")
    parser.add_argument("--admin-email", help="Create an extra admin account with this email")
    args = parser.parse_args()
    password = None
    if args.admin_email:
        password = getpass.getpass("Admin password (min 8 chars): ")
        if len(password) < 8:
            raise SystemExit("Password too short.")
        if password != getpass.getpass("Confirm password: "):
            raise SystemExit("Passwords don't match.")
    async def _run() -> None:
        await seed(args.admin_email, password)
        await engine.dispose()

    asyncio.run(_run())


if __name__ == "__main__":
    main()
