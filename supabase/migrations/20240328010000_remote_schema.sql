drop policy "Articles are insertable by authenticated users." on "public"."articles";

drop policy "Email events are insertable by service role." on "public"."email_events";

drop policy "Email events are viewable by authenticated users." on "public"."email_events";

revoke delete on table "public"."email_events" from "anon";

revoke insert on table "public"."email_events" from "anon";

revoke references on table "public"."email_events" from "anon";

revoke select on table "public"."email_events" from "anon";

revoke trigger on table "public"."email_events" from "anon";

revoke truncate on table "public"."email_events" from "anon";

revoke update on table "public"."email_events" from "anon";

revoke delete on table "public"."email_events" from "authenticated";

revoke insert on table "public"."email_events" from "authenticated";

revoke references on table "public"."email_events" from "authenticated";

revoke select on table "public"."email_events" from "authenticated";

revoke trigger on table "public"."email_events" from "authenticated";

revoke truncate on table "public"."email_events" from "authenticated";

revoke update on table "public"."email_events" from "authenticated";

revoke delete on table "public"."email_events" from "service_role";

revoke insert on table "public"."email_events" from "service_role";

revoke references on table "public"."email_events" from "service_role";

revoke select on table "public"."email_events" from "service_role";

revoke trigger on table "public"."email_events" from "service_role";

revoke truncate on table "public"."email_events" from "service_role";

revoke update on table "public"."email_events" from "service_role";

alter table "public"."email_events" drop constraint "email_events_pkey";

drop index if exists "public"."articles_doi_idx";

drop index if exists "public"."articles_link_idx";

drop index if exists "public"."email_events_email_idx";

drop index if exists "public"."email_events_event_type_idx";

drop index if exists "public"."email_events_pkey";

drop index if exists "public"."email_events_timestamp_idx";

drop table "public"."email_events";

alter table "public"."articles" drop column "abstract";

alter table "public"."articles" drop column "doi";

alter table "public"."articles" drop column "journal";

alter table "public"."articles" drop column "publication_date";

alter table "public"."articles" add column "design" text;

alter table "public"."articles" add column "duration" text;

alter table "public"."articles" add column "effect_size" text;

alter table "public"."articles" add column "is_trending" boolean default false;

alter table "public"."articles" add column "rigor" text;

alter table "public"."articles" add column "sample" text;

alter table "public"."articles" add column "trending_rank" integer;

alter table "public"."articles" alter column "authors" set data type text using "authors"::text;

alter table "public"."articles" alter column "id" set default uuid_generate_v4();

alter table "public"."articles" alter column "id" set data type uuid using "id"::uuid;

CREATE UNIQUE INDEX articles_link_key ON public.articles USING btree (link);

alter table "public"."articles" add constraint "articles_link_key" UNIQUE using index "articles_link_key";


