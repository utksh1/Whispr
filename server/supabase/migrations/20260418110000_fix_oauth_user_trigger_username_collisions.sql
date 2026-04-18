-- Make OAuth signup resilient to display names and username collisions.
create or replace function public.handle_new_user()
returns trigger as $$
declare
  base_username text;
  candidate_username text;
  suffix text;
begin
  base_username := lower(
    regexp_replace(
      coalesce(
        new.raw_user_meta_data->>'preferred_username',
        new.raw_user_meta_data->>'user_name',
        new.raw_user_meta_data->>'name',
        split_part(coalesce(new.email, new.id::text), '@', 1),
        'whispr-user'
      ),
      '[^a-zA-Z0-9]+',
      '-',
      'g'
    )
  );

  base_username := trim(both '-' from base_username);

  if base_username is null or char_length(base_username) < 3 then
    base_username := 'whispr-user';
  end if;

  candidate_username := base_username;
  suffix := right(replace(new.id::text, '-', ''), 6);

  while exists (
    select 1
    from public.profiles
    where username_lower = lower(candidate_username)
      and id <> new.id
  ) loop
    candidate_username := base_username || '-' || suffix;
    suffix := right(replace(gen_random_uuid()::text, '-', ''), 6);
  end loop;

  insert into public.profiles (
    id,
    username,
    username_lower,
    email,
    has_public_key,
    has_private_key_backup,
    updated_at
  )
  values (
    new.id,
    candidate_username,
    lower(candidate_username),
    new.email,
    false,
    false,
    now()
  )
  on conflict (id) do update
    set email = excluded.email,
        updated_at = now();

  return new;
end;
$$ language plpgsql security definer;
