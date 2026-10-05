-- Separate test Stripe refunds from both simulated and live refund queues.
begin;
alter table public.express_checkout_refunds drop constraint express_checkout_refunds_mode_check;
alter table public.express_checkout_refunds add constraint express_checkout_refunds_mode_check
  check (mode in ('express_sandbox','express_stripe','express_stripe_test'));
create or replace function public.save_express_checkout_refund(p_checkout_id uuid, p_order_number text, p_payment_id text,
  p_mode text, p_amount_cents bigint, p_status text, p_refund_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare ticket public.express_checkout_refunds; row_order public.orders; total bigint := 0; count_orders integer := 0;
begin
  -- Lock each order in a stable order so webhook/retry writes cannot overwrite
  -- cancellation. A single checkout always represents the whole Stripe payment.
  for row_order in select * from public.orders where data->>'checkoutId' = p_checkout_id::text order by id for update loop
    count_orders := count_orders + 1;
    if row_order.data->>'stripeSessionId' is distinct from p_payment_id or row_order.data->>'checkoutMode' is distinct from p_mode
      or row_order.data->'fulfillment'->>'catalogOrderId' is distinct from p_order_number then raise exception 'Checkout does not match refund'; end if;
    total := total + round((row_order.data->>'totalUsd')::numeric * 100)::bigint;
  end loop;
  if count_orders = 0 or total <> p_amount_cents then raise exception 'Refund total does not match checkout'; end if;
  insert into public.express_checkout_refunds(checkout_id,order_number,payment_id,mode,amount_cents)
    values(p_checkout_id,p_order_number,p_payment_id,p_mode,p_amount_cents) on conflict(checkout_id) do nothing;
  select * into ticket from public.express_checkout_refunds where checkout_id = p_checkout_id for update;
  if ticket.payment_id <> p_payment_id or ticket.order_number <> p_order_number or ticket.amount_cents <> p_amount_cents
    or ticket.mode <> p_mode then
    raise exception 'Refund reference changed';
  end if;
  -- A concurrent request may have only the original reservation. It must never
  -- replace a recorded Stripe result with requested/pending.
  if ticket.status <> 'requested' and p_status = 'requested' then return to_jsonb(ticket); end if;
  if ticket.refund_id is not null and ticket.refund_id is distinct from p_refund_id then raise exception 'Refund reference changed'; end if;
  if ticket.status in ('succeeded','failed','canceled') and p_status = 'pending' then return to_jsonb(ticket); end if;
  update public.express_checkout_refunds set status = p_status, refund_id = p_refund_id,
    backend_synced_at = null, last_error = null, updated_at = now() where checkout_id = p_checkout_id returning * into ticket;
  update public.orders set status = 'cancelled', updated_at = now(), data = data || jsonb_build_object(
    'status','cancelled','cancelledAt',coalesce(data->>'cancelledAt',now()::text),'refundStatus',p_status,
    'refundId',p_refund_id,'updatedAt',now(),
    'paymentStatus',case when p_status = 'succeeded' then 'refunded' else case when p_mode in ('express_sandbox','express_stripe_test') then 'simulated_paid' else 'paid' end end,
    'refundedAt',case when p_status = 'succeeded' then coalesce(data->>'refundedAt',now()::text) else null end)
    where data->>'checkoutId' = p_checkout_id::text;
  return to_jsonb(ticket);
end $$;

commit;
