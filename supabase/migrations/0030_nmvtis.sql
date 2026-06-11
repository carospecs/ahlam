-- Ahlam migration 0030: NMVTIS reporting scaffolding (CMP-1).
--
-- US auto dismantlers/recyclers are legally required to report the junk/salvage
-- vehicles they obtain to the National Motor Vehicle Title Information System
-- (NMVTIS). A licensed yard can't fully replace its existing system without this.
-- This adds the fields an NMVTIS junk/salvage report needs, plus a per-shop
-- reporting-entity ID. The export route derives sensible defaults (date obtained
-- from created_at, disposition from sell_mode) so it works on existing data, and
-- these columns let a yard record the exact values when they have them.

-- ---------------------------------------------------------------------------
-- Shop = the reporting entity. nmvtis_id is the recycler's NMVTIS reporting ID;
-- nmvtis_entity_name overrides the public shop name on the filing if they differ.
-- ---------------------------------------------------------------------------
do $do$ begin
  alter table shops add column if not exists nmvtis_id text;
  alter table shops add column if not exists nmvtis_entity_name text;
end $do$;

-- ---------------------------------------------------------------------------
-- Per-vehicle NMVTIS fields:
--   date_obtained        - when the yard acquired the vehicle (defaults to
--                          created_at in the export if left null)
--   obtained_from_name   - name of the party the vehicle was obtained from
--   obtained_from_address- their address
--   nmvtis_disposition   - 'crush' | 'scrap' | 'sold' | 'parts' | 'export'
--                          (derived from sell_mode in the export if null)
--   nmvtis_reported_at   - set when included in a generated report (audit trail)
--   nmvtis_period        - the YYYY-MM reporting period it was reported under
-- ---------------------------------------------------------------------------
do $do$ begin
  alter table vehicles add column if not exists date_obtained date;
  alter table vehicles add column if not exists obtained_from_name text;
  alter table vehicles add column if not exists obtained_from_address text;
  alter table vehicles add column if not exists nmvtis_disposition text;
  alter table vehicles add column if not exists nmvtis_reported_at timestamptz;
  alter table vehicles add column if not exists nmvtis_period text;
end $do$;
