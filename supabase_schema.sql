-- 1. Crear tabla de Asignaciones (si no existe)
create table if not exists public.category_assignments (
  id uuid default uuid_generate_v4() primary key,
  company_name text not null,
  category_type text not null,
  category_name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Habilitar Seguridad (RLS)
alter table public.category_assignments enable row level security;

-- 3. Crear Políticas de Acceso (Permitir a la App leer y escribir)
drop policy if exists "Acceso Publico Asignaciones" on public.category_assignments;
create policy "Acceso Publico Asignaciones" on public.category_assignments for all using (true);

-- 4. Auto-asignar todo a todos (Reparación de datos)
-- Esto asegura que si la tabla estaba vacía, se llene con las combinaciones actuales
-- para que no se te borren visualmente los conceptos asignados.
insert into public.category_assignments (company_name, category_type, category_name)
select c.name, cat.type, cat.name
from public.companies c
cross join public.categories cat
where not exists (
    select 1 from public.category_assignments 
    where company_name = c.name 
    and category_type = cat.type 
    and category_name = cat.name
);
