# DIS CMOP PIV Paperwork Automation

Created: 2026-06-04 08:00 MST
Source: IUE mailbox email from David Lieberman, `FW: PIV Submission Paperwork`, received 2026-06-04 07:40 MST.

## Source Summary

David asked whether we can automate much of the CMOP staffing contract recruiting, onboarding, and paper-processing workflow. The pain point is precision: if a single data point is wrong, the VA rejects the packet and the hiring process is delayed.

Forwarded attachment set reviewed:

- Source files saved under `source-attachments/`.
- Extracted text saved under `extracted-text/`.
- PDF field inventory saved in `form-field-inventory.json`.
- Detailed attachment review saved in `ATTACHMENT_REVIEW.md`.
- Detailed project brief saved in `PROJECT_BRIEF.md`.

- `Security Packet Instructions.docx.pdf`
- `Example of Acceptable Forms of Identification Poster.pdf`
- `BI Form- PharmacyTechnician.pdf`
- `BI Form-Shipper Packer (1).pdf`
- `BI For- Pharmacist.pdf`
- `Self Certification of Continuous Service_20250212.pdf`
- `OF 306 August 2023.pdf`
- `VET PRO APP.doc`

Note: the email also included an inline `image.png`, likely a signature/embedded image, not a packet requirement.

## Problem Statement

DIS needs a controlled intake and packet-preparation workflow for CMOP candidates that reduces VA rejections by ensuring every candidate submits the correct role-specific forms, completed with consistent data, compliant dates, proper signatures, valid ID documentation, correct scans, and required file naming.

## Primary Users

- Candidate: completes personal data, answers form questions, uploads IDs and signed forms.
- DIS workforce coordinator / recruiter: launches packets, monitors completion, reviews exceptions, sends packets onward.
- Contractor POC / compliance reviewer: validates packet readiness and submission history.
- VA PerSec team: downstream recipient of complete encrypted packets, not necessarily a system user for MVP.

## Attachment Analysis

1. `Security Packet Instructions.docx.pdf`
   - Two-page candidate instruction sheet.
   - Defines the required return path, file naming convention, scanning expectations, no-phone-picture rule, and Social Security card requirement.
   - Requires candidate email address, full legal name, NMN if no middle name, DOB, SSN, birthplace, citizenship, phone number, other names used, and current address.
   - States that OF-306 and Self Certification must be completed digitally first, then printed and signed in black ink; digital signature is not acceptable for those forms.
   - Flags OF-306 question 8 as commonly missed, and notes 7b/7c are conditional based on 7a.

2. `Example of Acceptable Forms of Identification Poster.pdf`
   - Two-page identity-source reference.
   - Supports the ID validation rules for primary identity documents, secondary identity documents, valid/non-expired status, and REAL ID distinction.
   - Confirms Social Security card is an acceptable supporting identity document and is separately mandatory per packet instructions.

3. BI Contractor Request PDFs
   - Files: `BI Form- PharmacyTechnician.pdf`, `BI Form-Shipper Packer (1).pdf`, `BI For- Pharmacist.pdf`.
   - Each is a 3-page fillable AcroForm with 51 detected fields.
   - The extracted visible text is identical across all three forms; the role difference is in prefilled form field `Text7`: `Pharmacy Technician`, `Shipper/Packer`, or `Pharmacist`.
   - Common prefilled defaults found in the forms include station `766`, contract `36C7702600004`, contract end date `12/31/30`, investigation level `Tier 1`, contract company `All In Solutions`, VA CO/COR contacts, and contractor POC values.
   - Product requirement: preserve these prefilled defaults, allow coordinator override where authorized, and prevent candidates from changing contract/COR/company fields unless explicitly delegated.

4. `OF 306 August 2023.pdf`
   - Three-page fillable AcroForm with 56 detected fields.
   - Requires name, SSN, birthplace, citizenship/country if non-citizen, DOB, phone, sex, Selective Service, military service, criminal/court-martial/debarment/firing/delinquency questions, relatives, signature, and date.
   - Product requirement: model conditional questions explicitly and block packet readiness when required yes/no or follow-up fields are blank.

5. `Self Certification of Continuous Service_20250212.pdf`
   - One-page fillable AcroForm with 10 detected fields.
   - Requires exactly one break-in-service option, print name, SSN, signature, completion date, and date-left-federal-employment where applicable.
   - Product requirement: enforce mutually exclusive break options and date validation before allowing final packet assembly.

6. `VET PRO APP.doc`
   - One-page Word enrollment form.
   - Captures requesting facility, facility/location/hire status, occupation, other occupation, full name, SSN, DOB, email, phone, and instructions for entering occupation examples like GS-06 Pharmacy Technician.
   - Product requirement: convert to a controlled fillable template or generate a replacement official-looking document after DIS confirms acceptable output format.

## Confirmed Workflow Requirements

1. Candidate packet setup
   - Select role/position: Pharmacy Technician, Shipper Packer, Pharmacist, and future roles.
   - Select station number, contract/task order, contract company, POC, COR/CO details, contract end date, VISN/station, investigation level, and work location/facility.
   - Support investigation levels: SAC, Tier 1, Tier 2, Tier 4.
   - Flag that PIV-I contracts under 180 days require at least SAC and full PIV badges over 180 days require at least Tier 1.
   - Require PDT justification upload when Tier 2 or Tier 4 is selected.

2. Candidate data intake
   - Capture full legal name with first, middle, last, suffix rules.
   - If no middle name, enforce required representation depending on form context: `NMN` for packet instructions and `No Middle Name` for OF-306 question 1.
   - Capture SSN, last four SSN, date of birth, place of birth, citizenship, other names used, phone numbers, address, email, gender, occupation, and VetPro facility/request metadata.
   - Enforce `MM/DD/YYYY` for all dates.
   - Reuse candidate data across all forms to prevent mismatch.

3. Form completion support
   - Generate or prefill VA Form OF-306.
   - Generate or prefill role-specific VHA Contractor Background Investigation Request forms.
   - Generate or prefill Self Certification of Continuous Service.
   - Generate or prefill VetPro enrollment form.
   - Preserve pre-completed fields in source documents; candidate should only complete allowed blank fields.
   - Require manual wet signature in black ink where specified; digital signatures are not acceptable for OF-306 and Self Certification.

4. Validation rules
   - Required fields cannot be blank.
   - Names, DOB, SSN/last-four, citizenship, ID data, and email must match across all packet artifacts.
   - OF-306 question 8 must be explicitly answered.
   - OF-306 questions 7b and 7c are required only when question 7a is answered yes/no as applicable.
   - Self Certification must have exactly one break-in-service option selected.
   - If prior federal employment break is selected, date-left-federal-employment must be present.
   - Contractor Request packet must include CO/COR signature or be marked not ready.
   - Foreign-born / permanent resident / foreign national cases must be flagged for the 3-consecutive-years-in-US requirement.

5. Identity document handling
   - Require two forms of ID.
   - At least one ID must be from the primary identity source document list.
   - One form of ID must be a Social Security card per the packet instructions.
   - IDs must be valid, not expired, not cancelled, and match packet information.
   - Acceptable primary examples include U.S. passport, U.S. passport card, REAL ID driver's license, REAL ID state ID, permanent resident card, employment authorization, military ID, PIV card, and U.S. visa.
   - Acceptable secondary examples include Social Security card, U.S. birth certificate, certificate of birth abroad, certificate of naturalization, voter registration card, Canadian driver's license, Native American tribal document, and U.S. Coast Guard merchant mariner card.

6. Scan/upload quality controls
   - Reject or warn on phone photos where possible; instructions require scanner/scanning application output.
   - Require PDF output for signed/scanned forms.
   - Prompt candidate to scan straight, complete pages with no visible marks, borders, or creases.
   - Ensure multi-page documents remain a single PDF file.

7. File naming and packet assembly
   - Enforce naming convention: `Station#_LastNameLast4SSN_FormName`.
   - Examples: `766_Jones1234_REQ`, `766_Jones1234_306`, `766_Jones1234_SC`.
   - Build a packet checklist by role and investigation level.
   - Package final artifacts for coordinator review.
   - Track whether packet was submitted, rejected, corrected, or accepted.

8. Submission workflow
   - Candidate-completed documents are returned to DIS-controlled email/workflow.
   - Complete packets are submitted to `VHAWMCPerSecContractor@va.gov` encrypted or password protected.
   - Subject line for new request packets should follow: `New Request Packet - Contracted Company 36C00000D0000 / 999-C202222`.
   - Subject line for status requests should follow: `Status Request - Contracted Company 36C00000D0000 / 999-C20222 submitted on 00/00/0000`.
   - Avoid duplicate submissions; status follow-up window is 5 to 10 business days.
   - Additions should go to the assigned VA team member once a packet has been assigned.

## MVP Recommendation

Build a secure web workflow with candidate portal, coordinator dashboard, packet builder, validation engine, and PDF generation/fill support. The first useful MVP should not try to fully automate VA submission; it should prevent bad packets from reaching submission.

MVP scope:

- Candidate intake wizard with save/resume.
- Role-based packet checklist for Pharmacy Technician, Shipper Packer, and Pharmacist.
- Shared candidate profile powering all forms.
- Validation before download/submission readiness.
- Upload collection for signed PDFs and IDs.
- Coordinator review queue with packet status.
- Generated ZIP/PDF bundle using required file names.
- Audit log of field changes, validation failures, reviewer approvals, and submission dates.

## Data/Security Requirements

- Treat all candidate records and attachments as sensitive PII.
- Encrypt data at rest and in transit.
- Restrict access by role.
- Log access and exports.
- Avoid storing plaintext SSNs where not needed; store last-four separately for naming.
- Use short-lived signed links for document upload/download.
- Define retention/deletion rules with DIS before launch.
- Do not email unencrypted packets from the application unless encryption/password workflow is explicitly designed and approved.

## Open Questions

- What is the contract station number and CMOP locations for initial launch?
- Which DIS email address should replace `EMAIL ADDRESS` in the instructions?
- Does DIS want the system to submit packets to VA directly, or only prepare reviewer-ready packets?
- What system of record currently holds candidate/recruiting data?
- Are candidates external users, internal DIS staff, or both?
- Confirm whether DIS wants candidate-facing form filling against original AcroForms, generated replacements, or both.
- Should we preserve the exact VA PDFs and fill fields, or generate clean controlled versions for candidate review plus final official PDFs?
- What encryption/password-protection process does DIS currently use for submissions to VA?
- What are the expected packet volumes per week/month?
- Who signs CO/COR sections and how is that signature obtained?

## Suggested Next Steps

1. Confirm with David that the immediate objective is a packet-prep MVP focused on rejection reduction.
2. Ask for the current DIS process owner and one sample completed/redacted accepted packet.
3. Turn `form-field-inventory.json` into a formal field map with data owner, validation rule, candidate/coordinator editability, and target output file.
4. Draft a clickable prototype of the candidate intake and coordinator review flow.
5. Produce an MVP estimate with build phases, hosting/security assumptions, and integration options.
