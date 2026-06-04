import { CheckCircle2, AlertTriangle, Circle, PenLine } from 'lucide-react'
import type { Applicant } from '@/lib/store'
import { specLabel } from '@/lib/store'
import { getSpec } from '@/lib/forms/specs'
import { formHealth } from './status'
import FormUpload from './FormUpload'

/**
 * Renders each required form in a packet with its scan result (missing fields,
 * conditional issues, signature reminder) and an upload-to-rescan widget.
 * Shared by the admin detail view and the candidate self-review view.
 */
export default function PacketForms({ applicant }: { applicant: Applicant }) {
  return (
    <div className="space-y-3">
      {applicant.forms.map(f => {
        const health = formHealth(f)
        const spec = getSpec(f.specId)
        return (
          <div key={f.specId} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {health === 'complete' && <CheckCircle2 size={16} className="flex-shrink-0 text-green-600" />}
                  {health === 'incomplete' && <AlertTriangle size={16} className="flex-shrink-0 text-amber-500" />}
                  {health === 'empty' && <Circle size={16} className="flex-shrink-0 text-slate-300" />}
                  <h3 className="truncate font-semibold text-slate-900">{specLabel(f.specId)}</h3>
                </div>
                {!f.uploaded && (
                  <p className="mt-1 text-xs text-slate-400">Not uploaded yet.</p>
                )}
              </div>
              <div className="flex-shrink-0 text-right">
                {f.uploaded && (
                  <div className={`text-lg font-black ${f.completeness === 100 && f.issues.length === 0 ? 'text-green-600' : 'text-amber-600'}`}>
                    {f.completeness}%
                  </div>
                )}
              </div>
            </div>

            {(f.missing.length > 0 || f.issues.length > 0) && (
              <ul className="mt-3 space-y-1.5 border-t border-slate-100 pt-3">
                {f.missing.map((m, i) => (
                  <li key={`m${i}`} className="flex items-start gap-2 text-xs text-slate-600">
                    <Circle size={6} className="mt-1.5 flex-shrink-0 fill-amber-400 text-amber-400" />
                    <span><span className="font-semibold text-slate-700">Missing:</span> {m}</span>
                  </li>
                ))}
                {f.issues.map((m, i) => (
                  <li key={`i${i}`} className="flex items-start gap-2 text-xs text-red-700">
                    <AlertTriangle size={11} className="mt-0.5 flex-shrink-0" />
                    <span>{m}</span>
                  </li>
                ))}
              </ul>
            )}

            {spec?.signatureRequired && f.uploaded && (
              <p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400">
                <PenLine size={11} /> Requires a wet signature in black ink — verify by hand; it can&rsquo;t be auto-checked.
              </p>
            )}

            <div className="mt-3">
              <FormUpload applicantId={applicant.id} specId={f.specId} form={f} label={specLabel(f.specId)} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
