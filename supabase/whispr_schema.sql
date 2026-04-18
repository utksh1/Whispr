create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  username_lower text not null,
  email text not null,
  public_key text not null default '',
  active_public_key_id text not null default '',
  has_public_key boolean not null default false,
  has_private_key_backup boolean not null default false,
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists profiles_username_lower_unique
  on public.profiles (username_lower);

create table if not exists public.user_keys (
  key_id text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  username text not null,
  public_key text not null,
  is_active boolean not null default true,
  revoked_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists user_keys_user_id_idx
  on public.user_keys (user_id);

create table if not exists public.private_key_backups (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  ciphertext text not null,
  salt text not null,
  iv text not null,
  version text not null,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_key text not null,
  participant_ids uuid[] not null,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  sender_username text not null,
  receiver_username text not null,
  sender_key_id text not null references public.user_keys(key_id),
  receiver_key_id text not null references public.user_keys(key_id),
  ciphertext text not null,
  nonce text not null,
  salt text not null,
  version text not null,
  tampered boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists messages_conversation_key_idx
  on public.messages (conversation_key);

create index if not exists messages_created_at_idx
  on public.messages (created_at);

create index if not exists messages_participant_ids_idx
  on public.messages using gin (participant_ids);

alter table public.profiles enable row level security;
alter table public.user_keys enable row level security;
alter table public.private_key_backups enable row level security;
alter table public.messages enable row level security;

drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
  on public.profiles
  for select
  to authenticated
  using (true);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_delete_own"
  on public.profiles
  for delete
  to authenticated
  using (auth.uid() = id);

drop policy if exists "user_keys_select_authenticated" on public.user_keys;
create policy "user_keys_select_authenticated"
  on public.user_keys
  for select
  to authenticated
  using (true);

drop policy if exists "user_keys_insert_own" on public.user_keys;
create policy "user_keys_insert_own"
  on public.user_keys
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "user_keys_update_own" on public.user_keys;
create policy "user_keys_update_own"
  on public.user_keys
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "user_keys_delete_own" on public.user_keys;
create policy "user_keys_delete_own"
  on public.user_keys
  for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "private_key_backups_select_own" on public.private_key_backups;
create policy "private_key_backups_select_own"
  on public.private_key_backups
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "private_key_backups_insert_own" on public.private_key_backups;
create policy "private_key_backups_insert_own"
  on public.private_key_backups
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "private_key_backups_update_own" on public.private_key_backups;
create policy "private_key_backups_update_own"
  on public.private_key_backups
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "private_key_backups_delete_own" on public.private_key_backups;
create policy "private_key_backups_delete_own"
  on public.private_key_backups
  for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "messages_select_participants" on public.messages;
create policy "messages_select_participants"
  on public.messages
  for select
  to authenticated
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

drop policy if exists "messages_insert_sender" on public.messages;
create policy "messages_insert_sender"
  on public.messages
  for insert
  to authenticated
  with check (auth.uid() = sender_id);

drop policy if exists "messages_update_sender" on public.messages;
create policy "messages_update_sender"
  on public.messages
  for update
  to authenticated
  using (auth.uid() = sender_id)
  with check (auth.uid() = sender_id);

drop policy if exists "messages_delete_sender" on public.messages;
create policy "messages_delete_sender"
  on public.messages
  for delete
  to authenticated
  using (auth.uid() = sender_id);

do $$
begin
  begin
    alter publication supabase_realtime add table public.messages;
  exception
    when duplicate_object then null;
  end;
end $$;
