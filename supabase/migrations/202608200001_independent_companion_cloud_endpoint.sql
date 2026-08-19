-- Keep the companion/background scheduler isolated from both the legacy
-- application cloud and the invitation-code failover project.
do $$
declare
  v_job record;
begin
  for v_job in
    select jobid
    from cron.job
    where jobname = 'phone-role-push-every-minute'
  loop
    perform cron.unschedule(v_job.jobid);
  end loop;

  perform cron.schedule(
    'phone-role-push-every-minute',
    '* * * * *',
    $cron$
    select net.http_post(
      url := 'https://qvuahlqimcfgeoetosnl.supabase.co/functions/v1/phone-role-push',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object('action', 'dispatch_due')
    );
    $cron$
  );
end;
$$;
