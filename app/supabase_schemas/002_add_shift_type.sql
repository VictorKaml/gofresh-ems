-- 002_add_shift_type.sql
-- Adds a shift roster flag to employees so attendance calc knows whether
-- a lone/late-night clock-out swipe belongs to *today's* session or to a
-- shift that started the day before (night sheet).

create type public.shift_type as enum ('day', 'night');

alter table public.employees
  add column if not exists shift_type public.shift_type not null default 'day';

comment on column public.employees.shift_type is
  'Which roster sheet the employee normally clocks against. Drives the late-arrival cutoff and cross-midnight punch pairing in attendance calc.';
