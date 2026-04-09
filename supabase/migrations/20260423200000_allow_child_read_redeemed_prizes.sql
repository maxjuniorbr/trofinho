-- Allow children to read prize data for prizes they have redeemed,
-- even when the prize is inactive (ativo = false).
-- This fixes "Prêmio removido" appearing in historical redemption lists.

CREATE POLICY "premios_select_filho_resgatados"
  ON "public"."premios"
  FOR SELECT
  USING (
    "public"."meu_papel"() = 'filho'
    AND "familia_id" = "public"."minha_familia_id"()
    AND "id" IN (
      SELECT "premio_id"
        FROM "public"."resgates"
       WHERE "filho_id" = "public"."meu_filho_id"()
    )
  );
