import {
    atualizarMedicamento as atualizarMedicamentoService,
    cadastrarMedicamento as cadastrarMedicamentoService,
    inativarMedicamento as inativarMedicamentoService,
    listarMedicamentos as listarMedicamentosService,
} from '../services/medicamentoServices.js';

const PERFIS_ADMIN = ['admin', 'master'];

function obterCampo(body, nomes) {
    for (const nome of nomes) {
        if (body[nome] !== undefined && body[nome] !== null && String(body[nome]).trim() !== '') {
            return String(body[nome]).trim();
        }
    }

    return undefined;
}

function obterPerfil(req) {
    return req.usuario?.perfil || req.headers['x-user-perfil'];
}

function obterIdAlunoAutenticado(req) {
    return req.usuario?.sub || req.usuario?.id || req.headers['x-user-id'];
}

function obterIdUsuario(req) {
    return req.usuario?.id || Number(req.headers['x-user-id']);
}

function validarProfessor(req, res) {
    if (!PERFIS_ADMIN.includes(obterPerfil(req))) {
        res.status(403).json({ erro: 'Apenas professor pode alterar registros de medicamentos' });
        return false;
    }

    return true;
}

function dadosDaDescricao(descricao) {
    const dados = {};

    String(descricao || '').split(' | ').forEach((parte) => {
        const [chave, valor] = parte.split(': ');
        if (chave && valor) dados[chave.trim().toLowerCase()] = valor.trim();
    });

    return dados;
}

function montarDadosMedicacao(body, req) {
    const dadosDescricao = dadosDaDescricao(obterCampo(body, ['descricao', 'Descricao', 'description']));
    const principioAtivo = obterCampo(body, ['principio_ativo', 'principioAtivo', 'nome_do_principio_ativo', 'nome', 'Nome', 'name', 'medicamento']);
    const validade = obterCampo(body, ['validade', 'dataValidade', 'data_vencimento', 'vencimento']) || dadosDescricao.validade || dadosDescricao.vencimento;
    const idAluno = obterCampo(body, ['id_aluno', 'idAluno', 'aluno_id', 'alunoId']);
    const nomeAluno = obterCampo(body, ['nome_aluno', 'nomeAluno', 'aluno', 'nome_doador', 'nomeDoador']) || dadosDescricao.aluno || dadosDescricao.doador;
    const quantidadeRecebida = obterCampo(body, ['quantidade', 'caixas', 'qtd']) || dadosDescricao.caixas || '1';
    const quantidade = Number(String(quantidadeRecebida).replace(',', '.'));
    const descricao = obterCampo(body, ['descricao', 'Descricao', 'description']);
    const idProfessor = obterIdUsuario(req) || Number(obterCampo(body, ['id_professor', 'idProfessor']));

    return { principioAtivo, validade, idAluno, nomeAluno, quantidade, descricao, idProfessor };
}

function validarDadosMedicacao(dados, body, res) {
    if (!dados.principioAtivo || !dados.validade || !dados.idAluno || !Number.isInteger(dados.quantidade) || dados.quantidade <= 0) {
        res.status(400).json({
            erro: 'Principio ativo, validade, aluno cadastrado e quantidade sao obrigatorios',
            exemplo: {
                nome_principio_ativo: 'Dipirona',
                data_validade: '2026-12-31',
                id_aluno: 1,
                quantidade: 1,
            },
            recebido: body,
        });
        return false;
    }

    return true;
}

async function cadastrarMedicamento(req, res) {
    try {
        if (!validarProfessor(req, res)) return;

        const body = req.body ?? {};
        const dados = montarDadosMedicacao(body, req);

        if (!validarDadosMedicacao(dados, body, res)) return;

        const medicamento = await cadastrarMedicamentoService(dados);

        res.status(201).json({
            mensagem: 'Medicacao cadastrada e FarmCoins creditados ao aluno',
            id_medicamento: medicamento.id_medicamento,
            id_aluno: medicamento.id_aluno,
            medicamento,
        });
    } catch (erro) {
        console.error('Erro ao cadastrar medicamento:', erro);
        if (erro.code === 'ALUNO_NAO_CADASTRADO') {
            return res.status(404).json({ erro: erro.message });
        }
        res.status(500).json({ erro: 'Erro ao cadastrar medicamento' });
    }
}

async function listarMedicamentos(req, res) {
    try {
        const perfilSolicitante = obterPerfil(req);
        const idAlunoAutenticado = obterIdAlunoAutenticado(req);
        const filtroAluno = PERFIS_ADMIN.includes(perfilSolicitante)
            ? obterCampo(req.query ?? {}, ['id_aluno', 'idAluno', 'aluno', 'nome'])
            : idAlunoAutenticado;

        if (!PERFIS_ADMIN.includes(perfilSolicitante) && !filtroAluno) {
            return res.status(403).json({ erro: 'Aluno sem usuario vinculado' });
        }

        const medicamentos = await listarMedicamentosService(filtroAluno);
        res.json(medicamentos);
    } catch (erro) {
        console.error('Erro ao listar medicamentos:', erro);
        res.status(500).json({ erro: 'Erro ao listar medicamentos' });
    }
}

async function atualizarMedicamento(req, res) {
    try {
        if (!validarProfessor(req, res)) return;

        const dados = montarDadosMedicacao(req.body ?? {}, req);

        if (!validarDadosMedicacao(dados, req.body ?? {}, res)) return;

        const medicamento = await atualizarMedicamentoService(req.params.id, dados);

        if (!medicamento) {
            return res.status(404).json({ erro: 'Medicamento nao encontrado' });
        }

        res.json(medicamento);
    } catch (erro) {
        console.error('Erro ao atualizar medicamento:', erro);
        res.status(500).json({ erro: 'Erro ao atualizar medicamento' });
    }
}

async function inativarMedicamento(req, res) {
    try {
        if (!validarProfessor(req, res)) return;

        const medicamento = await inativarMedicamentoService(req.params.id);

        if (!medicamento) {
            return res.status(404).json({ erro: 'Medicamento nao encontrado' });
        }

        res.json(medicamento);
    } catch (erro) {
        console.error('Erro ao inativar medicamento:', erro);
        res.status(500).json({ erro: 'Erro ao inativar medicamento' });
    }
}

const listarMovimentacoes = listarMedicamentos;

export { listarMovimentacoes, cadastrarMedicamento, listarMedicamentos, atualizarMedicamento, inativarMedicamento };
