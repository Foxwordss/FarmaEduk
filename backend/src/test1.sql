-- Schema oficial FarmaEduk conforme o diagrama:
COMMIT;

CREATE TABLE IF NOT EXISTS conta (
    id_conta SERIAL PRIMARY KEY,
    id_usuario INT NOT NULL UNIQUE,
    saldo_farmacoins INT DEFAULT 0,
    CONSTRAINT fk_conta_usuario
        FOREIGN KEY (id_usuario)
        REFERENCES usuario(id_usuario)
        ON DELETE CASCADE

ALTER TABLE conta ADD COLUMN IF NOT EXISTS saldo_farmacoins INT DEFAULT 0;
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

CREATE TABLE 
