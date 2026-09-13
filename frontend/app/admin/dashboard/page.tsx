// This route was a stale, superseded duplicate of /admin (divergent design,
// missing staff/gallery management, and even wrong currency/locale — a
// leftover early prototype). Redirecting rather than leaving it reachable.
import { redirect } from 'next/navigation';

export default function AdminDashboardRedirect() {
  redirect('/admin');
}
