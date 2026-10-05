-- =============================================================================
-- Crisis Care — Migration 004: Widen hospitals.phone column
--
-- OSM phone tags include country codes, extensions and multiple numbers
-- separated by semicolons (e.g. "+91 22 2308 7000; +91 22 2308 8000")
-- which easily exceed the V1 varchar(20) limit.
-- Widen to 100 characters to accommodate real OSM data.
-- =============================================================================

ALTER TABLE hospitals
  ALTER COLUMN phone TYPE CHARACTER VARYING(100);
