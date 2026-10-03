-- ============================================================================
-- 07 - Facturación
--
-- Facturación interna de la consultora hacia cada organización cliente. No es
-- un módulo que vean los clientes: solo la administración central factura y
-- registra cobros. Sirve de base para el resumen de Contabilidad.
-- ============================================================================

create table if not exists public.invoices (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  number          text not null,
  concept         text not null default 'Servicio de encuestas',
  amount          numeric(12,2) not null check (amount >= 0),
  currency        text not null default 'ARS',
  status          text not null default 'pendiente'
                  check (status in ('pendiente','pagada','vencida','anulada')),
  issued_at       timestamptz not null default now(),
  due_at          timestamptz,
  paid_at         timestamptz,
  notes           text,
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, number)
);
create index if not exists invoices_org_idx on public.invoices(organization_id);
create index if not exists invoices_status_idx on public.invoices(status);

alter table public.invoices enable row level security;

-- Solo administración central: la facturación es interna de la consultora,
-- ningún cliente lee ni escribe esta tabla.
create policy "invoices_select" on public.invoices
  for select to authenticated using (public.is_super_admin());
create policy "invoices_write" on public.invoices
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());
