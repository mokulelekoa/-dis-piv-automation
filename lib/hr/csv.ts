/**
 * Tiny dependency-free CSV/TSV helpers used by the HR tools for both
 * imports (Unanet exports, pasted Excel rows) and exports (Paycor /
 * Employee Navigator import files).
 */

/** Parse CSV or TSV text into rows of cells. Handles quoted fields and CRLF. */
export function parseDelimited(text: string): string[][] {
  const firstLine = text.slice(0, text.indexOf('\n') === -1 ? text.length : text.indexOf('\n'))
  // Pasted-from-Excel data is tab separated; exported files are comma separated.
  const delim = firstLine.includes('\t') ? '\t' : ','
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++ } else inQuotes = false
      } else cell += ch
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === delim) {
      row.push(cell); cell = ''
    } else if (ch === '\n') {
      row.push(cell); cell = ''
      rows.push(row); row = []
    } else if (ch !== '\r') {
      cell += ch
    }
  }
  if (cell.length > 0 || row.length > 0) { row.push(cell); rows.push(row) }
  return rows.filter(r => r.some(c => c.trim() !== ''))
}

function escapeCsvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

/** Serialize rows to CSV text (CRLF, Excel-friendly). */
export function toCsv(rows: (string | number)[][]): string {
  return rows.map(r => r.map(c => escapeCsvCell(String(c))).join(',')).join('\r\n') + '\r\n'
}

/** Trigger a client-side file download for generated text content. */
export function downloadFile(filename: string, content: string, mime = 'text/csv') {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
