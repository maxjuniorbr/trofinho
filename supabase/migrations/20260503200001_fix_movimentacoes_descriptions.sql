-- Fix remaining description inconsistencies in movimentacoes.
--
-- resgate_cofrinho: fix stray ")" and trailing zeros from old format
--   e.g. "Taxa 5.00%): recebeu 76 pts" → "Taxa 5% · recebeu 76 pts"
--
-- Idempotent: WHERE clause only matches malformed rows.

-- Pattern: "Taxa X.Y0%): recebeu N pts" or "Taxa X.00%): recebeu N pts"
-- Rebuild into clean format: "Taxa X% · recebeu N pts" (trailing zeros stripped).
UPDATE public.movimentacoes
   SET descricao = 'Taxa '
                  || regexp_replace(
                       regexp_replace(
                         (regexp_match(descricao, 'Taxa ([0-9]+(?:\.[0-9]+)?)'))[1],
                         '\.?0+$', ''),
                       '\.$', '')
                  || '% · recebeu '
                  || (regexp_match(descricao, 'recebeu ([0-9]+) pts'))[1]
                  || ' pts'
 WHERE tipo = 'resgate_cofrinho'
   AND descricao ~ 'Taxa [0-9].*recebeu [0-9]+ pts'
   AND (descricao LIKE '%): recebeu%'
    OR descricao ~ 'Taxa [0-9]+\.[0-9]*0+%');
