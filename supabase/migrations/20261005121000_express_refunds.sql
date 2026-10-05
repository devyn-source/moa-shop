create table if not exists public.express_checkout_refunds (
  checkout_id uuid primary key,
  order_number text not null,
  payment_id text not null,
  mode text not null check (mode in ('express_sandbox','express_stripe')),
  amount_cents bigint not null check (amount_cents > 0),
  status text not null default 'requested' check (status in ('requested','pending','succeeded','failed','requires_action','canceled')),
  refund_id text,
  last_error text,
  backend_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.express_checkout_refunds enable row level security;
grant select, insert, update on public.express_checkout_refunds to service_role;

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
    'paymentStatus',case when p_status = 'succeeded' then 'refunded' else case when p_mode = 'express_sandbox' then 'simulated_paid' else 'paid' end end,
    'refundedAt',case when p_status = 'succeeded' then coalesce(data->>'refundedAt',now()::text) else null end)
    where data->>'checkoutId' = p_checkout_id::text;
  return to_jsonb(ticket);
end $$;

create or replace function public.guard_shop_express_cancellation()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.data->>'refundStatus' is not null and (new.status <> 'cancelled' or new.data->>'status' <> 'cancelled'
    or new.data->>'refundStatus' is null or new.data->>'proofApprovedAt' is distinct from old.data->>'proofApprovedAt') then
    raise exception 'Cancelled checkout cannot return to production';
  end if;
  return new;
end $$;
drop trigger if exists shop_express_cancellation_guard on public.orders;
create trigger shop_express_cancellation_guard before update on public.orders for each row execute function public.guard_shop_express_cancellation();
revoke all on function public.save_express_checkout_refund(uuid,text,text,text,bigint,text,text) from public, anon, authenticated;
grant execute on function public.save_express_checkout_refund(uuid,text,text,text,bigint,text,text) to service_role;
