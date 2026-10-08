-- Kept in a separate migration because PostgreSQL requires newly added enum
-- values to be committed before they are referenced by functions or policies.
alter type public.app_role add value if not exists 'administrador';
alter type public.app_role add value if not exists 'pendente';
