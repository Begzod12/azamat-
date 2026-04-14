create table if not exists people (
  id text primary key,
  name text not null,
  role text not null default '',
  description text not null default '',
  company text not null default '',
  tags text[] not null default '{}',
  importance int not null default 5,
  "createdAt" timestamptz not null default now()
);

create table if not exists relations (
  id text primary key,
  from_id text not null references people(id) on delete cascade,
  to_id text not null references people(id) on delete cascade,
  type text not null,
  strength int not null default 5
);

alter table people enable row level security;
alter table relations enable row level security;

drop policy if exists "public_read_people" on people;
create policy "public_read_people"
  on people
  for select
  to anon, authenticated
  using (true);

drop policy if exists "public_read_relations" on relations;
create policy "public_read_relations"
  on relations
  for select
  to anon, authenticated
  using (true);

-- Политики на insert/update/delete не создаются.
-- Это значит, что клиенты не могут изменять данные напрямую.
