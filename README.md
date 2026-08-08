# Qur'an Revision Examination Management System

Phase 1 foundation for the term examination: a mobile-first Next.js interface, planned role-based access, examination periods, and student registration schema.

## Stack

- Next.js and TypeScript
- Tailwind CSS (utility support) with purpose-built responsive styles
- Supabase: PostgreSQL database, Authentication, and Row Level Security
- Vercel: web application hosting

## Run locally

1. Copy `.env.example` to `.env.local` and enter your Supabase project values.
2. In the Supabase SQL Editor, run `supabase/schema.sql`.
3. Run `npm install` once, then `npm run dev`.
4. Open `http://localhost:3000`.

The `/login` page uses Supabase email/password authentication. Create the initial Admin account in Supabase Authentication, then create its matching `profiles` record with role `admin`. The dashboard currently shows an interactive registration preview; the next Phase 1 change persists this form and its list to Supabase.

## Next Phase 1 tasks

- Add duplicate-registration checks and editable student records.
- Add role-specific dashboard redirects.
- Enforce registration-open/closed status on the server.

## Admin account creation

Run `supabase/phase1-users.sql` in the Supabase SQL Editor. Then copy the Supabase **Secret** key yourself into `.env.local` as `SUPABASE_SERVICE_ROLE_KEY=...`; never send that key in chat or commit it to Git. This secret is used only by the server route that creates user accounts. The Admin account page is available at `/admin/users`.

## Deployment

Push the project to GitHub, import it into Vercel, and add the two `NEXT_PUBLIC_SUPABASE_*` environment variables in Vercel Project Settings. Create a Supabase project and run `supabase/schema.sql` before signing in real users.

## Low-connection support

The app registers a small service worker to cache the interface shell after the first successful visit. If a connection is unavailable, users see an offline page rather than a browser error. Registration drafts are also retained in the browser on the same phone. Before the live exam, later phases will add a visible sync queue so locally saved drafts are safely sent to Supabase when a connection returns.
