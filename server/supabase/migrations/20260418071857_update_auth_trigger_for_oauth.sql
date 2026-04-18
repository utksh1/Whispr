-- Update the user trigger to handle OAuth metadata (Capture full name from Google/etc.)
create or replace function public.handle_new_user()
returns trigger as $$
declare
  potential_username text;
begin
  -- Try to get username from metadata (Google/GitHub/etc.) or fallback to email prefix
  potential_username := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    new.raw_user_meta_data->>'user_name',
    split_part(new.email, '@', 1)
  );

  insert into public.profiles (id, username)
  values (new.id, potential_username)
  on conflict (id) do nothing;
  
  return new;
end;
$$ language plpgsql security definer;
