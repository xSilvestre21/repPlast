-- ---------------------------------------------------------------------------
-- A indústria de um pedido que o preposto vê continua legível para ele
-- ---------------------------------------------------------------------------

-- Com a regra estrita (`industria_so_do_preposto_marcado`), o preposto passou a
-- enxergar pedidos e orçamentos — os dele e os do escritório — de indústrias
-- que não estão marcadas para ele, mas não a indústria em si. O pedido chegava
-- com a indústria vazia, e toda tela que mostra o nome dela quebrava.
--
-- A LEITURA da indústria passa a valer também quando há pedido ou orçamento
-- dela que o preposto vê. As subconsultas rodam como ele, sob o RLS do pedido
-- e do orçamento — então "que ele vê" é exatamente o que essas policies dizem,
-- sem repetir a regra aqui. O catálogo (produto, material, aditivo, contatos)
-- continua preso a `app_ve_fornecedor`: ele lê o nome, não o que se vende.
--
-- A ESCRITA continua estrita, e quem decide o que aparece para escolher é a
-- aplicação (`soIndustriasMarcadas`), já que ler não é mais o mesmo que poder
-- usar.
DROP POLICY tenant_isolation ON "fornecedor";
CREATE POLICY tenant_isolation ON "fornecedor"
  USING (app_bypass_rls() OR (
    "organizacaoId" = app_organizacao_id() AND (
      app_ve_fornecedor("id")
      OR EXISTS (SELECT 1 FROM "pedido" p WHERE p."fornecedorId" = "fornecedor"."id")
      OR EXISTS (SELECT 1 FROM "orcamento" o WHERE o."fornecedorId" = "fornecedor"."id"))))
  WITH CHECK (app_bypass_rls() OR (
    "organizacaoId" = app_organizacao_id() AND app_ve_fornecedor("id")));

-- Lançar pedido ou orçamento novo exige a indústria marcada. Só na criação:
-- o pedido que ele já tem continua dele para acompanhar e mudar de situação.
-- RESTRICTIVE soma-se à `tenant_isolation` em vez de afrouxá-la.
CREATE POLICY industria_marcada ON "pedido" AS RESTRICTIVE FOR INSERT
  WITH CHECK (app_bypass_rls() OR app_ve_fornecedor("fornecedorId"));

CREATE POLICY industria_marcada ON "orcamento" AS RESTRICTIVE FOR INSERT
  WITH CHECK (app_bypass_rls() OR app_ve_fornecedor("fornecedorId"));

-- A subconsulta acima procura orçamento por indústria; o pedido já tem o
-- índice único (fornecedorId, numero) que serve a mesma busca.
CREATE INDEX "orcamento_fornecedorId_idx" ON "orcamento"("fornecedorId");
