-- Create profiles table linked to Supabase Auth
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  active_public_key_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  constraint username_length check (char_length(username) >= 3)
);

-- Enable RLS on profiles
alter table profiles enable row level security;

create policy "Public profiles are viewable by everyone" 
  on profiles for select 
  using (true);

create policy "Users can update own profile" 
  on profiles for update 
  using (auth.uid() = id);

-- Conversations table
create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  participant_key text unique not null,
  user_a_id uuid not null references profiles(id) on delete cascade,
  user_b_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz
);

alter table conversations enable row level security;

create policy "Users can view their own conversations"
  on conversations for select
  using (auth.uid() = user_a_id or auth.uid() = user_b_id);

-- User keys for E2EE
create table if not exists user_keys (
  id text primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  public_key text not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  is_active boolean not null default true
);

alter table user_keys enable row level security;

create policy "User keys are viewable by everyone"
  on user_keys for select
  using (true);

create policy "Users can manage their own keys"
  on user_keys for all
  using (auth.uid() = user_id);

-- Private key backups (strictly private)
create table if not exists private_key_backups (
  user_id uuid primary key references profiles(id) on delete cascade,
  ciphertext text not null,
  salt text not null,
  iv text not null,
  version text not null,
  updated_at timestamptz not null default now()
);

alter table private_key_backups enable row level security;

create policy "Users can manage their own backups"
  on private_key_backups for all
  using (auth.uid() = user_id);

-- Messages table
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id uuid not null references profiles(id) on delete cascade,
  sender_key_id text,
  receiver_key_id text,
  ciphertext text not null,
  nonce text not null,
  salt text not null,
  version text not null,
  tampered boolean not null default false,
  tampered_at timestamptz,
  created_at timestamptz not null default now()
);

alter table messages enable row level security;

create policy "Users can view messages in their conversations"
  on messages for select
  using (
    exists (
      select 1 from conversations
      where conversations.id = messages.conversation_id
      and (conversations.user_a_id = auth.uid() or conversations.user_b_id = auth.uid())
    )
  );

create policy "Users can insert messages into their conversations"
  on messages for insert
  with check (auth.uid() = sender_id);

-- Trigger to handle automated profile creation on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username)
  values (new.id, split_part(new.email, '@', 1)); -- Uses email prefix as fallback username
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
