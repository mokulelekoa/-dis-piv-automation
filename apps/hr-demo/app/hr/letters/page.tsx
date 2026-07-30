import LetterStudio from './studio'

export default async function LettersPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const sp = await searchParams
  const kind = sp.kind === 'increase' ? 'increase' : 'offer'
  const empId = typeof sp.emp === 'string' ? sp.emp : undefined
  return <LetterStudio initialKind={kind} prefillEmployeeId={empId} />
}
