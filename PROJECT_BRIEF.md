# DIS CMOP PIV Packet Automation Project Brief

Created: 2026-06-04
Project: DIS CMOP PIV Paperwork Automation
Source: IUE mailbox email from David Lieberman, `FW: PIV Submission Paperwork`, received 2026-06-04 07:40 MST, plus 9 downloaded attachments.

## Executive Summary

Build a secure packet-prep and rejection-prevention system for DIS/IUE's CMOP onboarding workflow. The product will help coordinators prepare VA PIV and background-investigation submission packets correctly the first time by guiding candidate intake, validating required forms, enforcing attachment rules, and assembling a submission-ready packet.

The wedge is not generic form filling. The stronger product is a compliance-grade packet readiness system for VA contractor onboarding, starting with CMOP PIV packets and expanding into broader contractor onboarding compliance workflows.

## Problem

The current CMOP PIV onboarding workflow is document-heavy, manual, and brittle. A packet can be rejected for small errors: wrong date format, missing wet signatures, bad scans, mismatched candidate data across forms, incomplete OF-306 conditionals, missing Social Security card, invalid ID copies, incorrect file naming, or missing required role/investigation artifacts.

Each rejection delays onboarding, creates coordinator rework, increases candidate frustration, and risks losing staffing momentum on contract positions.

## Product Concept

A secure web application that walks a coordinator through each candidate packet, determines which forms are required for that role and investigation level, validates completed documents, and produces a clean coordinator-reviewed packet with required naming conventions and a final submission checklist.

The first version should be coordinator-led rather than fully candidate self-service. Candidate self-service can come later after the validation rules and packet model are proven.

## Primary Users

- DIS/IUE onboarding coordinators preparing candidate packets.
- Recruiting or staffing staff collecting PIV/background-investigation paperwork.
- Compliance reviewers checking packet readiness before VA submission.
- Candidates completing data intake, uploads, and required wet-signature documents.
- Future: contract managers tracking onboarding status across roles and locations.

## MVP Scope

The MVP should focus on packet quality control and submission readiness, not full HR automation.

Core MVP features:

- Candidate intake profile.
- Role-specific packet checklist.
- Investigation-level aware requirements.
- Upload area for forms, IDs, signed PDFs, and supporting artifacts.
- Cross-form consistency checks.
- OF-306 conditional-answer review.
- Wet-signature and date checks.
- ID and Social Security card requirement checks.
- Scan quality warnings.
- Required VA file naming support.
- Coordinator review dashboard.
- Final packet assembly checklist.
- Audit trail for field changes, validations, approvals, and submission status.

Out of scope for MVP:

- Direct VA submission automation.
- Fully automated legal/e-signature substitution for wet signatures.
- Replacing official VA forms without DIS approval.
- Broad recruiting CRM functionality.
- Deep HRIS integration unless a current system of record is confirmed.

## Requirements Derived From Attachments

The downloaded attachment set establishes the controlling requirements for packet preparation.

Key requirements:

- Dates must follow `MM/DD/YYYY`.
- Documents must follow required naming convention: `Station#_LastNameLast4SSN_FormName`.
- Phone-photo scans are not acceptable.
- Scans must be clear, complete, straight, and free of visible defects.
- Multi-page documents should remain as a single PDF file.
- Wet signatures in black ink are required where specified.
- Digital signatures are not acceptable for OF-306 and Self Certification where the instructions require print/sign/scan.
- Social Security card is required.
- Candidate ID documentation must meet packet rules.
- BI forms are role-specific but use the same underlying fillable PDF template.
- The three BI PDFs differ mainly by the prefilled position field.
- Prefilled contract, station, COR/CO, company, and investigation fields in government forms should be preserved unless an authorized coordinator overrides them.
- OF-306 requires special conditional logic because some answers trigger required explanations or additional data.

## Source Artifacts

Downloaded source files are stored under `source-attachments/`. Extracted text is stored under `extracted-text/`. PDF form fields are inventoried in `form-field-inventory.json`.

Substantive attachments reviewed:

- `Security Packet Instructions.docx.pdf`: controlling candidate instructions and packet rules.
- `Example of Acceptable Forms of Identification Poster.pdf`: identity-document reference.
- `BI Form- PharmacyTechnician.pdf`: role-specific Contractor Background Investigation Request form.
- `BI Form-Shipper Packer (1).pdf`: role-specific Contractor Background Investigation Request form.
- `BI For- Pharmacist.pdf`: role-specific Contractor Background Investigation Request form.
- `Self Certification of Continuous Service_20250212.pdf`: break-in-service certification form.
- `OF 306 August 2023.pdf`: Declaration for Federal Employment with high-risk conditional fields.
- `VET PRO APP.doc`: VetPro enrollment/request form.

The ninth attachment is an inline `image.png`, likely a DIS logo or email signature image, not a substantive packet requirement.

## Functional Requirements

### Candidate Intake

- Capture full legal name, including first, middle, last, and suffix.
- Support no-middle-name handling with form-specific output: `NMN` for packet instructions and `No Middle Name` where OF-306 requires it.
- Capture SSN, last four SSN, DOB, place of birth, citizenship, other names used, phone number, address, email, gender, occupation, and VetPro metadata.
- Enforce date format and required fields before packet can move to ready status.
- Reuse candidate data across all forms to prevent mismatch.

### Role And Packet Setup

- Support initial roles: Pharmacy Technician, Shipper/Packer, and Pharmacist.
- Select station, contract/task order, contract company, POC, COR/CO details, contract end date, VISN/station, investigation level, and work location/facility.
- Preserve source-form defaults such as station `766`, contract `36C7702600004`, contract end date `12/31/30`, investigation level `Tier 1`, and contractor company values unless authorized override is needed.
- Support future roles by adding role-specific packet templates.

### Form Support

- Generate or prefill VA Form OF-306.
- Generate or prefill role-specific VHA Contractor Background Investigation Request forms.
- Generate or prefill Self Certification of Continuous Service.
- Generate or prefill VetPro enrollment/request form.
- Protect fields that should remain coordinator-only or prefilled from the contract packet.
- Allow final upload of signed scanned PDFs where wet signatures are required.

### Validation Engine

- Block readiness when required fields are blank.
- Compare name, DOB, SSN/last-four, citizenship, ID data, and email across packet artifacts.
- Require OF-306 question 8 to be explicitly answered.
- Model OF-306 conditional questions and require triggered explanations or fields.
- Enforce exactly one break-in-service option on Self Certification.
- Require date-left-federal-employment when the applicable break option is selected.
- Flag missing CO/COR signature requirements.
- Flag foreign-born, permanent resident, or foreign national cases for additional review when three-consecutive-years-in-US rules may apply.

### Identity And Document Handling

- Require two forms of ID.
- Require at least one primary identity source document.
- Require Social Security card per packet instructions.
- Validate that IDs are not expired or cancelled where expiration data is available.
- Confirm ID names match candidate packet data or route mismatch to coordinator review.
- Store uploaded documents securely with role-based access and audit logs.

### Packet Assembly

- Generate file names using `Station#_LastNameLast4SSN_FormName`.
- Produce coordinator-ready packet output with required artifacts grouped by candidate, role, and investigation level.
- Track packet status: draft, candidate action needed, coordinator review, ready, submitted, rejected, corrected, accepted.
- Record submission date and status follow-up windows.

## Nonfunctional Requirements

Because the system handles PII, SSNs, IDs, and background-investigation paperwork, it needs strict security controls from day one.

Security requirements:

- Encrypt data at rest and in transit.
- Restrict access by role.
- Maintain audit logs for access, edits, exports, validation failures, and approvals.
- Avoid storing plaintext SSNs where not required.
- Store last-four separately for naming and search.
- Use short-lived signed links for uploads and downloads.
- Define retention and deletion policy before production launch.
- Avoid unencrypted packet email from the application unless an approved encryption/password workflow is built.

Compliance and operational requirements:

- Keep official form versions traceable.
- Track form template version used for each packet.
- Preserve source attachments as requirements artifacts.
- Separate candidate-editable fields from coordinator-only contract fields.
- Support manual override with required reason and audit entry.

## Recommended Build Strategy

### Phase 1: Coordinator-Only Packet Readiness MVP

- Candidate record creation.
- Role and investigation-level checklist.
- Upload collection.
- Manual review workflow.
- Basic validation rules.
- Required naming helper.
- Packet status dashboard.
- Final coordinator checklist.

### Phase 2: PDF Extraction And Cross-Document Validation

- Extract fields from fillable PDFs.
- Compare extracted data against candidate profile.
- Detect missing dates, signatures, and required fields where technically feasible.
- Add role-specific BI form handling.
- Create formal field map from `form-field-inventory.json`.

### Phase 3: Guided Generation And Candidate Portal

- Candidate intake wizard.
- Guided form generation.
- Candidate upload portal.
- Save/resume workflow.
- Optional e-signature workflow only if DIS confirms legal/process acceptability.
- Stronger audit and reviewer approval flows.

## Success Metrics

- Reduced VA packet rejection rate.
- Faster coordinator packet-prep time.
- Fewer missing documents.
- Fewer date, signature, scan-quality, and naming errors.
- Clear packet status visibility for every candidate.
- Repeatable onboarding workflow across initial CMOP roles.
- Measurable reduction in coordinator rework.

## Risks

- Handling SSNs and identity documents raises security and compliance burden.
- Official government forms may change and require version management.
- Wet-signature requirements limit full automation.
- OCR/signature/scan-quality detection may produce false confidence if over-automated too early.
- VA submission process may remain email-based and require careful encryption workflow design.
- Candidate self-service could introduce support burden before coordinator workflows are stable.

## Open Questions

- What DIS email address should replace the placeholder return address in instructions?
- Does DIS want the system to submit packets directly, or only prepare reviewer-ready packets?
- What is the system of record for candidate/recruiting data today?
- Who signs the CO/COR sections, and how is that signature obtained?
- What encryption/password-protection process does DIS currently use for VA submissions?
- What weekly or monthly packet volume should the MVP support?
- Should candidate-facing form filling use original AcroForms, generated controlled forms, or both?
- Can DIS provide a redacted accepted packet and a redacted rejected packet for validation-rule tuning?

## Recommended Next Steps

1. Confirm with David that the immediate objective is a packet-prep MVP focused on rejection reduction.
2. Ask for the current DIS process owner and one sample completed/redacted accepted packet.
3. Turn `form-field-inventory.json` into a formal field map with data owner, validation rule, editability, and target output file.
4. Draft a clickable prototype of the candidate intake and coordinator review flow.
5. Produce an MVP estimate with build phases, hosting/security assumptions, and integration options.
