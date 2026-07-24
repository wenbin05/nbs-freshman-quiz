create table if not exists public.quiz_events (
  id bigint generated always as identity primary key,
  event_id text not null unique,
  attempt_id text not null,
  event_type text not null check (
    event_type in (
      'quiz_landed',
      'quiz_started',
      'answer_selected',
      'quiz_completed',
      'quiz_link_clicked',
      'result_review_opened',
      'result_shared',
      'student_care_clicked'
    )
  ),
  question_id text,
  option_id text check (option_id is null or option_id in ('A', 'B', 'C', 'D')),
  result_id text,
  source text not null default 'direct',
  created_at timestamptz not null default now()
);

alter table public.quiz_events
  add column if not exists source text not null default 'direct';

alter table public.quiz_events
  drop constraint if exists quiz_events_event_type_check;

alter table public.quiz_events
  add constraint quiz_events_event_type_check check (
    event_type in (
      'quiz_landed',
      'quiz_started',
      'answer_selected',
      'quiz_completed',
      'quiz_link_clicked',
      'result_review_opened',
      'result_shared',
      'student_care_clicked'
    )
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

create or replace view public.quiz_conversion_funnel as
select
  count(distinct attempt_id) filter (where event_type = 'quiz_landed')::bigint
    as visitors,
  count(distinct attempt_id) filter (where event_type = 'quiz_started')::bigint
    as starts,
  count(distinct attempt_id) filter (where event_type = 'quiz_completed')::bigint
    as completions,
  count(distinct attempt_id) filter (where event_type = 'result_shared')::bigint
    as shares,
  round(
    100.0
    * count(distinct attempt_id) filter (where event_type = 'quiz_started')
    / nullif(
      count(distinct attempt_id) filter (where event_type = 'quiz_landed'),
      0
    ),
    1
  ) as visitor_to_start_percent,
  round(
    100.0
    * count(distinct attempt_id) filter (where event_type = 'quiz_completed')
    / nullif(
      count(distinct attempt_id) filter (where event_type = 'quiz_started'),
      0
    ),
    1
  ) as start_to_completion_percent
from public.quiz_events;

create or replace view public.quiz_source_conversion as
with sources as (
  select attempt_id, max(source) as source
  from public.quiz_events
  where event_type = 'quiz_landed'
  group by attempt_id
)
select
  sources.source,
  count(*)::bigint as visitors,
  count(*) filter (
    where exists (
      select 1
      from public.quiz_events event
      where event.attempt_id = sources.attempt_id
        and event.event_type = 'quiz_started'
    )
  )::bigint as starts,
  count(*) filter (
    where exists (
      select 1
      from public.quiz_events event
      where event.attempt_id = sources.attempt_id
        and event.event_type = 'quiz_completed'
    )
  )::bigint as completions,
  count(*) filter (
    where exists (
      select 1
      from public.quiz_events event
      where event.attempt_id = sources.attempt_id
        and event.event_type = 'result_shared'
    )
  )::bigint as shares
from sources
group by sources.source;

grant select on public.quiz_attempt_totals to service_role;
grant select on public.quiz_option_distribution to service_role;
grant select on public.quiz_result_distribution to service_role;
grant select on public.quiz_conversion_funnel to service_role;
grant select on public.quiz_source_conversion to service_role;
