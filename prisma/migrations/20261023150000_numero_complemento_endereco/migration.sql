-- Número e complemento separados da rua, em cliente e indústria — como no
-- cadastro do escritório, para o CEP preencher a rua e o cursor ir ao número.
--
-- O endereço vinha inteiro num campo só ("Rua X, 123 Galpão F"), como no SICOV.
-- `separar_numero_do_endereco` reparte o que já está gravado e fica no banco
-- para o importador do SICOV usar no que chegar depois (scripts/importar-sicov.ts).
-- O que não tem número claro — rodovia com km, fazenda, "Galpão 01 Quadra 485" —
-- fica inteiro na rua, como estava: errar o número é pior que não separá-lo.
-- O PDF do pedido junta tudo de volta numa linha (`enderecoCompleto`).

ALTER TABLE "cliente" ADD COLUMN "numero" TEXT, ADD COLUMN "complemento" TEXT;
ALTER TABLE "fornecedor" ADD COLUMN "numero" TEXT, ADD COLUMN "complemento" TEXT;

-- Regras, na ordem:
--   1. a primeira vírgula seguida do número: "Rua X, 123 Galpão F", "Av. A, nº 500",
--      "Rua Y,46/66 - Jd. Ind.", "Rua Z, 651B", "Estrada W, S/N". O que vem depois
--      do número é o complemento. A rua não termina em dígito antes da vírgula, o
--      que deixa de fora o "Km131,0".
--   2. sem vírgula, só o número no fim: "Av. Dom Pedro I 1154", "Estrada do
--      Mirante S/N" — menos rodovia ("SP 215", "Km 172"), onde o número é da via.
-- Sem regra que sirva, `numero` volta nulo e a rua é o texto como veio.
CREATE OR REPLACE FUNCTION separar_numero_do_endereco(
  texto TEXT, OUT rua TEXT, OUT numero TEXT, OUT complemento TEXT
) LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  t TEXT := btrim(regexp_replace(coalesce(texto, ''), '\s+', ' ', 'g'));
  m TEXT[];
BEGIN
  rua := nullif(t, '');
  IF rua IS NULL THEN RETURN; END IF;

  -- "Rua X, 123 Galpão F": a primeira vírgula, seguida do número.
  m := regexp_match(t, '^([^,]*[^0-9 ,]) ?, ?(?:n[º°o]\.? ?)?(s/n|[0-9][0-9.]*(?:/[0-9]+)?[a-z]?)(?: ?[-–] ?| |$)(.*)$', 'i');
  -- "Av. Dom Pedro I 1154": sem vírgula, só com o número no fim.
  IF m IS NULL AND t !~* '(km|sp|br) ?[0-9]+$' THEN
    m := regexp_match(t, '^([^,]*[^0-9 ,]) (s/n|[0-9]+[a-z]?)()$', 'i');
  END IF;
  IF m IS NULL THEN RETURN; END IF;

  rua := m[1];
  numero := CASE WHEN lower(m[2]) = 's/n' THEN 'S/N' ELSE m[2] END;
  complemento := nullif(btrim(m[3]), '');
END
$$;

-- O dono do banco também passa pelo RLS forçado e pelo trigger de cadastro só
-- do admin: o escape das migrations, ligado só para os dois UPDATEs.
SELECT set_config('app.bypass_rls', 'on', false);

UPDATE "cliente" c
SET "endereco" = s.rua, "numero" = s.numero, "complemento" = s.complemento
FROM "cliente" o, separar_numero_do_endereco(o."endereco") s
WHERE c."id" = o."id" AND s.numero IS NOT NULL;

UPDATE "fornecedor" f
SET "endereco" = s.rua, "numero" = s.numero, "complemento" = s.complemento
FROM "fornecedor" o, separar_numero_do_endereco(o."endereco") s
WHERE f."id" = o."id" AND s.numero IS NOT NULL;

SELECT set_config('app.bypass_rls', 'off', false);
