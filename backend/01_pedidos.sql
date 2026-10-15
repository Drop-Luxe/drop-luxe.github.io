-- DropLux: folios globalmente únicos y pedidos privados.
-- Ejecutar en el proyecto de Supabase de DropLux (SQL Editor).
create extension if not exists pgcrypto;
create sequence if not exists public.droplux_order_seq as bigint start with 1;

create or replace function public.droplux_folio(p_number bigint)
returns text language plpgsql immutable as $$
declare grp bigint; serial_num bigint; letters text := ''; n bigint;
begin
 if p_number < 1 then raise exception 'Número inválido'; end if;
 grp := (p_number - 1) / 999 + 3;
 serial_num := (p_number - 1) % 999 + 1;
 n := grp;
 loop
   letters := chr(65 + (n % 26)::int) || letters;
   n := n / 26 - 1;
   exit when n < 0;
 end loop;
 return letters || '-' || lpad(serial_num::text,3,'0');
end $$;

create table if not exists public.droplux_orders (
 id uuid primary key default gen_random_uuid(),
 sequence_number bigint not null unique default nextval('public.droplux_order_seq'),
 folio text generated always as (public.droplux_folio(sequence_number)) stored unique,
 created_at timestamptz not null default now(),
 status text not null default 'pending_review' check (status in ('pending_review','awaiting_payment','paid','cancelled','shipped')),
 customer_name text not null,
 customer_phone text not null,
 customer_email text not null,
 shipping_address jsonb not null,
 items jsonb not null,
 subtotal_mxn numeric(12,2) not null check (subtotal_mxn >= 0),
 discount_mxn numeric(12,2) not null check (discount_mxn >= 0),
 shipping_mxn numeric(12,2),
 total_mxn numeric(12,2) not null check (total_mxn >= 0)
);
alter table public.droplux_orders enable row level security;
revoke all on public.droplux_orders from anon, authenticated;
revoke all on sequence public.droplux_order_seq from anon, authenticated;
revoke all on function public.droplux_folio(bigint) from public;
-- Pendiente: Edge Function segura que valida carrito/precios, aplica limitación
-- de solicitudes y escribe con service_role privado. Nunca publicar ese secreto.
