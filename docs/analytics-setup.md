# Quiz Analytics and Staff Dashboard

The quiz sends anonymous events to `/api/quiz-events` only in production. It
does not collect names, email addresses, free text, or device identifiers.
The public staff dashboard is available at `/staff` and reads anonymous,
aggregate data through a server endpoint.

## Supabase

1. Create a Supabase project.
2. Run `supabase/quiz-analytics.sql` in the Supabase SQL Editor.
3. In Vercel, add these Production environment variables:
   - `SUPABASE_URL`
   - `SUPABASE_SECRET_KEY`
   - `VITE_PUBLIC_QUIZ_URL` (the public quiz URL used by result-page and
     Instagram Story QR codes)
4. Redeploy the site.

The Supabase secret key stays inside Vercel Functions. It must never use a
`VITE_` prefix or be exposed to browser code.

## Staff dashboard

Open:

```text
https://your-quiz-domain.example/staff
```

The dashboard opens without a login and includes:

- visits, starts, completions, and conversion rates;
- answer distribution and drop-off for every question;
- personality result distribution;
- completion time and daily participation trend;
- traffic source, device, platform, and viewport summaries;
- result shares, journey reviews, quiz-link visits, and Student Care email
  clicks; and
- recent anonymous completions without attempt identifiers.

For local visual testing, use `/staff?demo`. Demo mode is disabled in production.

## Data notes

The funnel includes page visits, quiz starts, completed quizzes, result shares,
journey-review opens, Student Care email clicks, and result-page quiz-link
clicks. The `source` column distinguishes direct visits from QR and shared-result
links. The `event_id` unique constraint deduplicates retried requests.

Public quiz analytics are anonymous and indicative rather than identity-verified
because participants do not sign in.
