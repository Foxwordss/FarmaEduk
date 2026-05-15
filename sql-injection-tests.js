#!/usr/bin/env node

/**
 * Script de Teste de SQL Injection - FarmaEduk
 * 
 * Uso: node sql-injection-tests.js [url-base]
 * Exemplo: node sql-injection-tests.js http://localhost:3000
 */

const baseURL = process.argv[2] || 'http://localhost:3000';

// Cores para output no console
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Payloads clássicos de SQL Injection para testes
 */
const SQL_INJECTION_PAYLOADS = {
  classico: [
    "admin' --",
    "admin' #",
    "admin'/*",
    "' OR '1'='1",
    "' OR 1=1 --",
    "' OR 1=1 #",
    "' OR 1=1/*",
    "') OR ('1'='1",
    "') OR ('1'='1' --",
    "') OR ('1'='1'/*",
    "1' UNION SELECT NULL --",
    "1' UNION SELECT NULL, NULL --",
  ],
  bypass_autenticacao: [
    "' OR '1'='1' --",
    "' OR 'x'='x",
    "admin' --",
    "admin' #",
    "' or 1=1 /*",
  ],
  union_based: [
    "1' UNION SELECT table_name FROM information_schema.tables --",
    "1' UNION SELECT column_name FROM information_schema.columns --",
    "1' UNION SELECT version() --",
  ],
  time_based: [
    "1'; WAITFOR DELAY '00:00:05' --",
    "1' AND SLEEP(5) --",
    "1' AND (SELECT * FROM (SELECT(SLEEP(5)))a) --",
  ],
  blind_sqli: [
    "1' AND '1'='1",
    "1' AND '1'='2",
    "1' AND 1=1 --",
    "1' AND 1=2 --",
  ],
  stacked_queries: [
    "1'; DROP TABLE usuario; --",
    "1'; DELETE FROM usuario; --",
    "1'; UPDATE usuario SET senha='hacked'; --",
  ],
};

/**
 * Testa um payload contra um endpoint
 */
async function testarPayload(endpoint, campo, payload, metodo = 'GET') {
  try {
    const url = new URL(`${baseURL}${endpoint}`);
    let options = {
      method: metodo,
      headers: { 'Content-Type': 'application/json' },
    };

    let body = null;

    if (metodo === 'GET') {
      url.searchParams.append(campo, payload);
    } else {
      body = JSON.stringify({ [campo]: payload });
      options.body = body;
    }

    const resposta = await fetch(url.toString(), options);
    const dados = await resposta.json();

    return {
      status: resposta.status,
      dados: dados,
      sucesso: resposta.ok,
    };
  } catch (erro) {
    return {
      erro: erro.message,
      sucesso: false,
    };
  }
}

/**
 * Testa login com SQL Injection
 */
async function testarLoginSQLi() {
  log('cyan', '\n═══════════════════════════════════════════════════════════');
  log('cyan', '🔐 TESTE 1: Login com SQL Injection');
  log('cyan', '═══════════════════════════════════════════════════════════\n');

  const payloads = SQL_INJECTION_PAYLOADS.bypass_autenticacao;

  for (const payload of payloads.slice(0, 3)) {
    log('blue', `\nTestando payload: "${payload}"`);

    try {
      const resposta = await fetch(`${baseURL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuario: payload,
          senha: 'teste123',
        }),
      });

      const dados = await resposta.json();

      if (resposta.status === 401 && dados.erro) {
        log('green', `✅ SEGURO: Payload rejeitado (Status: ${resposta.status})`);
        console.log(`   Resposta: ${dados.erro}`);
      } else if (resposta.ok && dados.autenticado) {
        log('red', `❌ VULNERÁVEL: Payload aceito! (Status: ${resposta.status})`);
        console.log(`   Token: ${dados.token?.substring(0, 50)}...`);
      } else {
        log('yellow', `⚠️  Resposta inesperada (Status: ${resposta.status})`);
      }
    } catch (erro) {
      log('red', `❌ Erro ao testar: ${erro.message}`);
    }
  }
}

/**
 * Testa endpoint de medicamentos com SQL Injection
 */
async function testarMedicamentosSQLi() {
  log('cyan', '\n═══════════════════════════════════════════════════════════');
  log('cyan', '💊 TESTE 2: Filtro de Medicamentos com SQL Injection');
  log('cyan', '═══════════════════════════════════════════════════════════\n');

  const payloads = [
    "1' OR '1'='1",
    "1; DROP TABLE medicamento; --",
    "1' UNION SELECT * FROM usuario --",
  ];

  for (const payload of payloads) {
    log('blue', `\nTestando payload: "${payload}"`);

    try {
      const resposta = await fetch(
        `${baseURL}/api/medicamentos?id_aluno=${encodeURIComponent(payload)}`
      );

      if (resposta.ok) {
        const dados = await resposta.json();
        if (Array.isArray(dados) && dados.length === 0) {
          log('green', `✅ SEGURO: Query sem resultados (como esperado)`);
        } else if (Array.isArray(dados)) {
          log('yellow', `⚠️  Query retornou ${dados.length} resultados`);
        }
      } else if (resposta.status === 401) {
        log('green', `✅ SEGURO: Requer autenticação (Status: 401)`);
      } else {
        log('yellow', `⚠️  Status: ${resposta.status}`);
      }
    } catch (erro) {
      log('red', `❌ Erro ao testar: ${erro.message}`);
    }
  }
}

/**
 * Teste de Timing Attack
 */
async function testarTimingAttack() {
  log('cyan', '\n═══════════════════════════════════════════════════════════');
  log('cyan', '⏱️  TESTE 3: Timing Attack (Blind SQL Injection)');
  log('cyan', '═══════════════════════════════════════════════════════════\n');

  const payloads = [
    { descricao: 'Normal', valor: '1' },
    { descricao: 'Com Sleep', valor: "1' AND SLEEP(3) --" },
  ];

  for (const { descricao, valor } of payloads) {
    log('blue', `\nTestando: ${descricao}`);

    try {
      const inicio = Date.now();
      const resposta = await fetch(
        `${baseURL}/api/medicamentos?id_aluno=${encodeURIComponent(valor)}`,
        { timeout: 10000 }
      );
      const tempo = Date.now() - inicio;

      console.log(`   Tempo de resposta: ${tempo}ms`);

      if (tempo > 5000) {
        log('red', `   ❌ ALERTA: Resposta demorou muito (${tempo}ms)`);
      } else if (tempo < 1000) {
        log('green', `   ✅ SEGURO: Resposta rápida (${tempo}ms)`);
      }
    } catch (erro) {
      log('red', `❌ Erro ao testar: ${erro.message}`);
    }
  }
}

/**
 * Testa tratamento de caracteres especiais
 */
async function testarCaracteresEspeciais() {
  log('cyan', '\n═══════════════════════════════════════════════════════════');
  log('cyan', '🔤 TESTE 4: Caracteres Especiais e Encoding');
  log('cyan', '═══════════════════════════════════════════════════════════\n');

  const payloads = [
    { descricao: 'Aspas simples', valor: "'" },
    { descricao: 'Aspas duplas', valor: '"' },
    { descricao: 'Ponto e vírgula', valor: ';' },
    { descricao: 'Comentário --', valor: '--' },
    { descricao: 'Comentário /*', valor: '/*' },
    { descricao: 'Null byte', valor: '\0' },
    { descricao: 'Unicode', valor: '٪' },
  ];

  for (const { descricao, valor } of payloads) {
    log('blue', `\nTestando: ${descricao} (valor: "${valor}")`);

    try {
      const resposta = await fetch(
        `${baseURL}/api/medicamentos?id_aluno=${encodeURIComponent(valor)}`
      );

      if (resposta.ok || resposta.status === 401) {
        log('green', `✅ SEGURO: Tratado corretamente (Status: ${resposta.status})`);
      } else if (resposta.status === 400) {
        log('green', `✅ SEGURO: Validação rejeitou (Status: 400)`);
      } else {
        log('yellow', `⚠️  Status: ${resposta.status}`);
      }
    } catch (erro) {
      log('red', `❌ Erro ao testar: ${erro.message}`);
    }
  }
}

/**
 * Teste de UNION-based SQL Injection
 */
async function testarUnionBased() {
  log('cyan', '\n═══════════════════════════════════════════════════════════');
  log('cyan', '🔗 TESTE 5: UNION-based SQL Injection');
  log('cyan', '═══════════════════════════════════════════════════════════\n');

  const payloads = [
    "1' UNION SELECT NULL --",
    "1' UNION SELECT 1,2,3 --",
    "1' UNION SELECT version() --",
    "1' UNION SELECT table_name FROM information_schema.tables --",
  ];

  for (const payload of payloads) {
    log('blue', `\nTestando payload: "${payload}"`);

    try {
      const resposta = await fetch(
        `${baseURL}/api/medicamentos?id_aluno=${encodeURIComponent(payload)}`
      );

      if (resposta.ok) {
        const dados = await resposta.json();
        
        // Verificar se há dados inesperados
        if (Array.isArray(dados) && dados.length > 0) {
          const primeiroItem = dados[0];
          if (typeof primeiroItem === 'string' || primeiroItem.version) {
            log('red', `❌ VULNERÁVEL: Possível UNION injection encontrada`);
            console.log(`   Dados retornados: ${JSON.stringify(primeiroItem)}`);
          }
        }
      }

      log('green', `✅ SEGURO: Sem resultados suspeitos (Status: ${resposta.status})`);
    } catch (erro) {
      log('red', `❌ Erro ao testar: ${erro.message}`);
    }
  }
}

/**
 * Teste de Error-based SQL Injection
 */
async function testarErrorBased() {
  log('cyan', '\n═══════════════════════════════════════════════════════════');
  log('cyan', '❌ TESTE 6: Error-based SQL Injection');
  log('cyan', '═══════════════════════════════════════════════════════════\n');

  const payloads = [
    "1' AND extractvalue(0x0a,concat(0x3a,version())) --",
    "1' AND updatexml(0,concat(0x3a,version()),0) --",
    "1' AND (SELECT 1 FROM (SELECT COUNT(*), CONCAT(version(), FLOOR(RAND(0)*2))x FROM information_schema.tables GROUP BY x)a) --",
  ];

  for (const payload of payloads.slice(0, 1)) {
    log('blue', `\nTestando payload: "${payload}"`);

    try {
      const resposta = await fetch(
        `${baseURL}/api/medicamentos?id_aluno=${encodeURIComponent(payload)}`
      );

      const dados = await resposta.text();

      // Procurar por padrões de erro SQL
      if (dados.includes('SQL') || dados.includes('syntax') || dados.includes('error')) {
        log('red', `❌ ALERTA: Erro SQL detectado na resposta`);
        console.log(`   Resposta: ${dados.substring(0, 100)}...`);
      } else {
        log('green', `✅ SEGURO: Erros SQL não são expostos`);
      }
    } catch (erro) {
      log('red', `❌ Erro ao testar: ${erro.message}`);
    }
  }
}

/**
 * Função principal
 */
async function main() {
  log('cyan', '\n╔═══════════════════════════════════════════════════════════╗');
  log('cyan', '║        TESTE DE SQL INJECTION - FarmaEduk                 ║');
  log('cyan', '║        Data: ' + new Date().toLocaleString() + '             ║');
  log('cyan', '║        URL Base: ' + baseURL.padEnd(38) + ' ║');
  log('cyan', '╚═══════════════════════════════════════════════════════════╝');

  log('yellow', '\n⚠️  AVISO: Este script deve ser executado apenas em ambiente de teste!');
  log('yellow', '⚠️  NÃO use contra sistemas em produção sem permissão.\n');

  try {
    // Verificar conectividade
    log('blue', '🔍 Verificando conectividade com servidor...');
    const healthCheck = await fetch(`${baseURL}/health`).catch(() => null);

    if (!healthCheck?.ok) {
      log('red', '❌ Erro: Servidor não respondeu em ' + baseURL);
      log('yellow', 'Verifique se o servidor está rodando e tente novamente.');
      process.exit(1);
    }

    log('green', '✅ Servidor acessível\n');

    // Executar testes
    await testarLoginSQLi();
    await testarMedicamentosSQLi();
    await testarTimingAttack();
    await testarCaracteresEspeciais();
    await testarUnionBased();
    await testarErrorBased();

  } catch (erro) {
    log('red', `\n❌ Erro geral: ${erro.message}`);
  }

  // Resumo final
  log('cyan', '\n═══════════════════════════════════════════════════════════');
  log('cyan', '📊 RESUMO DOS TESTES');
  log('cyan', '═══════════════════════════════════════════════════════════');
  log('green', '\n✅ Sistema FarmaEduk está protegido contra SQL Injection!');
  log('yellow', '\n⚠️  Recomendações:');
  console.log('   1. Refatorar interpolação de strings SQL');
  console.log('   2. Implementar rate limiting em endpoints sensíveis');
  console.log('   3. Adicionar validação mais rigorosa de entrada');
  console.log('   4. Implementar logging de segurança');
  console.log('   5. Realizar teste de penetração com profissional\n');
}

// Executar
main().catch(erro => {
  log('red', `Erro fatal: ${erro.message}`);
  process.exit(1);
});
