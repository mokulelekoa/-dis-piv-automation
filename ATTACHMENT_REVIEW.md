# Attachment Review - DIS CMOP PIV Paperwork Automation

Reviewed: 2026-06-04 08:15 MST
Source: IUE email from David Lieberman, `FW: PIV Submission Paperwork`, received 2026-06-04 07:40 MST.

## Attachment Set

The email contained 9 attachments: 8 substantive packet files plus 1 inline logo image.

| Attachment | Type | Purpose | Product impact |
| --- | --- | --- | --- |
| `Security Packet Instructions.docx.pdf` | PDF instructions | Candidate-facing packet rules | Drives checklist, date format, naming, scan/signature rules, and required ID rules. |
| `Example of Acceptable Forms of Identification Poster.pdf` | PDF reference | Acceptable primary/secondary IDs | Drives ID upload categories and validation. |
| `BI Form- PharmacyTechnician.pdf` | Fillable PDF | Contractor Background Investigation Request for Pharmacy Technician | Role-specific request form; preserve prefilled contract fields. |
| `BI Form-Shipper Packer (1).pdf` | Fillable PDF | Contractor Background Investigation Request for Shipper/Packer | Same template; role field differs. |
| `BI For- Pharmacist.pdf` | Fillable PDF | Contractor Background Investigation Request for Pharmacist | Same template; role field differs. |
| `Self Certification of Continuous Service_20250212.pdf` | Fillable PDF | Candidate self-certification of federal service break | Requires one mutually exclusive option, name, SSN, wet signature, date. |
| `OF 306 August 2023.pdf` | Fillable PDF | Declaration for Federal Employment | High-risk form; requires conditional logic and wet signature. |
| `VET PRO APP.doc` | Word document | VetPro enrollment intake | Separate enrollment form; should be converted to controlled fillable workflow. |
| `image.png` | Inline PNG | DIS logo/signature image | No requirements content. |

## Cross-Attachment Rules

- All dates should be entered as `MM/DD/YYYY`.
- Candidate names must include first, middle, and last name every time; if no middle name, instructions use `NMN`, while OF-306 asks for `No Middle Name`.
- All documents returned to VA/DIS must follow `Station#_LastNameLast4SSN_FormName`, such as `766_Jones1234_REQ`, `766_Jones1234_306`, and `766_Jones1234_SC`.
- Scanned documents must be true scans or scanning-app output, not simple phone photos.
- Scans must be straight, complete, free of borders/marks/creases, and saved as PDFs.
- Multi-page documents must remain single PDF files.
- OF-306 and Self Certification must be digitally completed first, then printed, signed in black ink, scanned, and returned; digital signatures are explicitly not acceptable for those forms.
- Two forms of ID are required; one must be a Social Security card, and at least one must be from the primary identity list.
- ID documents must be valid, unexpired, uncancelled, and match packet information.

## Form-Specific Findings

### Security Packet Instructions

This is the controlling candidate instruction sheet. It defines the practical rejection-prevention rules: date format, name format, file naming, scanner quality, wet signatures, and required IDs.

Automation requirements:

- Present these rules during candidate intake, not only at final upload.
- Validate filenames before coordinator review.
- Block final readiness if signed OF-306 or Self Certification is uploaded as an image instead of PDF.
- Include explicit reminders for OF-306 question 8 and conditional questions 7b/7c.

### Acceptable Forms of Identification Poster

Primary examples include U.S. passport, passport card, REAL ID driver's license, REAL ID state ID, permanent resident card, employment authorization, military ID, PIV card, and U.S. visa.

Secondary examples include Social Security card, U.S. birth certificate, certificate of birth abroad, certificate of naturalization, voter registration card, Canadian driver's license, Native American tribal document, and U.S. Coast Guard merchant mariner card.

Automation requirements:

- Require two ID uploads.
- Require at least one primary ID.
- Require Social Security card specifically, even though it is secondary.
- Capture document type, expiration/cancelled status where applicable, and name/DOB match review.

### BI Contractor Request Forms

The three BI PDFs are fillable 3-page AcroForms with 51 detected fields each. They are the same template with different prefilled role values:

- `Pharmacist`
- `Pharmacy Technician`
- `Shipper/Packer`

Common prefilled values include station `766`, contract `36C7702600004`, contract end date `12/31/30`, investigation level `Tier 1`, contract company `All In Solutions`, VA CO/COR contacts, and contractor POC details.

Automation requirements:

- Candidate should only supply personal information fields.
- Coordinator/admin should control contract, COR/CO, company, station, investigation level, and role template values.
- Preserve official prefilled values unless DIS explicitly approves overrides.
- Require CO/COR signature before VA submission readiness.
- Flag foreign-born, permanent resident, or foreign national cases for the 3-consecutive-years-in-U.S. requirement.

### OF-306 August 2023

The OF-306 is a fillable 3-page AcroForm with 56 detected fields. It captures full legal identity, SSN, birthplace, citizenship, DOB, other names, phone numbers, Selective Service, military service, criminal/court-martial/charges history, job firing/debarment issues, federal debt delinquency, relatives at the agency, military retirement/pension, explanations, signature, and date.

Automation requirements:

- Treat this as the highest-risk rejection form.
- Require all yes/no responses explicitly; do not allow unselected defaults.
- Enforce question 7 logic: if not applicable, skip correctly; if applicable, require 7b and, when needed, 7c explanation.
- Require question 8 military service answer because the instructions identify it as commonly missed.
- Require item 16 explanations when any triggering question asks for details.
- Require black-ink wet signature scan, not digital signature.

### Self Certification of Continuous Service

This is a fillable 1-page AcroForm with 10 detected fields. It asks the candidate to select one break-in-service option and provide full name, SSN, signature, and date.

Automation requirements:

- Enforce exactly one selected service-break option.
- If a break option references the date federal employment ended, require that date.
- Use the packet's federal-employment definition in helper text: military, federal civilian, or contractor working for the federal government.
- Require black-ink wet signature scan, not digital signature.

### VetPro Enrollment Form

This is a legacy Word `.doc` form, not a fillable PDF. It captures SSN, request date, title, requesting facility, first/middle/last/suffix, birth date/city/state/country, gender, U.S. citizenship, occupation, other occupation, preferred and secondary addresses, phone/cell/fax, and email. It states VetPro requires an email address and that the VetPro application will be sent to that email.

Automation requirements:

- Include VetPro as a separate enrollment checklist item.
- Confirm whether DIS/VA will accept a generated PDF replacement or requires the original `.doc` format.
- Validate email carefully because it controls where VetPro sends enrollment packages.
- Reuse candidate identity/address fields from the shared profile to avoid mismatch.

### Inline Image

The PNG is a Dynamic Integrated Services logo/signature image. It has no packet requirements.

## MVP Implications

The attachment review supports a packet-prep MVP, not direct VA submission as the first build. The highest-value automation is rejection prevention before submission:

- Shared candidate profile feeding every form.
- Role-specific packet templates for Pharmacist, Pharmacy Technician, and Shipper/Packer.
- Conditional validation engine for OF-306 and Self Certification.
- ID upload validation checklist.
- Scan/signature quality gate.
- Required filename generator.
- Coordinator review queue with not-ready reasons.
- Final bundle export using VA naming conventions.

## Immediate Open Questions For David/DIS

1. Which email replaces `EMAIL ADDRESS` in the instructions?
2. Should the system produce final official PDFs only, or also maintain editable source files?
3. Is the VetPro form acceptable as a generated PDF, or must it remain a Word document?
4. Who controls and signs the CO/COR section before submission?
5. What encryption/password-protection process does DIS currently use for packets sent to `VHAWMCPerSecContractor@va.gov`?
6. Can DIS provide one redacted accepted packet and one rejected packet for validation-rule calibration?
