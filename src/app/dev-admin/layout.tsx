import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getGlobalAdminAccess } from '@/lib/auth/require-global-admin';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function DevAdminLayout({ children }: { children: React.ReactNode }) {
  const { status } = await getGlobalAdminAccess();
  if (status === 401) redirect('/login?next=/dev-admin');
  if (status === 403) {
    return <main className="container mx-auto max-w-lg p-8">
      <h1 className="text-2xl font-semibold">Administrator access required</h1>
      <p className="mt-3">This account is not authorized to access Learnology admin tools.</p>
      <Link href="/teach" className="mt-6 inline-block underline">Return to your dashboard</Link>
    </main>;
  }
  return children;
}
