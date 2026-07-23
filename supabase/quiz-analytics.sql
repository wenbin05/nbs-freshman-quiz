create table if not exists public.quiz_events (
  id bigint generated always as identity primary key,
  event_id text not null unique,
  attempt_id text not null,
  event_type text not null check (
    event_type in ('quiz_started', 'answer_selected', 'quiz_completed')
  ),
  question_id text,
  option_id text check (option_id is null or option_id in ('A', 'B', 'C', 'D')),
  result_id text,
  created_at timestamptz not null default now()
);

create index if not exists quiz_events_attempt_id_idx
  on public.quiz_events (attempt_id);
create index if not exists quiz_events_question_option_idx
  on public.quiz_events (question_id, option_id)
  where event_type = 'answer_selected';
create index if not exists quiz_events_result_id_idx
  on public.quiz_events (result_id)
  where event_type = 'quiz_completed';

alter table public.quiz_events enable row level security;
revoke all on table public.quiz_events from anon, authenticated;
grant insert, select on table public.quiz_events to service_role;
grant usage, select on sequence public.quiz_events_id_seq to service_role;

create or replace view public.quiz_attempt_totals as
select count(distinct attempt_id)::bigint as attempts
from public.quiz_events
where event_type = 'quiz_started';

create or replace view public.quiz_option_distribution as
select question_id, option_id, count(*)::bigint as selections
from public.quiz_events
where event_type = 'answer_selected'
group by question_id, option_id;

create or replace view public.quiz_result_distribution as
select result_id, count(*)::bigint as results
from public.quiz_events
where event_type = 'quiz_completed'
group by result_id;

grant select on public.quiz_attempt_totals to service_role;
grant select on public.quiz_option_distribution to service_role;
grant select on public.quiz_result_distribution to service_role;
