-- Allow both participants to delete messages in their own conversation thread.
drop policy if exists "messages_delete_sender" on public.messages;

create policy "messages_delete_participants"
  on public.messages
  for delete
  to authenticated
  using (auth.uid() = sender_id or auth.uid() = receiver_id);
