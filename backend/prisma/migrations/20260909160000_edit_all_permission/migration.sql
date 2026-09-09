-- Add edit_all / edit to system roles without wiping custom permissions.
UPDATE "Role"
SET permissions = (
  SELECT jsonb_agg(DISTINCT value)
  FROM (
    SELECT value FROM jsonb_array_elements(COALESCE(permissions::jsonb, '[]'::jsonb))
    UNION ALL
    SELECT value FROM jsonb_array_elements('["edit_all"]'::jsonb)
  ) AS t(value)
)
WHERE slug = 'admin'
  AND NOT (COALESCE(permissions::jsonb, '[]'::jsonb) @> '"edit_all"'::jsonb);

UPDATE "Role"
SET permissions = (
  SELECT jsonb_agg(DISTINCT value)
  FROM (
    SELECT value FROM jsonb_array_elements(COALESCE(permissions::jsonb, '[]'::jsonb))
    UNION ALL
    SELECT value FROM jsonb_array_elements('["edit"]'::jsonb)
  ) AS t(value)
)
WHERE slug IN ('master', 'keeper')
  AND NOT (COALESCE(permissions::jsonb, '[]'::jsonb) @> '"edit"'::jsonb);
