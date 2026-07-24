# Quiz Analytics Setup

The quiz sends anonymous events to `/api/quiz-events` only in production. It
does not collect names, email addresses, free text, or device identifiers.

## Supabase

1. Create a Supabase project.
2. Run `supabase/quiz-analytics.sql` in the Supabase SQL Editor.
3. In Vercel, add these Production environment variables:
   - `SUPABASE_URL`
   - `SUPABASE_SECRET_KEY`
   - `VITE_PUBLIC_QUIZ_URL` (the public quiz URL used by result-page and
     Instagram Story QR codes)
4. Redeploy the site.

The secret key stays inside the Vercel Function and must never use a `VITE_`
prefix or be exposed to browser code.

## Reports

Run these queries in the Supabase SQL Editor:

```sql
select * from public.quiz_attempt_totals;

select *
from public.quiz_option_distribution
order by question_id, option_id;

select *
from public.quiz_result_distribution
order by results desc;

select * from public.quiz_conversion_funnel;

select *
from public.quiz_source_conversion
order by visitors desc;
```

The funnel includes page visits, quiz starts, completed quizzes, result shares,
journey-review opens, Student Care email clicks, and result-page quiz-link
clicks. The `source` column distinguishes direct visits from QR and shared-result
links. The `event_id` unique constraint deduplicates retried requests.

Public quiz analytics are anonymous and indicative rather than identity-verified
because participants do not sign in.
