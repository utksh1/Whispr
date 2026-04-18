-- Align messages table with client-side requirements (supabase-chat.js)
alter table messages rename column conversation_id to conversation_id_old;

alter table messages 
add column if not exists conversation_key text,
add column if not exists participant_ids uuid[] default '{}';

-- Index for fast lookup by conversation key
create index if not exists messages_conversation_key_idx on messages (conversation_key);

-- Also ensure profiles has all fields expected by client
alter table profiles 
add column if not exists username_lower text,
add column if not exists email text,
add column if not exists has_public_key boolean default false,
add column if not exists has_private_key_backup boolean default false;

-- Update username_lower trigger/logic
create or replace function public.handle_new_user()
returns trigger as $$
declare
  potential_username text;
begin
  potential_username := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    new.raw_user_meta_data->>'user_name',
    split_part(new.email, '@', 1)
  );

  insert into public.profiles (id, username, username_lower, email)
  values (
    new.id, 
    potential_username, 
    lower(potential_username),
    new.email
  )
  on conflict (id) do update set
    email = excluded.email,
    updated_at = now();
  
  return new;
end;
$$ language plpgsql security definer;
