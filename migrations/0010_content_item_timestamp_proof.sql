-- Migration: provable timestamping bookkeeping for content items
-- Adds RFC 3161 timestamp-proof and Wayback Machine snapshot columns,
-- plus lightweight resolution provenance. Populated only for content
-- types that opt in (settings.enableTimestampProof).

ALTER TABLE content_items ADD COLUMN timestamp_proof_hash TEXT;
ALTER TABLE content_items ADD COLUMN timestamp_proof_tsr TEXT;
ALTER TABLE content_items ADD COLUMN timestamp_proof_requested_at TEXT;
ALTER TABLE content_items ADD COLUMN timestamp_proof_tsa_url TEXT;
ALTER TABLE content_items ADD COLUMN timestamp_proof_error TEXT;
ALTER TABLE content_items ADD COLUMN wayback_snapshot_url TEXT;
ALTER TABLE content_items ADD COLUMN wayback_checked_at TEXT;
ALTER TABLE content_items ADD COLUMN resolution_resolved_at TEXT;
ALTER TABLE content_items ADD COLUMN resolution_resolved_by TEXT;
