# 🔐 Checklist de Segurança - FarmaEduk

Use este checklist em revisões periódicas de segurança (recomendado: mensal ou após cada release).

---

## 📋 Categoria 1: SQL Injection

### Verificações de Código

- [ ] Todas as queries usam prepared statements com `$1`, `$2`, etc.
- [ ] Nenhuma interpolação de strings em queries (`${variavel}` em template SQL)
- [ ] Todos os inputs do usuário são parametrizados
- [ ] Não há concatenação direta de SQL: `query + userInput`
- [ ] Função `obterCampo()` valida strings antes de usar
- [ ] Validação numérica usa `Number.isInteger()` quando apropriado

**Comandos de verificação:**
```bash
# Procurar por template literals em queries
grep -r "\${" backend/src --include="*.js" | grep -i "query\|sql\|select\|insert"

# Procurar por concatenação com +
grep -r "query.*+\|+.*query" backend/src --include="*.js"

# Procurar por pool.query sem parametrização
grep -r "pool.query" backend/src --include="*.js" | grep -v "$"
```

### Testes Automatizados

- [ ] Executar `node sql-injection-tests.js` e verificar ✅ em todos os testes
- [ ] Testar payloads comuns:
  - [ ] `' OR '1'='1`
  - [ ] `admin' --`
  - [ ] `1' UNION SELECT * FROM usuario`
  - [ ] `'; DROP TABLE medicamento; --`

---

## 📋 Categoria 2: Autenticação e Autorização

### Verificações de Código

- [ ] Senhas são hasheadas com Scrypt (não MD5 ou SHA1)
- [ ] Salt é aleatório e diferente por usuário
- [ ] JWT tem secret forte em `.env` (não "hardcoded")
- [ ] JWT tem TTL (expiração) definido
- [ ] Tokens expirados são rejeitados
- [ ] Perfis de usuário (admin/aluno) são validados em cada request
- [ ] Endpoints sensíveis requerem `autenticar` middleware
- [ ] `exigirProfessor` middleware está em endpoints admin

**Comandos de verificação:**
```bash
# Verificar use de middleware
grep -r "autenticar\|exigirProfessor" backend/src/app.js

# Verificar algoritmo de hash
grep -r "crypto.scrypt\|hashSenha" backend/src --include="*.js"

# Verificar se JWT secret é variável de ambiente
grep -r "JWT_SECRET\|jwt_secret" backend/src --include="*.js"
```

### Testes Manuais

- [ ] Testar login com credenciais válidas
- [ ] Testar login com senha errada (deve falhar)
- [ ] Testar acesso a endpoint admin sem autenticação (deve falhar 401)
- [ ] Testar com token expirado (deve falhar)
- [ ] Testar com token JWT falso (deve falhar)

---

## 📋 Categoria 3: Validação de Input

### Verificações de Código

- [ ] Campos obrigatórios são validados (não undefined/null)
- [ ] Strings são trimadas com `.trim()`
- [ ] Comprimento máximo é validado
- [ ] Caracteres especiais são escapados ou validados
- [ ] Tipos de dados são validados (string vs número)
- [ ] Valores numéricos são convertidos com `Number()`
- [ ] Datas estão em formato ISO (YYYY-MM-DD)

**Código de validação esperado:**
```javascript
// ✅ BOM
const nome = String(body.nome || '').trim();
if (!nome || nome.length > 100) {
  return res.status(400).json({ erro: 'Nome inválido' });
}

// ❌ RUIM
const nome = body.nome;  // Sem validação
```

### Testes de Payload

- [ ] Testar com campo vazio: `""`
- [ ] Testar com valores muito longos: `"a".repeat(1000)`
- [ ] Testar com caracteres especiais: `<script>`, `'; DROP`, `../`
- [ ] Testar com valores nulos: `null`, `undefined`
- [ ] Testar com tipos errados: string para número, número para string

---

## 📋 Categoria 4: Rate Limiting e DoS

### Verificações de Código

- [ ] Express-rate-limit está instalado: `npm list express-rate-limit`
- [ ] Middleware de rate limit aplicado ao login
- [ ] Limite de tentativas (ex: 5 por 15 min) está configurado
- [ ] Limite geral de API (ex: 100 por 15 min) está configurado
- [ ] Timeouts estão definidos em queries longas

### Testes de Rate Limiting

```bash
# Teste: Fazer 6 requisições de login rapidamente
for i in {1..6}; do
  curl -X POST http://localhost:3000/auth/login \
    -H "Content-Type: application/json" \
    -d '{"usuario":"admin","senha":"wrong'$i'"}'
  echo "Tentativa $i"
done

# Resultado esperado: Última requisição retorna 429 Too Many Requests
```

---

## 📋 Categoria 5: CORS e Headers de Segurança

### Verificações de Código

- [ ] CORS não está usando `app.use(cors())` sem configuração
- [ ] Whitelist de origens está definido
- [ ] Header `Access-Control-Allow-Credentials` é `true` (se necessário)
- [ ] Header `X-Frame-Options` é `DENY`
- [ ] Header `X-Content-Type-Options` é `nosniff`
- [ ] Header `X-XSS-Protection` está definido
- [ ] Content-Security-Policy está configurado

**Verificar headers:**
```bash
curl -I http://localhost:3000/health

# Verificar retorna:
# X-Frame-Options: DENY
# X-Content-Type-Options: nosniff
# X-XSS-Protection: 1; mode=block
# Content-Security-Policy: ...
```

---

## 📋 Categoria 6: Logging e Monitoramento

### Verificações de Código

- [ ] Erros são logados com detalhes suficientes
- [ ] Informações sensíveis (senhas, tokens) NÃO são logadas
- [ ] Tentativas de login falhadas são registradas
- [ ] Tentativas de acesso a endpoints protegidos são logadas
- [ ] Arquivo de log existe e está sendo escrito
- [ ] Logs incluem timestamp e tipo de evento
- [ ] Nenhuma informação de erro SQL é exposta ao cliente

**Arquivo de log deve estar em:**
```
backend/logs/security.log  (ou configurado em .env)
```

---

## 📋 Categoria 7: Configuração Segura

### Verificações de .env

- [ ] Arquivo `.env` existe e está no `.gitignore`
- [ ] `.env.example` existe sem valores sensíveis
- [ ] `DATABASE_URL` está definido
- [ ] `JWT_SECRET` está definido (mínimo 32 caracteres)
- [ ] `NODE_ENV` é `production` em produção
- [ ] Nenhum `.env` foi commitado no Git

```bash
# Verificar se .env está em gitignore
cat .gitignore | grep "\.env"

# Verificar se há secrets no git (não deve retornar nada)
git log --all --full-history -- ".env" | head -20
```

### Verificações de package.json

- [ ] Dependências estão atualizadas
- [ ] Sem dependências desnecessárias
- [ ] Vulnerabilidades conhecidas foram revisadas

```bash
npm outdated          # Verificar atualizações
npm audit             # Verificar vulnerabilidades
npm audit fix         # Corrigir vulnerabilidades
```

---

## 📋 Categoria 8: Banco de Dados

### Verificações

- [ ] Senhas do banco estão fortes
- [ ] Usuário do banco tem privilégios mínimos
- [ ] Backups são feitos regularmente
- [ ] Backups são testados periodicamente
- [ ] Não há dados sensíveis em claro no banco
- [ ] Queries de inicialização estão seguras (`init.sql`)

### Teste de Conectividade

```bash
# Testar conexão ao banco
psql -h localhost -U farmaeduk -d farmaeduk -c "SELECT version();"
```

---

## 📋 Categoria 9: Dependências e Versões

### Verificar Versões Seguras

```bash
# Node.js >= 16 LTS (recomendado 18+)
node --version

# npm >= 7
npm --version

# Listar versões de bibliotecas críticas
npm list pg crypto-js express cors dotenv
```

**Versões mínimas recomendadas:**
- Node.js: 18.x LTS
- npm: 9.x
- pg: 8.7.x
- express: 4.18.x
- cors: 2.8.5
- dotenv: 16.0.x

---

## 📋 Categoria 10: Testes de Segurança Regulares

### Teste Mensal

- [ ] Executar `sql-injection-tests.js` completo
- [ ] Revisar arquivo `security.log`
- [ ] Verificar falhas de login suspeitas
- [ ] Atualizar dependências com `npm audit`

### Teste Trimestral

- [ ] Teste de penetração manual
- [ ] Revisão de código de segurança
- [ ] Auditoria de logs
- [ ] Teste de backup e recovery

### Teste Anual

- [ ] Teste de penetração profissional
- [ ] Auditoria de segurança completa
- [ ] Revisão de policies de segurança
- [ ] Treinamento de segurança para desenvolvedores

---

## 🟢 Verificação Rápida (5 minutos)

Use este checklist abreviado semanalmente:

```bash
#!/bin/bash

echo "🔐 Verificação de Segurança Rápida - FarmaEduk"
echo "================================================="

# 1. Verificar se .env existe
if [ -f .env ]; then
  echo "✅ .env encontrado"
else
  echo "❌ .env NÃO encontrado"
fi

# 2. Verificar vulnerabilidades conhecidas
echo ""
echo "Verificando vulnerabilidades npm..."
npm audit --audit-level=moderate

# 3. Verificar atualização de dependências
echo ""
echo "Verificando atualizações disponíveis..."
npm outdated | head -5

# 4. Testar conexão ao banco
echo ""
echo "Testando banco de dados..."
curl -s http://localhost:3000/health | grep status

# 5. Testar login
echo ""
echo "Testando autenticação..."
curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"usuario":"test","senha":"test"}' | grep -o "erro\|autenticado"

echo ""
echo "================================================="
echo "✅ Verificação rápida concluída!"
```

Salve como `security-check.sh`:
```bash
chmod +x security-check.sh
./security-check.sh
```

---

## 📊 Scorecard de Segurança

Preencha este scorecard a cada revisão:

```
Data: ___/___/____

Categoria 1: SQL Injection
  Verificações: [ ] / 6
  Score: ___/10

Categoria 2: Autenticação
  Verificações: [ ] / 8
  Score: ___/10

Categoria 3: Validação
  Verificações: [ ] / 7
  Score: ___/10

Categoria 4: Rate Limiting
  Verificações: [ ] / 3
  Score: ___/10

Categoria 5: CORS / Headers
  Verificações: [ ] / 7
  Score: ___/10

Categoria 6: Logging
  Verificações: [ ] / 7
  Score: ___/10

Categoria 7: Configuração
  Verificações: [ ] / 6
  Score: ___/10

Categoria 8: Banco de Dados
  Verificações: [ ] / 6
  Score: ___/10

Categoria 9: Dependências
  Verificações: [ ] / 4
  Score: ___/10

Categoria 10: Testes
  Verificações: [ ] / 3
  Score: ___/10

SCORE TOTAL: ___/100

Responsável: _________________________
Assinatura: ___________________________
```

---

## 🚨 Procedimento de Incidente

Se encontrar uma vulnerabilidade:

1. **Documentar** - Registre a vulnerabilidade imediatamente
2. **Isolar** - Se crítica, remova o sistema do ar
3. **Informar** - Notifique o responsável
4. **Investigar** - Determine o impacto
5. **Corrigir** - Implemente a correção
6. **Testar** - Valide a correção
7. **Deploy** - Coloque em produção
8. **Comunicar** - Informe stakeholders

---

## 📞 Contatos de Emergência

- **Segurança:** seguranca@farmaeduk.com
- **DevOps:** devops@farmaeduk.com
- **Gerência:** gerencia@farmaeduk.com
- **Bug Bounty:** security@farmaeduk.com (se aplicável)

---

## 📚 Recursos Adicionais

- [OWASP Top 10 2023](https://owasp.org/www-project-top-ten/)
- [CWE Top 25 2023](https://cwe.mitre.org/top25/)
- [Node.js Security Checklist](https://github.com/goldbergyoni/nodebestpractices#6-security-best-practices)
- [Express Security](https://expressjs.com/en/advanced/best-practice-security.html)

---

**Última atualização:** 12/05/2026  
**Próxima revisão:** 12/06/2026  
**Versão:** 1.0
