
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid()
    references auth.users(id) on delete cascade,
  title text not null,
  category text not null default 'Blog',
  excerpt text default '',
  content text not null,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.posts enable row level security;

-- Everyone can read published posts.
create policy "Anyone can read published posts"
on public.posts
for select
to anon, authenticated
using (is_published = true);

-- The author can also read their own drafts.
create policy "Author can read own posts"
on public.posts
for select
to authenticated
using (auth.uid() = author_id);

-- Only authenticated author accounts can create posts.
create policy "Author can create posts"
on public.posts
for insert
to authenticated
with check (auth.uid() = author_id);

-- Authors can edit their own posts.
create policy "Author can update own posts"
on public.posts
for update
to authenticated
using (auth.uid() = author_id)
with check (auth.uid() = author_id);

-- Authors can delete their own posts.
create policy "Author can delete own posts"
on public.posts
for delete
to authenticated
using (auth.uid() = author_id);

create index posts_published_date_idx
on public.posts (created_at desc)
where is_published = true;
