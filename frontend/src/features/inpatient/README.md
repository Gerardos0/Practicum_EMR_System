# inpatient

Reserved for inpatient-specific views: admission/discharge, daily progress notes,
medication administration record (MAR), and care-setting transitions.

Nothing here yet. Per the schema decision, inpatient and outpatient share one
unified encounter model, so this feature adds views on top of `encounters/`,
not a separate data model. `Patient.status.careSetting` already carries
Outpatient / Inpatient / Emergency / Discharged.
