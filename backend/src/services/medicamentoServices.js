import pool from '../database.js';

const FARMACOINS_POR_CAIXA = 25;

function mapearMedicamento(row) {
    if (!row) return row;

    const farmcoins = Number(row.farmcoins_creditados || row.quantidade_farmacoins || 0);

    return {
        id: row.id_medicamento,
        id_medicamento: row.id_medicamento,
        nome: row.nome_principio_ativo,
        principio_ativo: row.nome_principio_ativo,
        nome_principio_ativo: row.nome_principio_ativo,
        data_entrega: row.data_entrega,
        validade: row.data_validade,
        data_validade: row.data_validade,
        quantidade: Number(row.quantidade || 1),
        status: row.status,
        ativo: row.status !== 'INATIVO',
        id_aluno: row.id_aluno,
        id_professor: row.id_professor,
        aluno_nome: row.aluno_nome,
        nome_doador: row.aluno_nome,
        professor_nome: row.professor_nome,
        saldo_aluno: row.saldo_aluno === null || row.saldo_aluno === undefined ? null : Number(row.saldo_aluno),
        farmcoins_creditados: farmcoins,
        descricao: `Aluno: ${row.aluno_nome || ''} | Caixas: ${Number(row.quantidade || 1)} | Entrega: ${String(row.data_entrega || '').slice(0, 10)} | Vencimento: ${String(row.data_validade || '').slice(0, 10)}`,
    };
}

async function buscarAlunoCadastrado(client, { idAluno, nomeAluno }) {
    const id = Number(idAluno);
    const nome = String(nomeAluno || '').trim();

    if (Number.isInteger(id) && id > 0) {
        const existentePorId = await client.query(
            `SELECT id_usuario, nome
             FROM usuario
             WHERE id_usuario = $1
               AND tipo_usuario = 'ALUNO'
               AND ativo = TRUE
             LIMIT 1;`,
            [id],
        );

        if (existentePorId.rows[0]) {
            return { ...existentePorId.rows[0], id: existentePorId.rows[0].id_usuario };
        }
    }

    if (nome) {
        const existentePorNome = await client.query(
            `SELECT id_usuario, nome
             FROM usuario
             WHERE LOWER(nome) = LOWER($1)
               AND tipo_usuario = 'ALUNO'
               AND ativo = TRUE
             LIMIT 1;`,
            [nome],
        );

        if (existentePorNome.rows[0]) {
            return { ...existentePorNome.rows[0], id: existentePorNome.rows[0].id_usuario };
        }
    }

    const erro = new Error('Aluno nao cadastrado. Cadastre o aluno antes de registrar a medicacao.');
    erro.code = 'ALUNO_NAO_CADASTRADO';
    throw erro;
}

async function creditarFarmCoins(client, usuarioId, medicamentoId, valor) {
    await client.query(
        `INSERT INTO conta (id_usuario, saldo_farmacoins)
         VALUES ($1, 0)
         ON CONFLICT (id_usuario) DO NOTHING;`,
        [usuarioId],
    );

    const conta = await client.query(
        `UPDATE conta
         SET saldo_farmacoins = saldo_farmacoins + $2
         WHERE id_usuario = $1
         RETURNING saldo_farmacoins;`,
        [usuarioId, valor],
    );

    await client.query(
        `INSERT INTO movimentacao_farmacoins (
            id_usuario,
            id_medicamento,
            tipo_movimentacao,
            quantidade_farmacoins,
            descricao
         )
         VALUES ($1, $2, 'ENTRADA', $3, 'Credito por cadastro de medicamento');`,
        [usuarioId, medicamentoId, valor],
    );

    return Number(conta.rows[0].saldo_farmacoins);
}

async function cadastrarMedicamento(dados) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const aluno = await buscarAlunoCadastrado(client, dados);
        const quantidade = Number(dados.quantidade || 1);
        const farmcoins = quantidade * FARMACOINS_POR_CAIXA;

        const medicamento = await client.query(
            `INSERT INTO medicamento (
                nome_principio_ativo,
                data_entrega,
                data_validade,
                quantidade,
                status,
                id_aluno,
                id_professor
             )
             VALUES ($1, CURRENT_DATE, $2, $3, 'VALIDADO', $4, $5)
             RETURNING id_medicamento, nome_principio_ativo, data_entrega, data_validade, quantidade, status, id_aluno, id_professor;`,
            [dados.principioAtivo, dados.validade, quantidade, aluno.id, dados.idProfessor || null],
        );

        const saldo = await creditarFarmCoins(client, aluno.id, medicamento.rows[0].id_medicamento, farmcoins);

        await client.query('COMMIT');

        return {
            ...mapearMedicamento({
                ...medicamento.rows[0],
                aluno_nome: aluno.nome,
                professor_nome: null,
                saldo_aluno: saldo,
                farmcoins_creditados: farmcoins,
            }),
            aluno,
            farmcoins: {
                creditados: farmcoins,
                saldo,
            },
        };
    } catch (erro) {
        await client.query('ROLLBACK');
        console.error('Erro ao cadastrar medicamento:', erro);
        throw erro;
    } finally {
        client.release();
    }
}

async function listarMedicamentos(filtroAluno = null) {
    const idFiltro = Number(filtroAluno);
    const filtro = filtroAluno
        ? (Number.isInteger(idFiltro) && idFiltro > 0 ? 'WHERE a.id_usuario = $1' : 'WHERE LOWER(a.nome) = LOWER($1)')
        : '';
    const params = filtroAluno ? [Number.isInteger(idFiltro) && idFiltro > 0 ? idFiltro : filtroAluno] : [];
    const result = await pool.query(
        `SELECT
            m.id_medicamento,
            m.nome_principio_ativo,
            m.data_entrega,
            m.data_validade,
            m.quantidade,
            m.status,
            m.id_aluno,
            m.id_professor,
            a.nome AS aluno_nome,
            p.nome AS professor_nome,
            c.saldo_farmacoins AS saldo_aluno,
            COALESCE(SUM(CASE WHEN mf.tipo_movimentacao = 'ENTRADA' THEN mf.quantidade_farmacoins ELSE 0 END), 0) AS farmcoins_creditados
         FROM medicamento m
         LEFT JOIN usuario a ON a.id_usuario = m.id_aluno
         LEFT JOIN usuario p ON p.id_usuario = m.id_professor
         LEFT JOIN conta c ON c.id_usuario = a.id_usuario
         LEFT JOIN movimentacao_farmacoins mf ON mf.id_medicamento = m.id_medicamento
         ${filtro}
         GROUP BY
            m.id_medicamento,
            a.nome,
            p.nome,
            c.saldo_farmacoins
         ORDER BY m.data_entrega DESC, m.id_medicamento DESC;`,
        params,
    );

    return result.rows.map(mapearMedicamento);
}

async function atualizarMedicamento(id, dados) {
    const quantidade = Number(dados.quantidade || 1);
    const result = await pool.query(
        `UPDATE medicamento
         SET nome_principio_ativo = $1,
             data_validade = $2,
             quantidade = $3,
             status = $4
         WHERE id_medicamento = $5
         RETURNING id_medicamento, nome_principio_ativo, data_entrega, data_validade, quantidade, status, id_aluno, id_professor;`,
        [dados.principioAtivo, dados.validade, quantidade, dados.status || 'VALIDADO', id],
    );

    return mapearMedicamento(result.rows[0]);
}

async function inativarMedicamento(id) {
    const result = await pool.query(
        `UPDATE medicamento
         SET status = 'INATIVO'
         WHERE id_medicamento = $1
         RETURNING id_medicamento, nome_principio_ativo, data_entrega, data_validade, quantidade, status, id_aluno, id_professor;`,
        [id],
    );

    return mapearMedicamento(result.rows[0]);
}

export { cadastrarMedicamento, listarMedicamentos, atualizarMedicamento, inativarMedicamento };
