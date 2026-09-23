-- A cidade que abre a proposta passa a ser a de QUEM ESCREVE.
--
-- O cabeçalho é a abertura de uma carta — "Americana, 16 de Setembro de 2026" —
-- e até aqui a cidade vinha do fornecedor. Dizia ao cliente que a proposta foi
-- escrita na cidade da fábrica, que pode estar a 400 km de quem assinou embaixo.
--
-- `usuario.municipio` é de cada um, como `observacoesPadrao`: prepostos moram em
-- cidades diferentes. `orcamento.cidade` é a cópia congelada na criação, do mesmo
-- jeito que `vendedor` já é — reimprimir uma proposta antiga tem de sair igual ao
-- papel que o cliente recebeu, mesmo depois de o representante se mudar.
--
-- Nada é preenchido retroativamente: proposta antiga fica sem cidade e passa a
-- abrir só com a data, que é discreto. Repetir ali a cidade da indústria seria
-- gravar como fato a informação que esta migration existe para corrigir.
ALTER TABLE "usuario" ADD COLUMN "municipio" TEXT;
ALTER TABLE "orcamento" ADD COLUMN "cidade" TEXT;
