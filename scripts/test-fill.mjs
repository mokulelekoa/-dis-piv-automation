import { PDFDocument, PDFTextField, PDFRadioGroup, PDFCheckBox, PDFDropdown } from 'pdf-lib'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

// Inline-mimic the fill logic by calling the compiled TS is awkward; instead we
// re-import the real module via a tiny on-the-fly transpile is overkill. So this
// script just fills using the SAME field names to prove the template accepts them.
const dir = path.join(process.cwd(), 'lib', 'forms', 'templates')

async function dump(specId, file, setFn) {
  const doc = await PDFDocument.load(await readFile(path.join(dir, file)), { ignoreEncryption: true })
  const form = doc.getForm()
  setFn(form)
  const out = path.join(process.cwd(), '.data', `filled_${specId}.pdf`)
  await writeFile(out, await doc.save())
  // read back
  const doc2 = await PDFDocument.load(await readFile(out), { ignoreEncryption: true })
  const f2 = doc2.getForm()
  console.log(`\n== ${specId} -> ${out} ==`)
  for (const fld of f2.getFields()) {
    let v = ''
    if (fld instanceof PDFTextField) v = fld.getText() ?? ''
    else if (fld instanceof PDFRadioGroup) v = fld.getSelected() ?? ''
    else if (fld instanceof PDFCheckBox) v = fld.isChecked() ? 'CHECKED' : ''
    else if (fld instanceof PDFDropdown) v = (fld.getSelected() ?? []).join(',')
    if (v) console.log(`  ${fld.getName()} = ${JSON.stringify(v)}`)
  }
}

const setText = (form, n, v) => { try { form.getTextField(n).setText(v) } catch {} }
const selRadio = (form, n, v) => { try { const g = form.getRadioGroup(n); if (g.getOptions().includes(v)) g.select(v) } catch {} }
const chk = (form, n) => { try { form.getCheckBox(n).check() } catch {} }
const selDrop = (form, n, v) => { try { const d = form.getDropdown(n); const m = d.getOptions().find(o => o.trim().toLowerCase() === v.trim().toLowerCase()); if (m) d.select(m) } catch {} }

await dump('of306', 'of306.pdf', form => {
  setText(form, 'Full Name', 'James Raymond Dudla II')
  setText(form, 'Social Security Number', '123-45-6789')
  setText(form, 'DATE OF BIRTH MM  DD  YYYY', '10/31/1977')
  setText(form, 'PLACE OF BIRTH Include city and state or country', 'Honolulu, HI, USA')
  setText(form, 'Country of Citizenship', 'United States')
  selRadio(form, 'Are you a U.S. Citizen?', 'Yes')
  selRadio(form, 'Male', 'Yes')
  selRadio(form, 'Have you ever served in the U.S. Military', 'No')
  selRadio(form, 'Are you delinquent on any Federal debt', 'No')
  selRadio(form, 'Have you been convicted imprisoned probation or paroled last 7 years', 'No')
})

await dump('bi_pharmacist', 'bi_pharmacist.pdf', form => {
  setText(form, 'Last Name', 'Dudla')
  setText(form, 'First Name', 'James')
  setText(form, 'Middle Name', 'Raymond')
  setText(form, 'Date of Birth', '10/31/1977')
  setText(form, 'City of Birth', 'Honolulu')
  setText(form, 'Email Address', 'jdudla@example.com')
  setText(form, 'SEX', 'M')
  selDrop(form, 'State of Birth', 'HI')
  selDrop(form, 'Country of Birth', 'United States of America')
  selDrop(form, 'Country of Citizenship', 'United States of America')
  selDrop(form, 'Gender', 'Male')
  selDrop(form, 'Marital Status', 'Married')
  chk(form, 'D-C')
})

await dump('selfcert', 'selfcert.pdf', form => {
  setText(form, 'Print Name', 'James Raymond Dudla II')
  setText(form, 'Social Security Number', '123-45-6789')
  chk(form, 'I have NOT had a break in service')
})
