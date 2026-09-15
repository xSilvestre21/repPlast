-- O preposto enxerga apenas a PRÓPRIA linha de usuário.
--
-- Até aqui a policy separava só escritório de escritório, o que bastava quando
-- todo usuário era dono da operação. Com preposto no mesmo escritório, a linha
-- do colega passa a conter coisa que não é dele — a começar por `senhaHash`.
--
-- O login não depende disto: `sessaoAtual()` lê pelo cliente administrativo,
-- porque na hora de resolver o cookie ainda não se sabe de quem é a sessão.
DROP POLICY tenant_isolation ON "usuario";
CREATE POLICY tenant_isolation ON "usuario"
  USING (app_bypass_rls() OR (
    "organizacaoId" = app_organizacao_id()
    AND (app_e_admin() OR "id" = app_usuario_id())))
  WITH CHECK (app_bypass_rls() OR (
    "organizacaoId" = app_organizacao_id()
    AND (app_e_admin() OR "id" = app_usuario_id())));
