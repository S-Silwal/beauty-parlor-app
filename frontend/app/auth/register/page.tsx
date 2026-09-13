// This route was orphaned early scaffolding (old branding, and it linked to
// a /auth/login route that never existed). The real registration page is
// /register — redirecting rather than leaving this reachable and broken.
import { redirect } from 'next/navigation';

export default function AuthRegisterRedirect() {
  redirect('/register');
}
