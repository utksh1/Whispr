-- Allow authenticated users to insert their own profile
-- This is necessary if the client tries to create a profile before the background trigger finishes
create policy "Users can insert their own profile"
  on profiles for insert
  with check (auth.uid() = id);

-- Ensure profiles is viewable by all (already set, but reinforcing)
-- drop policy if exists "Public profiles are viewable by everyone" on profiles;
-- create policy "Public profiles are viewable by everyone" on profiles for select using (true);

-- Ensure users can update their own profile
-- drop policy if exists "Users can update own profile" on profiles;
-- create policy "Users can update own profile" on profiles for update using (auth.uid() = id);
