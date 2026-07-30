import { redirect } from 'next/navigation'

/** This deployment is the HR tools only — the root goes straight to them. */
export default function Home() {
  redirect('/hr')
}
