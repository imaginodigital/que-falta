-- =====================================================================
--  Qué Falta · Esquema de base de datos (Supabase / PostgreSQL)
--
--  Crea todo lo que la app necesita en un proyecto nuevo de Supabase:
--  tablas, reglas de seguridad (RLS), funciones, triggers y tiempo real.
--
--  Uso: Supabase → SQL Editor → New query → pegar este archivo → Run.
--  Es seguro volver a ejecutarlo: no borra datos.
-- =====================================================================

create extension if not exists pgcrypto;


-- ---------------------------------------------------------------------
--  1. Tablas
-- ---------------------------------------------------------------------

-- Perfil de cada persona (se crea solo al registrarse)
create table if not exists profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  name       text,                       -- nombre o apodo
  created_at timestamptz default now()
);

-- Listas
create table if not exists lists (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  owner      uuid not null references auth.users(id) on delete cascade,
  sort_mode  text not null default 'alpha' check (sort_mode in ('alpha', 'manual')),
  show_names boolean not null default false,          -- mostrar quién marcó cada artículo
  updated_at timestamptz,                             -- última actualización
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

-- Quién pertenece a cada lista
create table if not exists list_members (
  list_id  uuid references lists(id) on delete cascade,
  user_id  uuid references auth.users(id) on delete cascade,
  role     text not null default 'member',            -- 'owner' | 'member'
  added_at timestamptz default now(),
  primary key (list_id, user_id)
);

-- Artículos de cada lista
create table if not exists items (
  id         uuid primary key default gen_random_uuid(),
  list_id    uuid not null references lists(id) on delete cascade,
  name       text not null,
  quantity   int  not null default 1,
  bought     boolean not null default false,          -- marcado como listo
  bought_by  uuid references auth.users(id) on delete set null,
  position   double precision not null default 0,     -- orden manual
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

-- Enlaces para compartir una lista
create table if not exists invites (
  token      uuid primary key default gen_random_uuid(),
  list_id    uuid not null references lists(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

-- Contactos: personas con las que ya compartiste alguna lista
create table if not exists contacts (
  user_id    uuid references auth.users(id) on delete cascade,
  contact_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, contact_id)
);

-- Invitaciones a contactos dentro de la app (Aceptar / Rechazar)
create table if not exists list_invites (
  id         uuid primary key default gen_random_uuid(),
  list_id    uuid not null references lists(id) on delete cascade,
  from_user  uuid references auth.users(id) on delete cascade,
  to_user    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  unique (list_id, to_user)
);

-- Avisos de la lista ("Pato salió de la lista")
create table if not exists list_activity (
  id         uuid primary key default gen_random_uuid(),
  list_id    uuid not null references lists(id) on delete cascade,
  user_name  text,
  kind       text not null,                           -- 'left'
  created_at timestamptz default now()
);

-- Historial: una fila por acción (la app las agrupa al mostrarlas)
create table if not exists list_events (
  id         uuid primary key default gen_random_uuid(),
  list_id    uuid not null references lists(id) on delete cascade,
  user_id    uuid references auth.users(id) on delete set null,
  user_name  text,                                    -- nombre al momento de la acción
  kind       text not null,  -- add | buy | unbuy | delete | move | move_in | rename_item | rename_list
  item_id    uuid,
  item_name  text,
  extra      text,                                    -- nombre anterior, o la otra lista al mover
  created_at timestamptz default now()
);

create index if not exists items_list_idx       on items(list_id);
create index if not exists members_user_idx     on list_members(user_id);
create index if not exists list_events_list_idx on list_events(list_id, created_at desc);


-- ---------------------------------------------------------------------
--  2. Funciones auxiliares (usadas por las reglas de seguridad)
-- ---------------------------------------------------------------------

-- ¿La persona actual pertenece a la lista?
create or replace function public.is_member(_list_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from list_members where list_id = _list_id and user_id = auth.uid());
$$;

-- ¿La persona actual creó la lista?
create or replace function public.is_owner(_list_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from lists where id = _list_id and owner = auth.uid());
$$;

-- ¿La persona actual comparte alguna lista con _user? (para poder ver su nombre)
create or replace function public.shares_list_with(_user uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from list_members a
    join list_members b on b.list_id = a.list_id
    where a.user_id = auth.uid() and b.user_id = _user
  );
$$;


-- ---------------------------------------------------------------------
--  3. Seguridad por fila (RLS)
-- ---------------------------------------------------------------------

alter table profiles      enable row level security;
alter table lists         enable row level security;
alter table list_members  enable row level security;
alter table items         enable row level security;
alter table invites       enable row level security;
alter table contacts      enable row level security;
alter table list_invites  enable row level security;
alter table list_activity enable row level security;
alter table list_events   enable row level security;

-- Perfiles: ves el tuyo y el de quienes comparten listas contigo; solo editas el tuyo
drop policy if exists "profiles read"        on profiles;
drop policy if exists "profiles insert self" on profiles;
drop policy if exists "profiles update self" on profiles;
create policy "profiles read"        on profiles for select using (id = auth.uid() or public.shares_list_with(id));
create policy "profiles insert self" on profiles for insert with check (id = auth.uid());
create policy "profiles update self" on profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- Listas: los miembros las ven y editan (orden, opciones); solo quien la creó la borra
drop policy if exists "lists read"   on lists;
drop policy if exists "lists update" on lists;
drop policy if exists "lists delete" on lists;
create policy "lists read"   on lists for select using (public.is_member(id));
create policy "lists update" on lists for update using (public.is_member(id)) with check (public.is_member(id));
create policy "lists delete" on lists for delete using (owner = auth.uid());

-- Miembros: se ven entre sí; puedes salir tú o quien creó la lista puede sacar a alguien
drop policy if exists "members read"  on list_members;
drop policy if exists "members leave" on list_members;
create policy "members read"  on list_members for select using (public.is_member(list_id));
create policy "members leave" on list_members for delete using (user_id = auth.uid() or public.is_owner(list_id));

-- Artículos: cualquier miembro los ve y edita
drop policy if exists "items read"   on items;
drop policy if exists "items insert" on items;
drop policy if exists "items update" on items;
drop policy if exists "items delete" on items;
create policy "items read"   on items for select using (public.is_member(list_id));
create policy "items insert" on items for insert with check (public.is_member(list_id));
create policy "items update" on items for update using (public.is_member(list_id)) with check (public.is_member(list_id));
create policy "items delete" on items for delete using (public.is_member(list_id));

-- Enlaces (invites): sin acceso directo; solo mediante las funciones de abajo

-- Contactos: solo los tuyos
drop policy if exists "contacts read own" on contacts;
create policy "contacts read own" on contacts for select using (user_id = auth.uid());

-- Invitaciones: las que te llegan y las de tus listas; puedes rechazarlas o cancelarlas
drop policy if exists "invites read"   on list_invites;
drop policy if exists "invites delete" on list_invites;
create policy "invites read"   on list_invites for select using (to_user = auth.uid() or public.is_member(list_id));
create policy "invites delete" on list_invites for delete using (to_user = auth.uid() or public.is_member(list_id));

-- Avisos e historial: los ven los miembros de la lista
drop policy if exists "activity read" on list_activity;
drop policy if exists "events read"   on list_events;
create policy "activity read" on list_activity for select using (public.is_member(list_id));
create policy "events read"   on list_events   for select using (public.is_member(list_id));

-- Permisos de tabla para usuarios con sesión (las reglas de arriba deciden qué filas)
grant usage on schema public to authenticated;
grant select, insert, update, delete on profiles, lists, list_members, items, invites to authenticated;
grant select                         on contacts, list_activity, list_events      to authenticated;
grant select, delete                 on list_invites                              to authenticated;


-- ---------------------------------------------------------------------
--  4. Listas, enlaces, contactos e invitaciones
-- ---------------------------------------------------------------------

-- Al entrar alguien a una lista, queda como contacto de todos los que están en ella (y viceversa)
create or replace function public.link_contacts(_list uuid, _user uuid)
returns void language sql security definer set search_path = public as $$
  insert into contacts (user_id, contact_id)
  select _user, m.user_id from list_members m where m.list_id = _list and m.user_id <> _user
  union
  select m.user_id, _user from list_members m where m.list_id = _list and m.user_id <> _user
  on conflict do nothing;
$$;

-- Crear lista (quien la crea queda como miembro) e invitar de una vez a contactos (opcional)
create or replace function public.create_list(
  list_name    text,
  p_show_names boolean default false,
  p_invite     uuid[]  default '{}'
)
returns uuid language plpgsql security definer set search_path = public as $$
declare new_id uuid; u uuid;
begin
  insert into lists (name, owner, show_names, updated_at, updated_by)
  values (list_name, auth.uid(), p_show_names, now(), auth.uid())
  returning id into new_id;
  insert into list_members (list_id, user_id, role) values (new_id, auth.uid(), 'owner');
  foreach u in array coalesce(p_invite, '{}') loop
    if exists (select 1 from contacts where user_id = auth.uid() and contact_id = u) then
      insert into list_invites (list_id, from_user, to_user) values (new_id, auth.uid(), u)
      on conflict do nothing;
    end if;
  end loop;
  return new_id;
end; $$;

-- Generar un enlace para compartir la lista
create or replace function public.create_invite(p_list_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare t uuid;
begin
  if not public.is_member(p_list_id) then raise exception 'No perteneces a esta lista'; end if;
  insert into invites (list_id, created_by) values (p_list_id, auth.uid()) returning token into t;
  return t;
end; $$;

-- Nombre de la lista de un enlace (para la pantalla de aceptar)
create or replace function public.invite_info(p_token uuid)
returns json language plpgsql security definer set search_path = public as $$
declare l record;
begin
  select lists.id, lists.name into l
  from invites join lists on lists.id = invites.list_id
  where invites.token = p_token;
  if not found then return null; end if;
  return json_build_object('id', l.id, 'name', l.name);
end; $$;

-- Aceptar un enlace: te suma a la lista y crea los contactos
create or replace function public.accept_invite(p_token uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare l_id uuid;
begin
  select list_id into l_id from invites where token = p_token;
  if l_id is null then raise exception 'Invitación inválida'; end if;
  insert into list_members (list_id, user_id, role) values (l_id, auth.uid(), 'member')
  on conflict (list_id, user_id) do nothing;
  perform public.link_contacts(l_id, auth.uid());
  delete from list_invites where list_id = l_id and to_user = auth.uid();
  return l_id;
end; $$;

-- Mis contactos, con su nombre
create or replace function public.my_contacts()
returns table (id uuid, name text) language sql security definer stable set search_path = public as $$
  select c.contact_id, coalesce(nullif(p.name, ''), split_part(p.email, '@', 1))
  from contacts c left join profiles p on p.id = c.contact_id
  where c.user_id = auth.uid()
  order by 2;
$$;

-- Invitaciones que me llegaron (con el nombre de la lista y de quien invita)
create or replace function public.my_invites()
returns table (id uuid, list_id uuid, list_name text, from_name text)
language sql security definer stable set search_path = public as $$
  select i.id, i.list_id, l.name, coalesce(nullif(p.name, ''), split_part(p.email, '@', 1))
  from list_invites i
  join lists l on l.id = i.list_id
  left join profiles p on p.id = i.from_user
  where i.to_user = auth.uid()
  order by i.created_at;
$$;

-- Invitar a un contacto a una lista
create or replace function public.invite_contact(p_list_id uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_member(p_list_id) then raise exception 'No perteneces a esta lista'; end if;
  if not exists (select 1 from contacts where user_id = auth.uid() and contact_id = p_user) then
    raise exception 'Esa persona no está en tus contactos';
  end if;
  if exists (select 1 from list_members where list_id = p_list_id and user_id = p_user) then
    return; -- ya está en la lista
  end if;
  insert into list_invites (list_id, from_user, to_user) values (p_list_id, auth.uid(), p_user)
  on conflict (list_id, to_user) do nothing;
end; $$;

-- Aceptar una invitación de un contacto
create or replace function public.accept_list_invite(p_invite uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare l_id uuid;
begin
  select list_id into l_id from list_invites where id = p_invite and to_user = auth.uid();
  if l_id is null then raise exception 'Invitación no encontrada'; end if;
  insert into list_members (list_id, user_id, role) values (l_id, auth.uid(), 'member')
  on conflict (list_id, user_id) do nothing;
  perform public.link_contacts(l_id, auth.uid());
  delete from list_invites where id = p_invite;
  return l_id;
end; $$;

-- Salir de una lista compartida (quien la creó no sale: la borra) y avisar al resto
create or replace function public.leave_list(p_list_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare who text;
begin
  if exists (select 1 from lists where id = p_list_id and owner = auth.uid()) then
    raise exception 'Creaste esta lista: puedes borrarla, pero no salir de ella';
  end if;
  delete from list_members where list_id = p_list_id and user_id = auth.uid();
  if not found then return; end if;
  select coalesce(nullif(name, ''), split_part(email, '@', 1)) into who from profiles where id = auth.uid();
  insert into list_activity (list_id, user_name, kind) values (p_list_id, who, 'left');
end; $$;


-- ---------------------------------------------------------------------
--  5. Triggers
-- ---------------------------------------------------------------------

-- Perfil automático al registrarse
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email) on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- Solo quien creó la lista puede cambiarle el nombre (y nadie puede cambiar quién la creó)
create or replace function public.guard_list_update()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.owner is distinct from old.owner then
    raise exception 'No se puede cambiar quién creó la lista';
  end if;
  if new.name is distinct from old.name and old.owner is distinct from auth.uid() then
    raise exception 'Solo quien creó la lista puede cambiarle el nombre';
  end if;
  return new;
end; $$;

drop trigger if exists lists_guard on lists;
create trigger lists_guard before update on lists
for each row execute function public.guard_list_update();

-- "Última actualización": cada cambio en los artículos anota cuándo y quién
create or replace function public.touch_list()
returns trigger language plpgsql security definer set search_path = public as $$
declare ids uuid[];
begin
  if tg_op = 'INSERT' then ids := array[new.list_id];
  elsif tg_op = 'DELETE' then ids := array[old.list_id];
  else ids := array[new.list_id, old.list_id];  -- incluye mover a otra lista
  end if;
  update lists set updated_at = now(), updated_by = auth.uid()
   where id = any(ids)
     -- evita repetir la anotación muchas veces seguidas (ej. "Borrar todos")
     and (updated_at is null
          or updated_at < now() - interval '3 seconds'
          or updated_by is distinct from auth.uid());
  return null;
end; $$;

drop trigger if exists items_touch_list on items;
create trigger items_touch_list after insert or update or delete on items
for each row execute function public.touch_list();

-- Historial: anota una acción (solo si la lista sigue existiendo)
create or replace function public.log_event(_list uuid, _kind text, _item uuid, _name text, _extra text)
returns void language plpgsql security definer set search_path = public as $$
declare who text;
begin
  if not exists (select 1 from lists where id = _list) then return; end if;
  select coalesce(nullif(name, ''), split_part(email, '@', 1)) into who from profiles where id = auth.uid();
  insert into list_events (list_id, user_id, user_name, kind, item_id, item_name, extra)
  values (_list, auth.uid(), who, _kind, _item, _name, _extra);
end; $$;

-- Historial: acciones sobre artículos
create or replace function public.log_item_event()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_event(new.list_id, 'add', new.id, new.name, null);
  elsif tg_op = 'DELETE' then
    perform public.log_event(old.list_id, 'delete', old.id, old.name, null);
  else
    if new.list_id is distinct from old.list_id then
      perform public.log_event(old.list_id, 'move', new.id, new.name, (select name from lists where id = new.list_id));
      perform public.log_event(new.list_id, 'move_in', new.id, new.name, (select name from lists where id = old.list_id));
      return null;
    end if;
    if new.bought and not old.bought then
      perform public.log_event(new.list_id, 'buy', new.id, new.name, null);
    elsif old.bought and not new.bought then
      perform public.log_event(new.list_id, 'unbuy', new.id, new.name, null);
    end if;
    if new.name is distinct from old.name then
      perform public.log_event(new.list_id, 'rename_item', new.id, new.name, old.name);
    end if;
  end if;
  return null;
end; $$;

drop trigger if exists items_log on items;
create trigger items_log after insert or update or delete on items
for each row execute function public.log_item_event();

-- Historial: cambio de nombre de la lista
create or replace function public.log_list_event()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.name is distinct from old.name then
    perform public.log_event(new.id, 'rename_list', null, new.name, old.name);
  end if;
  return null;
end; $$;

drop trigger if exists lists_log on lists;
create trigger lists_log after update on lists
for each row execute function public.log_list_event();


-- ---------------------------------------------------------------------
--  6. Permisos de las funciones
-- ---------------------------------------------------------------------

-- Funciones internas: solo las usan otras funciones o triggers
revoke execute on function public.link_contacts(uuid, uuid)                  from public, anon, authenticated;
revoke execute on function public.log_event(uuid, text, uuid, text, text)    from public, anon, authenticated;

-- Funciones que llama la app
grant execute on function public.create_list(text, boolean, uuid[]) to authenticated;
grant execute on function public.create_invite(uuid)                to authenticated;
grant execute on function public.invite_info(uuid)                  to authenticated;
grant execute on function public.accept_invite(uuid)                to authenticated;
grant execute on function public.my_contacts()                      to authenticated;
grant execute on function public.my_invites()                       to authenticated;
grant execute on function public.invite_contact(uuid, uuid)         to authenticated;
grant execute on function public.accept_list_invite(uuid)           to authenticated;
grant execute on function public.leave_list(uuid)                   to authenticated;


-- ---------------------------------------------------------------------
--  7. Tiempo real (los cambios llegan al instante a todos)
-- ---------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['items', 'lists', 'list_members', 'list_invites', 'list_activity', 'list_events'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;  -- ya estaba agregada
    end;
  end loop;
end $$;
