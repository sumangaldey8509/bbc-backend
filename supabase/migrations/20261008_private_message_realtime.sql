-- Private Supabase Realtime authorization for BBC messaging.
-- Message bodies remain in MongoDB; Supabase carries only empty invalidation events.

create policy "bbc members receive their own message signals"
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and realtime.topic() = (select auth.jwt() ->> 'realtime_topic')
);

-- Clients never publish message events. Only the backend service-role client does.
