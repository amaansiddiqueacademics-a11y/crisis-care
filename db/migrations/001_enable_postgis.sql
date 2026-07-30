-- Migration 001: Enable PostGIS extension
-- Must run before any geography/geometry columns are created.

CREATE EXTENSION IF NOT EXISTS postgis;
