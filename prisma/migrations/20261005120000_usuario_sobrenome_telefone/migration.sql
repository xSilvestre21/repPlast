-- Nome e sobrenome em campos separados, e telefone de contato.
--
-- Até aqui o nome era um campo só ("Maria Augusta Ferraz"). A ficha do preposto
-- passa a mostrar e editar nome e sobrenome à parte; o nome inteiro, onde o
-- sistema o exibe ou imprime, é montado por `nomeCompleto()`.
ALTER TABLE "usuario" ADD COLUMN "sobrenome" TEXT,
ADD COLUMN "telefone" TEXT;

-- Separa os nomes que já existem: a primeira palavra fica como nome, o resto
-- vira sobrenome. Quem tem uma palavra só fica intocado. Vale para todo
-- usuário, administrador inclusive, para o dado ficar de um jeito só.
UPDATE "usuario"
SET "sobrenome" = btrim(substring(btrim("nome") FROM position(' ' IN btrim("nome")) + 1)),
    "nome" = split_part(btrim("nome"), ' ', 1)
WHERE position(' ' IN btrim("nome")) > 0;
