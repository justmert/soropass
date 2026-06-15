import { useEffect } from 'react';
import type { Route } from './+types/home';
import { Link } from 'react-router';

export function meta(_args: Route.MetaArgs) {
  return [
    { title: 'SoroPass — Passkeys for Stellar smart accounts' },
    {
      name: 'description',
      content:
        'A minimal passkey SDK and drop-in create / sign / recover UI for Stellar smart accounts.',
    },
  ];
}

// Root currently serves the docs — open the Introduction page directly.
export default function Home() {
  useEffect(() => {
    window.location.replace('/docs');
  }, []);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <p className="text-fd-muted-foreground">Opening the docs…</p>
      <Link
        className="rounded-full bg-fd-primary px-4 py-2 text-sm font-medium text-fd-primary-foreground"
        to="/docs"
      >
        Continue to docs
      </Link>
    </div>
  );
}
