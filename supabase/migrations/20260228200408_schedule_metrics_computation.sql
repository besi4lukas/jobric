-- migrate: up

-- ─── 1. Computation Function ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION refresh_user_metrics(target_user_id UUID)
RETURNS VOID AS $$
DECLARE
  v_total       INT;
  v_responded   INT;
  v_interviewed INT;
  v_offered     INT;
BEGIN
  -- Total applications for this user
  SELECT COUNT(*)
  INTO v_total
  FROM applications
  WHERE user_id = target_user_id;

  -- Applications that received any response (any event beyond 'applied')
  SELECT COUNT(DISTINCT ae.application_id)
  INTO v_responded
  FROM application_events ae
  JOIN applications a ON a.id = ae.application_id
  WHERE a.user_id = target_user_id
    AND ae.event_type != 'applied';

  -- Applications that reached interview or offer stage
  SELECT COUNT(*)
  INTO v_interviewed
  FROM applications
  WHERE user_id = target_user_id
    AND current_stage IN ('interview', 'offer');

  -- Applications that reached offer stage
  SELECT COUNT(*)
  INTO v_offered
  FROM applications
  WHERE user_id = target_user_id
    AND current_stage = 'offer';

  -- Upsert into user_metrics
  INSERT INTO user_metrics (
    user_id,
    computed_at,
    total_applied,
    response_rate,
    interview_rate,
    offer_rate
  )
  VALUES (
    target_user_id,
    NOW(),
    v_total,
    CASE WHEN v_total > 0 THEN (v_responded::FLOAT   / v_total) * 100 ELSE 0 END,
    CASE WHEN v_total > 0 THEN (v_interviewed::FLOAT  / v_total) * 100 ELSE 0 END,
    CASE WHEN v_total > 0 THEN (v_offered::FLOAT      / v_total) * 100 ELSE 0 END
  )
  ON CONFLICT (user_id) DO UPDATE SET
    computed_at    = EXCLUDED.computed_at,
    total_applied  = EXCLUDED.total_applied,
    response_rate  = EXCLUDED.response_rate,
    interview_rate = EXCLUDED.interview_rate,
    offer_rate     = EXCLUDED.offer_rate;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ─── 2. pg_cron Schedule ─────────────────────────────────────────────────────
-- Unschedule first to avoid duplicate jobs if migration is re-run
SELECT cron.unschedule('refresh-all-metrics')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'refresh-all-metrics'
);

SELECT cron.schedule(
  'refresh-all-metrics',
  '*/15 * * * *',
  $$ SELECT refresh_user_metrics(id) FROM public.users $$
);