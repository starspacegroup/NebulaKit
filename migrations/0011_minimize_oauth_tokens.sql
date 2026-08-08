-- NebulaKit uses provider tokens only during the OAuth callback to fetch identity.
-- Remove legacy credentials so D1 retains account links, not reusable provider access.
UPDATE oauth_accounts
SET access_token = NULL,
    refresh_token = NULL
WHERE access_token IS NOT NULL
   OR refresh_token IS NOT NULL;
