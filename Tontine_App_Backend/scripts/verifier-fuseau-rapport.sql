-- =============================================================================
-- Script de vérification : expression SQL de regroupement par mois (rapport)
-- =============================================================================
-- À coller dans pgAdmin ou psql. Ne modifie aucune donnée (SELECT uniquement).
--
-- Contexte :
--   La colonne ecritures_comptables.date est TIMESTAMPTZ.
--   L'expression utilisée dans rapport.service.ts est :
--     TO_CHAR(e.date AT TIME ZONE 'Africa/Porto-Novo', 'YYYY-MM')
--
--   Pour une colonne TIMESTAMPTZ, "AT TIME ZONE 'Africa/Porto-Novo'" suffit :
--   PostgreSQL interprète la valeur comme un instant absolu et la convertit
--   directement en heure locale Bénin (UTC+1 fixe).
--   Il n'est PAS nécessaire de faire (e.date AT TIME ZONE 'UTC') AT TIME ZONE
--   'Africa/Porto-Novo' (double-cast réservé aux colonnes TIMESTAMP sans fuseau).
--
-- Résultats attendus :
--   2026-11-30 22:30 UTC  →  23:30 Porto-Novo (même jour)   →  2026-11
--   2026-11-30 23:30 UTC  →  00:30 le 1er décembre Porto-Novo  →  2026-12
--   2026-12-01 00:10 UTC  →  01:10 Porto-Novo (même jour)   →  2026-12
-- =============================================================================

SELECT
  instant_utc,
  instant_utc AT TIME ZONE 'Africa/Porto-Novo'                AS heure_locale_porto_novo,
  TO_CHAR(instant_utc AT TIME ZONE 'Africa/Porto-Novo', 'YYYY-MM') AS mois_rapport,
  resultat_attendu
FROM (
  VALUES
    (
      TIMESTAMPTZ '2026-11-30 22:30:00 UTC',
      '2026-11  ← 23h30 Porto-Novo, encore novembre'
    ),
    (
      TIMESTAMPTZ '2026-11-30 23:30:00 UTC',
      '2026-12  ← 00h30 le 1er déc Porto-Novo, déjà décembre'
    ),
    (
      TIMESTAMPTZ '2026-12-01 00:10:00 UTC',
      '2026-12  ← 01h10 Porto-Novo, décembre'
    )
) AS t(instant_utc, resultat_attendu);
