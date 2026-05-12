if (sessionStorage.getItem("farmaeduk_autenticado") !== "true") {
  window.location.href = "/login-aluno";
}

const usuarioLogado = JSON.parse(sessionStorage.getItem("farmaeduk_usuario") || "{}");
const token = sessionStorage.getItem("farmaeduk_token") || "";
const isAdmin = ["admin", "master"].includes(usuarioLogado.perfil);

const FARMACOINS_POR_CAIXA = 25;
const form = document.getElementById("filter-form");
const limparFiltros = document.getElementById("limpar-filtros");
const lista = document.getElementById("lista-filtros");
const total = document.getElementById("resultado-total");
const destaque = document.getElementById("resultado-destaque");
const registrosTotal = document.getElementById("registros-total");
const caixasTotal = document.getElementById("caixas-total");
const coinsTotal = document.getElementById("coins-total");
const filtroFeedback = document.getElementById("filtro-feedback");
const filtroInicio = document.getElementById("filtro-inicio");
const filtroFim = document.getElementById("filtro-fim");
const filtroAlunoSelect = document.getElementById("filtro-aluno-select");
const filtroAluno = document.getElementById("filtro-aluno");
const filtroPrincipio = document.getElementById("filtro-principio");
const voltarAdmin = document.getElementById("voltar-admin");
const sairSessao = document.getElementById("sair-sessao");

let registros = [];
let alunosCadastrados = [];

function dadosDaDescricao(descricao) {
  const dados = {};

  String(descricao || "").split(" | ").forEach((parte) => {
    const [chave, valor] = parte.split(": ");
    if (chave && valor) dados[chave.trim().toLowerCase()] = valor.trim();
  });

  return dados;
}

function formatarData(data) {
  if (!data) return "Sem data";
  return new Date(`${data}T00:00:00`).toLocaleDateString("pt-BR");
}

function getAluno(registro) {
  const dados = dadosDaDescricao(registro.descricao);
  return registro.nome_doador || dados.doador || dados.aluno || "Doador nao informado";
}

function getEntrega(registro) {
  return dadosDaDescricao(registro.descricao).entrega || "";
}

function getCaixas(registro) {
  return Number(registro.quantidade || dadosDaDescricao(registro.descricao).caixas || 1);
}

function getValidade(registro) {
  return registro.validade ? String(registro.validade).slice(0, 10) : dadosDaDescricao(registro.descricao).vencimento || "";
}

function renderizar(listaFiltrada) {
  const caixas = listaFiltrada.reduce((soma, registro) => soma + getCaixas(registro), 0);
  const farmacoins = caixas * FARMACOINS_POR_CAIXA;

  total.textContent = `${listaFiltrada.length} registro(s)`;
  destaque.innerHTML = `${listaFiltrada.length}<br>registro(s)`;
  registrosTotal.textContent = listaFiltrada.length;
  caixasTotal.textContent = caixas;
  coinsTotal.textContent = `${farmacoins} FC`;

  if (!listaFiltrada.length) {
    lista.innerHTML = '<p class="empty">Nenhum registro encontrado.</p>';
    return;
  }

  lista.innerHTML = listaFiltrada.map((registro) => {
    const caixas = getCaixas(registro);

    return `
      <article class="medicine-item">
        <div>
          <strong>${getAluno(registro)}</strong>
          <span>${registro.nome} - ${caixas} caixa(s)</span>
          <small>Entrega: ${formatarData(getEntrega(registro))}</small>
        </div>
        <small>Validade: ${formatarData(getValidade(registro))}</small>
        <b>${Number(registro.farmcoins_creditados || caixas * FARMACOINS_POR_CAIXA)} FC</b>
      </article>
    `;
  }).join("");
}

function renderizarAlunos(alunos) {
  alunosCadastrados = alunos;
  filtroAlunoSelect.innerHTML = '<option value="">Todos os alunos cadastrados</option>'
    + alunos.map((aluno) => `<option value="${aluno.id}">${aluno.nome}</option>`).join("");
}

function preencherAlunoSelecionado() {
  const aluno = alunosCadastrados.find((item) => Number(item.id) === Number(filtroAlunoSelect.value));

  filtroAluno.value = aluno?.nome || "";
}

async function carregarAlunos() {
  if (!isAdmin) return;

  try {
    const resposta = await fetch("/api/alunos", {
      headers: {
        "Authorization": `Bearer ${token}`,
        "X-User-Perfil": usuarioLogado.perfil || "",
      },
    });

    if (!resposta.ok) {
      const erro = await resposta.json().catch(() => ({}));
      throw new Error(erro.erro || "Nao foi possivel carregar alunos cadastrados.");
    }

    renderizarAlunos(await resposta.json());
  } catch (error) {
    filtroFeedback.textContent = error.message;
    renderizarAlunos([]);
  }
}

function aplicarFiltros() {
  const dataInicio = filtroInicio.value;
  const dataFim = filtroFim.value;
  const aluno = isAdmin ? filtroAluno.value.trim().toLowerCase() : "";
  const principio = filtroPrincipio.value.trim().toLowerCase();

  filtroFeedback.textContent = "";

  if (dataInicio && dataFim && dataInicio > dataFim) {
    filtroFeedback.textContent = "A data inicial nao pode ser maior que a data final.";
    return;
  }

  const filtrados = registros.filter((registro) => {
    const alunoRegistro = getAluno(registro).toLowerCase();
    const entrega = getEntrega(registro);
    const principioRegistro = String(registro.nome || "").toLowerCase();

    return (!dataInicio || entrega >= dataInicio)
      && (!dataFim || entrega <= dataFim)
      && (!aluno || alunoRegistro.includes(aluno))
      && (!principio || principioRegistro.includes(principio));
  });

  renderizar(filtrados);
}

async function carregarRegistros() {
  try {
    const resposta = await fetch("/api/medicacoes", {
      headers: {
        "Authorization": `Bearer ${token}`,
        "X-User-Perfil": usuarioLogado.perfil || "",
      },
    });

    if (!resposta.ok) {
      const erro = await resposta.json().catch(() => ({}));
      throw new Error(erro.erro || "Nao foi possivel carregar os registros.");
    }

    registros = await resposta.json();
    renderizar(registros);
  } catch (error) {
    filtroFeedback.textContent = error.message;
    renderizar([]);
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  aplicarFiltros();
});

limparFiltros.addEventListener("click", () => {
  form.reset();
  configurarFiltrosDoPerfil();
  if (isAdmin) preencherAlunoSelecionado();
  filtroFeedback.textContent = "";
  renderizar(registros);
});

function configurarFiltrosDoPerfil() {
  if (isAdmin) {
    filtroAlunoSelect.hidden = false;
    filtroAluno.readOnly = true;
    return;
  }

  voltarAdmin.hidden = true;
  filtroAlunoSelect.hidden = true;
  filtroAluno.value = usuarioLogado.nome || "";
  filtroAluno.readOnly = true;
  filtroAluno.title = "Aluno logado";
}

sairSessao.addEventListener("click", () => {
  sessionStorage.removeItem("farmaeduk_autenticado");
  sessionStorage.removeItem("farmaeduk_usuario");
  sessionStorage.removeItem("farmaeduk_token");
  window.location.href = "/";
});

filtroAlunoSelect.addEventListener("change", preencherAlunoSelecionado);

configurarFiltrosDoPerfil();
carregarAlunos();
carregarRegistros();
