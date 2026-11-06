-- ============================================================================
-- db/seed.sql — SAMPLE LISTINGS (students run this on their OWN project)
-- Spec: pos-catalog-site-core  |  Task 10
-- Target: Supabase (PostgreSQL)
-- ----------------------------------------------------------------------------
-- Inserts a mix of PUBLISHED and UNPUBLISHED listings so the catalog isn't
-- empty after provisioning (Session 2, Step 4). Run this AFTER db/setup.sql.
--
-- The published rows mirror the editable content in content/listings.ts and
-- reference image files already committed under public/images/ (so the images
-- render with no extra upload). One UNPUBLISHED (draft) row is included on
-- purpose: it stays hidden from the public catalog under RLS but is visible to
-- STAFF/ADMIN — handy for the Session 3 publish demo and for seeing RLS decide
-- visibility by role.
--
-- IDEMPOTENT — safe to re-run. Each insert is guarded by a NOT EXISTS check on
-- the title, so running this twice does not create duplicate listings.
--
-- NOTE on images: catalog images are static files under public/images/, NOT
-- object storage. image_url is a site-relative path (e.g. /images/foo.svg).
-- When you customize the catalog (Session 1), drop your own image into
-- public/images/ and point image_url at it.
-- ============================================================================

-- Published: IT Strategy Consulting (INQUIRE)
insert into public.listings (title, category, description, inquiry_type, image_url, is_published)
select
  'IT Strategy Consulting',
  'CONSULTING',
  'Work with our consultants to map your technology roadmap, assess risk, and plan the systems your business needs over the next 12 months.',
  'INQUIRE',
  '/images/placeholder-consulting.svg',
  true
where not exists (
  select 1 from public.listings where title = 'IT Strategy Consulting'
);

-- Published: Business Website Build (QUOTE)
insert into public.listings (title, category, description, inquiry_type, image_url, is_published)
select
  'Business Website Build',
  'WEB_DEV',
  'A fast, modern marketing website with a content system you can update yourself. Request a quote and we will scope it with you.',
  'QUOTE',
  '/images/placeholder-web-dev.svg',
  true
where not exists (
  select 1 from public.listings where title = 'Business Website Build'
);

-- Published: Custom Inventory Management App (DEMO)
insert into public.listings (title, category, description, inquiry_type, image_url, is_published)
select
  'Custom Inventory Management App',
  'CUSTOM_SOFTWARE',
  'A tailored inventory and ordering application built around your workflow. Book a live demo to see a working example.',
  'DEMO',
  '/images/placeholder-custom-software.svg',
  true
where not exists (
  select 1 from public.listings where title = 'Custom Inventory Management App'
);

-- UNPUBLISHED (draft): Cloud Migration Assessment (QUOTE)
-- Hidden from the public catalog by RLS; visible to STAFF/ADMIN. Publish it in
-- the Admin dashboard (Session 3) to see it appear in the public catalog.
insert into public.listings (title, category, description, inquiry_type, image_url, is_published)
select
  'Cloud Migration Assessment',
  'CONSULTING',
  'A draft listing: an assessment of your current infrastructure with a staged plan to migrate to the cloud. Publish this from the Admin dashboard to make it public.',
  'QUOTE',
  '/images/placeholder-consulting.svg',
  false
where not exists (
  select 1 from public.listings where title = 'Cloud Migration Assessment'
);
