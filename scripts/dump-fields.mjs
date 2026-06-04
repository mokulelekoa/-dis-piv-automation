import { PDFDocument, PDFTextField, PDFCheckBox, PDFRadioGroup, PDFDropdown } from 'pdf-lib'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const dir = path.join(process.cwd(), 'lib', 'forms', 'templates')
const files = ['of306.pdf', 'bi_pharmacist.pdf', 'bi_pharmtech.pdf', 'bi_shipper.pdf', 'selfcert.pdf']

for (const f of files) {
  const bytes = await readFile(path.join(dir, f))
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true })
  const form = doc.getForm()
  console.log(`\n===== ${f} =====`)
  for (const field of form.getFields()) {
    const name = field.getName()
    if (field instanceof PDFTextField) {
      console.log(`TEXT   | ${JSON.stringify(name)}`)
    } else if (field instanceof PDFCheckBox) {
      console.log(`CHECK  | ${JSON.stringify(name)}`)
    } else if (field instanceof PDFRadioGroup) {
      console.log(`RADIO  | ${JSON.stringify(name)} | options: ${JSON.stringify(field.getOptions())}`)
    } else if (field instanceof PDFDropdown) {
      console.log(`DROP   | ${JSON.stringify(name)} | options: ${JSON.stringify(field.getOptions())}`)
    } else {
      console.log(`OTHER  | ${JSON.stringify(name)} | ${field.constructor.name}`)
    }
  }
}
