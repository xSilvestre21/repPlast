-- ---------------------------------------------------------------------------
-- O preposto só vê a indústria marcada para ele
-- ---------------------------------------------------------------------------

-- Antes, indústria SEM nenhuma linha em `fornecedor_preposto` era de todos, e
-- marcar alguém fechava para os outros. Isso fazia a marca de um preposto mexer
-- no que os colegas viam, e por isso só dava para editar pela indústria. Agora
-- a regra é por preposto: ele vê exatamente o que está marcado para ele, e sem
-- nenhuma marca não vê indústria nenhuma.
--
-- Continua SECURITY DEFINER pelo mesmo motivo de antes: a contagem precisa ser
-- a real, e não a filtrada pelo RLS de `fornecedor_preposto`. As policies de
-- fornecedor, produto, material, aditivo e contatos chamam esta função, e por
-- isso nenhuma delas precisa ser recriada.
CREATE OR REPLACE FUNCTION app_ve_fornecedor(fornecedor_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
  SELECT app_e_admin()
      OR EXISTS (
           SELECT 1 FROM "fornecedor_preposto"
           WHERE "fornecedorId" = fornecedor_id AND "usuarioId" = app_usuario_id())
$fn$;

-- Quem já trabalha com uma indústria continua vendo-a: o vínculo nasce de todo
-- pedido, orçamento ou produto que já liga o preposto a ela — o lançado por
-- ele e o de cliente da carteira dele. Sem isso, a troca de regra apagaria da
-- tela de cada preposto a indústria dos próprios pedidos.
INSERT INTO "fornecedor_preposto" ("fornecedorId", "usuarioId")
SELECT DISTINCT v."fornecedorId", v."usuarioId"
FROM (
  SELECT "fornecedorId", "representanteId" AS "usuarioId" FROM "pedido"
  UNION
  SELECT "fornecedorId", "representanteId" FROM "orcamento"
  UNION
  SELECT p."fornecedorId", c."representanteId"
  FROM "pedido" p JOIN "cliente" c ON c."id" = p."clienteId"
  UNION
  SELECT o."fornecedorId", c."representanteId"
  FROM "orcamento" o JOIN "cliente" c ON c."id" = o."clienteId"
  UNION
  SELECT p."fornecedorId", c."representanteId"
  FROM "produto" p JOIN "cliente" c ON c."id" = p."clienteId"
) v
JOIN "usuario" u ON u."id" = v."usuarioId" AND u."papel" = 'REPRESENTANTE'
JOIN "fornecedor" f ON f."id" = v."fornecedorId" AND f."organizacaoId" = u."organizacaoId"
ON CONFLICT DO NOTHING;
