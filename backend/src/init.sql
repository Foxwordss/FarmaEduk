-- Schema oficial FarmaEduk conforme o diagrama:
-- USUARIO, CONTA, MEDICAMENTO e MOVIMENTACAO_FARMACOINS.
-- Remove tabelas fora do modelo, incluindo usuario_aluno/usuario_aluino.

BEGIN;

CREATE TABLE IF NOT EXISTS usuario (
    id_usuario SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    senha VARCHAR(255) NOT NULL,
    tipo_usuario VARCHAR(20) NOT NULL DEFAULT 'ALUNO',
    ativo BOOLEAN DEFAULT TRUE
);

ALTER TABLE usuario ADD COLUMN IF NOT EXISTS tipo_usuario VARCHAR(20) NOT NULL DEFAULT 'ALUNO';
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT TRUE;
ALTER TABLE usuario ALTER COLUMN senha TYPE VARCHAR(255);

UPDATE usuario
SET tipo_usuario = CASE
    WHEN UPPER(COALESCE(tipo_usuario, 'ALUNO')) IN ('ADMIN', 'PROFESSOR', 'ALUNO')
        THEN UPPER(tipo_usuario)
    WHEN LOWER(COALESCE(tipo_usuario, '')) IN ('admin', 'master')
        THEN 'ADMIN'
    WHEN LOWER(COALESCE(tipo_usuario, '')) = 'professor'
        THEN 'PROFESSOR'
    ELSE 'ALUNO'
END;

DROP INDEX IF EXISTS idx_usuario_email_unique;
ALTER TABLE usuario DROP CONSTRAINT IF EXISTS usuario_email_key;
ALTER TABLE usuario DROP COLUMN IF EXISTS email;
ALTER TABLE usuario DROP COLUMN IF EXISTS perfil;
ALTER TABLE usuario DROP COLUMN IF EXISTS ra;
ALTER TABLE usuario DROP COLUMN IF EXISTS criado_em;
ALTER TABLE usuario DROP COLUMN IF EXISTS atualizado_em;

ALTER TABLE usuario DROP CONSTRAINT IF EXISTS usuario_tipo_usuario_check;
ALTER TABLE usuario
    ADD CONSTRAINT usuario_tipo_usuario_check
    CHECK (tipo_usuario IN ('ALUNO', 'PROFESSOR', 'ADMIN'));

DROP INDEX IF EXISTS idx_usuario_nome_lower;
CREATE INDEX IF NOT EXISTS idx_usuario_tipo_usuario ON usuario (tipo_usuario);

UPDATE usuario
SET tipo_usuario = 'ADMIN',
    ativo = TRUE
WHERE LOWER(nome) = 'admin';

UPDATE usuario
SET tipo_usuario = 'ADMIN',
    ativo = TRUE
WHERE LOWER(nome) = 'master';

UPDATE usuario
SET tipo_usuario = 'PROFESSOR',
    ativo = TRUE
WHERE LOWER(nome) = 'professor';

INSERT INTO usuario (nome, senha, tipo_usuario, ativo)
SELECT 'admin', 'admin123', 'ADMIN', TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM usuario WHERE LOWER(nome) = 'admin'
);

INSERT INTO usuario (nome, senha, tipo_usuario, ativo)
SELECT 'professor', 'professor123', 'PROFESSOR', TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM usuario WHERE LOWER(nome) = 'professor'
);

CREATE TABLE IF NOT EXISTS conta (
    id_conta SERIAL PRIMARY KEY,
    id_usuario INT NOT NULL UNIQUE,
    saldo_farmacoins INT DEFAULT 0,
    CONSTRAINT fk_conta_usuario
        FOREIGN KEY (id_usuario)
        REFERENCES usuario(id_usuario)
        ON DELETE CASCADE
);

ALTER TABLE conta ADD COLUMN IF NOT EXISTS saldo_farmacoins INT DEFAULT 0;
ALTER TABLE conta DROP COLUMN IF EXISTS id_farmcoins;
ALTER TABLE conta DROP COLUMN IF EXISTS saldo;
ALTER TABLE conta DROP COLUMN IF EXISTS ativo;
ALTER TABLE conta DROP COLUMN IF EXISTS criado_em;
ALTER TABLE conta DROP COLUMN IF EXISTS atualizado_em;

ALTER TABLE conta DROP CONSTRAINT IF EXISTS conta_id_usuario_fkey;
ALTER TABLE conta DROP CONSTRAINT IF EXISTS fk_conta_usuario;
ALTER TABLE conta
    ADD CONSTRAINT fk_conta_usuario
    FOREIGN KEY (id_usuario)
    REFERENCES usuario(id_usuario)
    ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_conta_usuario_unique ON conta (id_usuario);

CREATE TABLE IF NOT EXISTS medicamento (
    id_medicamento SERIAL PRIMARY KEY,
    nome_principio_ativo VARCHAR(100) NOT NULL,
    data_entrega DATE NOT NULL DEFAULT CURRENT_DATE,
    data_validade DATE NOT NULL DEFAULT CURRENT_DATE,
    quantidade INT NOT NULL DEFAULT 1,
    status VARCHAR(20) DEFAULT 'PENDENTE',
    id_aluno INT NOT NULL,
    id_professor INT,
    CONSTRAINT fk_medicamento_aluno
        FOREIGN KEY (id_aluno)
        REFERENCES usuario(id_usuario),
    CONSTRAINT fk_medicamento_professor
        FOREIGN KEY (id_professor)
        REFERENCES usuario(id_usuario)
);

ALTER TABLE medicamento ADD COLUMN IF NOT EXISTS nome_principio_ativo VARCHAR(100);
ALTER TABLE medicamento ADD COLUMN IF NOT EXISTS data_entrega DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE medicamento ADD COLUMN IF NOT EXISTS data_validade DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE medicamento ADD COLUMN IF NOT EXISTS quantidade INT NOT NULL DEFAULT 1;
ALTER TABLE medicamento ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'PENDENTE';
ALTER TABLE medicamento ADD COLUMN IF NOT EXISTS id_aluno INT;
ALTER TABLE medicamento ADD COLUMN IF NOT EXISTS id_professor INT;
ALTER TABLE medicamento ADD COLUMN IF NOT EXISTS validade DATE;
ALTER TABLE medicamento ADD COLUMN IF NOT EXISTS nome_do_principio_ativo VARCHAR(100);

UPDATE medicamento
SET data_entrega = CURRENT_DATE
WHERE data_entrega IS NULL;

UPDATE medicamento
SET data_validade = COALESCE(data_validade, validade, CURRENT_DATE)
WHERE data_validade IS NULL;

UPDATE medicamento
SET nome_principio_ativo = COALESCE(nome_principio_ativo, nome_do_principio_ativo, 'Medicamento sem nome')
WHERE nome_principio_ativo IS NULL OR TRIM(nome_principio_ativo) = '';

UPDATE medicamento
SET id_aluno = (
    SELECT id_usuario
    FROM usuario
    WHERE tipo_usuario = 'ALUNO'
    ORDER BY id_usuario
    LIMIT 1
)
WHERE id_aluno IS NULL
  AND EXISTS (SELECT 1 FROM usuario WHERE tipo_usuario = 'ALUNO');

UPDATE medicamento
SET status = CASE
    WHEN UPPER(COALESCE(status, 'PENDENTE')) IN ('PENDENTE', 'VALIDADO', 'RECUSADO', 'INATIVO')
        THEN UPPER(status)
    WHEN LOWER(COALESCE(status, '')) = 'ativo'
        THEN 'VALIDADO'
    WHEN LOWER(COALESCE(status, '')) = 'inativo'
        THEN 'INATIVO'
    ELSE 'PENDENTE'
END;

ALTER TABLE medicamento DROP COLUMN IF EXISTS nome_do_principio_ativo;
ALTER TABLE medicamento DROP COLUMN IF EXISTS validade;
ALTER TABLE medicamento DROP COLUMN IF EXISTS descricao;
ALTER TABLE medicamento DROP COLUMN IF EXISTS farmcoins_creditados;
ALTER TABLE medicamento DROP COLUMN IF EXISTS id_administrador;
ALTER TABLE medicamento DROP COLUMN IF EXISTS criado_em;
ALTER TABLE medicamento DROP COLUMN IF EXISTS atualizado_em;

ALTER TABLE medicamento DROP CONSTRAINT IF EXISTS medicamento_quantidade_check;
ALTER TABLE medicamento
    ADD CONSTRAINT medicamento_quantidade_check
    CHECK (quantidade > 0);

ALTER TABLE medicamento DROP CONSTRAINT IF EXISTS medicamento_status_check;
ALTER TABLE medicamento
    ADD CONSTRAINT medicamento_status_check
    CHECK (status IN ('PENDENTE', 'VALIDADO', 'RECUSADO', 'INATIVO'));

ALTER TABLE medicamento DROP CONSTRAINT IF EXISTS medicamento_id_aluno_fkey;
ALTER TABLE medicamento DROP CONSTRAINT IF EXISTS medicamento_id_professor_fkey;
ALTER TABLE medicamento DROP CONSTRAINT IF EXISTS fk_medicamento_aluno;
ALTER TABLE medicamento DROP CONSTRAINT IF EXISTS fk_medicamento_professor;
ALTER TABLE medicamento
    ADD CONSTRAINT fk_medicamento_aluno
    FOREIGN KEY (id_aluno)
    REFERENCES usuario(id_usuario);
ALTER TABLE medicamento
    ADD CONSTRAINT fk_medicamento_professor
    FOREIGN KEY (id_professor)
    REFERENCES usuario(id_usuario);

CREATE INDEX IF NOT EXISTS idx_medicamento_aluno ON medicamento (id_aluno);
CREATE INDEX IF NOT EXISTS idx_medicamento_professor ON medicamento (id_professor);
CREATE INDEX IF NOT EXISTS idx_medicamento_status ON medicamento (status);

CREATE TABLE IF NOT EXISTS movimentacao_farmacoins (
    id_movimentacao SERIAL PRIMARY KEY,
    id_usuario INT NOT NULL,
    id_medicamento INT,
    tipo_movimentacao VARCHAR(20) NOT NULL,
    quantidade_farmacoins INT NOT NULL,
    descricao VARCHAR(255),
    data_movimentacao DATE DEFAULT CURRENT_DATE,
    CONSTRAINT fk_movimentacao_usuario
        FOREIGN KEY (id_usuario)
        REFERENCES usuario(id_usuario),
    CONSTRAINT fk_movimentacao_medicamento
        FOREIGN KEY (id_medicamento)
        REFERENCES medicamento(id_medicamento)
);

ALTER TABLE movimentacao_farmacoins ADD COLUMN IF NOT EXISTS descricao VARCHAR(255);
ALTER TABLE movimentacao_farmacoins ADD COLUMN IF NOT EXISTS data_movimentacao DATE DEFAULT CURRENT_DATE;
ALTER TABLE movimentacao_farmacoins ALTER COLUMN descricao TYPE VARCHAR(255);
ALTER TABLE movimentacao_farmacoins ALTER COLUMN data_movimentacao TYPE DATE USING data_movimentacao::DATE;
ALTER TABLE movimentacao_farmacoins ALTER COLUMN data_movimentacao SET DEFAULT CURRENT_DATE;

UPDATE movimentacao_farmacoins
SET tipo_movimentacao = CASE
    WHEN UPPER(COALESCE(tipo_movimentacao, 'ENTRADA')) IN ('ENTRADA', 'SAIDA')
        THEN UPPER(tipo_movimentacao)
    WHEN LOWER(COALESCE(tipo_movimentacao, '')) IN ('credito', 'entrada')
        THEN 'ENTRADA'
    WHEN LOWER(COALESCE(tipo_movimentacao, '')) IN ('debito', 'saida')
        THEN 'SAIDA'
    ELSE 'ENTRADA'
END;

UPDATE movimentacao_farmacoins
SET quantidade_farmacoins = 1
WHERE quantidade_farmacoins IS NULL OR quantidade_farmacoins <= 0;

ALTER TABLE movimentacao_farmacoins DROP CONSTRAINT IF EXISTS movimentacao_farmacoins_tipo_movimentacao_check;
ALTER TABLE movimentacao_farmacoins
    ADD CONSTRAINT movimentacao_farmacoins_tipo_movimentacao_check
    CHECK (tipo_movimentacao IN ('ENTRADA', 'SAIDA'));

ALTER TABLE movimentacao_farmacoins DROP CONSTRAINT IF EXISTS movimentacao_farmacoins_quantidade_farmacoins_check;
ALTER TABLE movimentacao_farmacoins
    ADD CONSTRAINT movimentacao_farmacoins_quantidade_farmacoins_check
    CHECK (quantidade_farmacoins > 0);

ALTER TABLE movimentacao_farmacoins DROP CONSTRAINT IF EXISTS movimentacao_farmacoins_id_usuario_fkey;
ALTER TABLE movimentacao_farmacoins DROP CONSTRAINT IF EXISTS movimentacao_farmacoins_id_medicamento_fkey;
ALTER TABLE movimentacao_farmacoins DROP CONSTRAINT IF EXISTS fk_movimentacao_usuario;
ALTER TABLE movimentacao_farmacoins DROP CONSTRAINT IF EXISTS fk_movimentacao_medicamento;
ALTER TABLE movimentacao_farmacoins
    ADD CONSTRAINT fk_movimentacao_usuario
    FOREIGN KEY (id_usuario)
    REFERENCES usuario(id_usuario);
ALTER TABLE movimentacao_farmacoins
    ADD CONSTRAINT fk_movimentacao_medicamento
    FOREIGN KEY (id_medicamento)
    REFERENCES medicamento(id_medicamento);

CREATE INDEX IF NOT EXISTS idx_movimentacao_usuario ON movimentacao_farmacoins (id_usuario);
CREATE INDEX IF NOT EXISTS idx_movimentacao_medicamento ON movimentacao_farmacoins (id_medicamento);

INSERT INTO conta (id_usuario, saldo_farmacoins)
SELECT id_usuario, 0
FROM usuario
WHERE tipo_usuario = 'ALUNO'
ON CONFLICT (id_usuario) DO NOTHING;

DROP TABLE IF EXISTS usuario_aluino CASCADE;
DROP TABLE IF EXISTS usuario_aluno CASCADE;
DROP TABLE IF EXISTS farmcoins CASCADE;
DROP TABLE IF EXISTS administrador_professor CASCADE;
DROP TABLE IF EXISTS doadores CASCADE;
DROP TABLE IF EXISTS contas_farmcoins CASCADE;
DROP TABLE IF EXISTS farmcoin_transacoes CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;
DROP TABLE IF EXISTS medicamentos CASCADE;

COMMIT;
