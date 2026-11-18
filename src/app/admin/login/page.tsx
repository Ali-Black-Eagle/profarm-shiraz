import { redirect } from 'next/navigation';

/**
 * /admin/login only forwards to the single sign-in page. This runs on the server, so no client hook
 * (useSearchParams) is needed and nothing renders before the redirect.
 * Only a same-site relative path is accepted as the return target.
 */
export default async function AdminLoginRedirectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = Array.isArray(params.redirect) ? params.redirect[0] : params.redirect;
  const target = typeof raw === 'string' && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/admin';
  redirect(`/login?redirect=${encodeURIComponent(target)}&reason=admin_required`);
}
