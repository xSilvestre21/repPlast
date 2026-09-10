-- CreateEnum
CREATE TYPE "Familia" AS ENUM ('SACO', 'FITA', 'STRETCH', 'BOBINA');

-- CreateEnum
CREATE TYPE "TipoAditivo" AS ENUM ('POR_KG', 'POR_MILHEIRO');

-- CreateEnum
CREATE TYPE "UnidadeVenda" AS ENUM ('MIL', 'KG', 'UN', 'CX');

-- CreateEnum
CREATE TYPE "StatusPedido" AS ENUM ('ABERTO', 'ENVIADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "TipoFrete" AS ENUM ('CIF', 'FOB');

-- CreateEnum
CREATE TYPE "UnidadeMeta" AS ENUM ('REAIS', 'KG');

-- CreateEnum
CREATE TYPE "ModoFaixa" AS ENUM ('PROGRESSIVA', 'RETROATIVA');

-- CreateEnum
CREATE TYPE "TipoLancamento" AS ENUM ('LANCAMENTO', 'ESTORNO', 'AJUSTE');

-- CreateTable
CREATE TABLE "organizacao" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organizacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario" (
    "id" UUID NOT NULL,
    "organizacaoId" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cliente" (
    "id" UUID NOT NULL,
    "organizacaoId" UUID NOT NULL,
    "apelido" TEXT NOT NULL,
    "razaoSocial" TEXT NOT NULL,
    "cnpj" TEXT,
    "ie" TEXT,
    "endereco" TEXT,
    "bairro" TEXT,
    "cep" TEXT,
    "municipio" TEXT,
    "uf" VARCHAR(2),
    "telefone" TEXT,
    "email" TEXT,
    "emailNfe" TEXT,
    "observacoes" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fornecedor" (
    "id" UUID NOT NULL,
    "organizacaoId" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "razaoSocial" TEXT,
    "cnpj" TEXT,
    "logoUrl" TEXT,
    "emailsPedido" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ipiPercentual" DECIMAL(6,3) NOT NULL DEFAULT 0,
    "comissaoPercentual" DECIMAL(6,3) NOT NULL DEFAULT 0,
    "unidadeMeta" "UnidadeMeta" NOT NULL DEFAULT 'REAIS',
    "modoFaixa" "ModoFaixa" NOT NULL DEFAULT 'PROGRESSIVA',
    "fatorKgPadrao" DECIMAL(12,4),
    "proximoNumeroPedido" INTEGER NOT NULL DEFAULT 1,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fornecedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faixa_comissao" (
    "id" UUID NOT NULL,
    "fornecedorId" UUID NOT NULL,
    "minimo" DECIMAL(14,3) NOT NULL,
    "percentual" DECIMAL(6,3) NOT NULL,

    CONSTRAINT "faixa_comissao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aditivo" (
    "id" UUID NOT NULL,
    "fornecedorId" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "sufixoDescricao" TEXT NOT NULL,
    "tipo" "TipoAditivo" NOT NULL,
    "valor" DECIMAL(12,4) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "aditivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "produto" (
    "id" UUID NOT NULL,
    "organizacaoId" UUID NOT NULL,
    "fornecedorId" UUID NOT NULL,
    "familia" "Familia" NOT NULL,
    "codigoFornecedor" TEXT,
    "descricao" TEXT NOT NULL,
    "material" TEXT,
    "larguraCm" DECIMAL(10,2),
    "comprimentoCm" DECIMAL(10,2),
    "espessuraMm" DECIMAL(10,4),
    "fatorKg" DECIMAL(12,4),
    "sanfona" TEXT,
    "unidadesPorCaixa" INTEGER,
    "precoUnidade" DECIMAL(14,4),
    "precoCaixa" DECIMAL(14,4),
    "precoKg" DECIMAL(14,4),
    "larguraMm" DECIMAL(10,2),
    "micragem" DECIMAL(10,2),
    "metragemM" DECIMAL(10,2),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "produto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "produto_aditivo" (
    "produtoId" UUID NOT NULL,
    "aditivoId" UUID NOT NULL,

    CONSTRAINT "produto_aditivo_pkey" PRIMARY KEY ("produtoId","aditivoId")
);

-- CreateTable
CREATE TABLE "produto_codigo_cliente" (
    "produtoId" UUID NOT NULL,
    "clienteId" UUID NOT NULL,
    "codigo" TEXT NOT NULL,

    CONSTRAINT "produto_codigo_cliente_pkey" PRIMARY KEY ("produtoId","clienteId")
);

-- CreateTable
CREATE TABLE "pedido" (
    "id" UUID NOT NULL,
    "organizacaoId" UUID NOT NULL,
    "fornecedorId" UUID NOT NULL,
    "clienteId" UUID NOT NULL,
    "numero" INTEGER NOT NULL,
    "status" "StatusPedido" NOT NULL DEFAULT 'ABERTO',
    "pedidoDoCliente" TEXT,
    "prazoPagamento" TEXT,
    "prazoEntrega" DATE,
    "tipoFrete" "TipoFrete",
    "transportadora" TEXT,
    "observacoes" TEXT,
    "comIpi" BOOLEAN NOT NULL DEFAULT true,
    "ipiPercentual" DECIMAL(6,3) NOT NULL DEFAULT 0,
    "comissaoPercentual" DECIMAL(6,3),
    "subtotalSemIpi" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "valorIpi" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalGeral" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "pesoTotalKg" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "vendedor" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "enviadoEm" TIMESTAMP(3),
    "canceladoEm" TIMESTAMP(3),

    CONSTRAINT "pedido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedido_item" (
    "id" UUID NOT NULL,
    "pedidoId" UUID NOT NULL,
    "produtoId" UUID,
    "ordem" INTEGER NOT NULL,
    "familia" "Familia" NOT NULL,
    "codigoFornecedor" TEXT,
    "codigoCliente" TEXT,
    "descricao" TEXT NOT NULL,
    "unidade" "UnidadeVenda" NOT NULL,
    "quantidade" DECIMAL(14,3) NOT NULL,
    "precoUnitario" DECIMAL(16,6) NOT NULL,
    "totalSemIpi" DECIMAL(14,2) NOT NULL,
    "valorIpi" DECIMAL(14,2) NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,
    "pesoKg" DECIMAL(14,3) NOT NULL DEFAULT 0,

    CONSTRAINT "pedido_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comissao_apuracao" (
    "id" UUID NOT NULL,
    "organizacaoId" UUID NOT NULL,
    "fornecedorId" UUID NOT NULL,
    "competencia" VARCHAR(7) NOT NULL,
    "baseReais" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "baseKg" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "percentualAplicado" DECIMAL(6,3) NOT NULL DEFAULT 0,
    "valorComissao" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "atualizadaEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comissao_apuracao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comissao_lancamento" (
    "id" UUID NOT NULL,
    "apuracaoId" UUID NOT NULL,
    "pedidoId" UUID NOT NULL,
    "tipo" "TipoLancamento" NOT NULL,
    "base" DECIMAL(14,2) NOT NULL,
    "percentual" DECIMAL(6,3) NOT NULL,
    "valor" DECIMAL(14,2) NOT NULL,
    "motivo" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comissao_lancamento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuario_email_key" ON "usuario"("email");

-- CreateIndex
CREATE INDEX "usuario_organizacaoId_idx" ON "usuario"("organizacaoId");

-- CreateIndex
CREATE INDEX "cliente_organizacaoId_idx" ON "cliente"("organizacaoId");

-- CreateIndex
CREATE INDEX "cliente_organizacaoId_apelido_idx" ON "cliente"("organizacaoId", "apelido");

-- CreateIndex
CREATE INDEX "fornecedor_organizacaoId_idx" ON "fornecedor"("organizacaoId");

-- CreateIndex
CREATE INDEX "faixa_comissao_fornecedorId_idx" ON "faixa_comissao"("fornecedorId");

-- CreateIndex
CREATE UNIQUE INDEX "faixa_comissao_fornecedorId_minimo_key" ON "faixa_comissao"("fornecedorId", "minimo");

-- CreateIndex
CREATE INDEX "aditivo_fornecedorId_idx" ON "aditivo"("fornecedorId");

-- CreateIndex
CREATE INDEX "produto_organizacaoId_idx" ON "produto"("organizacaoId");

-- CreateIndex
CREATE INDEX "produto_fornecedorId_idx" ON "produto"("fornecedorId");

-- CreateIndex
CREATE INDEX "produto_organizacaoId_familia_idx" ON "produto"("organizacaoId", "familia");

-- CreateIndex
CREATE INDEX "produto_codigo_cliente_clienteId_idx" ON "produto_codigo_cliente"("clienteId");

-- CreateIndex
CREATE INDEX "pedido_organizacaoId_idx" ON "pedido"("organizacaoId");

-- CreateIndex
CREATE INDEX "pedido_organizacaoId_status_idx" ON "pedido"("organizacaoId", "status");

-- CreateIndex
CREATE INDEX "pedido_clienteId_idx" ON "pedido"("clienteId");

-- CreateIndex
CREATE INDEX "pedido_organizacaoId_enviadoEm_idx" ON "pedido"("organizacaoId", "enviadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "pedido_fornecedorId_numero_key" ON "pedido"("fornecedorId", "numero");

-- CreateIndex
CREATE INDEX "pedido_item_pedidoId_idx" ON "pedido_item"("pedidoId");

-- CreateIndex
CREATE INDEX "pedido_item_produtoId_idx" ON "pedido_item"("produtoId");

-- CreateIndex
CREATE INDEX "comissao_apuracao_organizacaoId_competencia_idx" ON "comissao_apuracao"("organizacaoId", "competencia");

-- CreateIndex
CREATE UNIQUE INDEX "comissao_apuracao_fornecedorId_competencia_key" ON "comissao_apuracao"("fornecedorId", "competencia");

-- CreateIndex
CREATE INDEX "comissao_lancamento_apuracaoId_idx" ON "comissao_lancamento"("apuracaoId");

-- CreateIndex
CREATE INDEX "comissao_lancamento_pedidoId_idx" ON "comissao_lancamento"("pedidoId");

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_organizacaoId_fkey" FOREIGN KEY ("organizacaoId") REFERENCES "organizacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cliente" ADD CONSTRAINT "cliente_organizacaoId_fkey" FOREIGN KEY ("organizacaoId") REFERENCES "organizacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fornecedor" ADD CONSTRAINT "fornecedor_organizacaoId_fkey" FOREIGN KEY ("organizacaoId") REFERENCES "organizacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faixa_comissao" ADD CONSTRAINT "faixa_comissao_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "fornecedor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aditivo" ADD CONSTRAINT "aditivo_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "fornecedor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "produto" ADD CONSTRAINT "produto_organizacaoId_fkey" FOREIGN KEY ("organizacaoId") REFERENCES "organizacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "produto" ADD CONSTRAINT "produto_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "fornecedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "produto_aditivo" ADD CONSTRAINT "produto_aditivo_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "produto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "produto_aditivo" ADD CONSTRAINT "produto_aditivo_aditivoId_fkey" FOREIGN KEY ("aditivoId") REFERENCES "aditivo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "produto_codigo_cliente" ADD CONSTRAINT "produto_codigo_cliente_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "produto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "produto_codigo_cliente" ADD CONSTRAINT "produto_codigo_cliente_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido" ADD CONSTRAINT "pedido_organizacaoId_fkey" FOREIGN KEY ("organizacaoId") REFERENCES "organizacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido" ADD CONSTRAINT "pedido_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "fornecedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido" ADD CONSTRAINT "pedido_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido_item" ADD CONSTRAINT "pedido_item_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "pedido"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido_item" ADD CONSTRAINT "pedido_item_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "produto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comissao_apuracao" ADD CONSTRAINT "comissao_apuracao_organizacaoId_fkey" FOREIGN KEY ("organizacaoId") REFERENCES "organizacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comissao_apuracao" ADD CONSTRAINT "comissao_apuracao_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "fornecedor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comissao_lancamento" ADD CONSTRAINT "comissao_lancamento_apuracaoId_fkey" FOREIGN KEY ("apuracaoId") REFERENCES "comissao_apuracao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comissao_lancamento" ADD CONSTRAINT "comissao_lancamento_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "pedido"("id") ON DELETE CASCADE ON UPDATE CASCADE;
