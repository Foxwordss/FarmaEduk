# Testes de SQL Injection com cURL - FarmaEduk

## Como Executar

```bash
# Execute os testes abaixo no seu terminal
# Substitua http://localhost:3000 pela URL do seu servidor
```

---

## 🔐 TESTE 1: Login com SQL Injection Clássico

### Teste 1.1: Comment-based SQL Injection
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "usuario": "admin'"'"' --",
    "senha": "qualquer"
  }'
```

**Resultado esperado:** ❌ Usuário não encontrado (401)

---

### Teste 1.2: OR-based SQL Injection
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "usuario": "'"'"' OR '"'"'1'"'"'='"'"'1",
    "senha": "'"'"' OR '"'"'1'"'"'='"'"'1"
  }'
```

**Resultado esperado:** ❌ Usuário ou senha inválidos (401)

---

### Teste 1.3: Bypass de Senha
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "usuario": "admin",
    "senha": "'"'"' OR 1=1 --"
  }'
```

**Resultado esperado:** ❌ Falha na autenticação (401)

---

## 💊 TESTE 2: Filtro de Medicamentos

### Teste 2.1: OR-based no parâmetro id_aluno
```bash
curl "http://localhost:3000/api/medicamentos?id_aluno=1' OR '1'='1"
```

**Resultado esperado:** ❌ Requer autenticação (401) ou lista vazia (sem autentar)

---

### Teste 2.2: UNION-based SQL Injection
```bash
curl "http://localhost:3000/api/medicamentos?id_aluno=1' UNION SELECT * FROM usuario --"
```

**Resultado esperado:** ❌ Requer autenticação (401)

---

### Teste 2.3: Stacked Queries (DROP TABLE)
```bash
curl "http://localhost:3000/api/medicamentos?id_aluno=1'; DROP TABLE medicamento; --"
```

**Resultado esperado:** ❌ Query segura (tabela intacta)

---

### Teste 2.4: Comment Injection
```bash
curl "http://localhost:3000/api/medicamentos?id_aluno=1' --"
curl "http://localhost:3000/api/medicamentos?id_aluno=1' #"
curl "http://localhost:3000/api/medicamentos?id_aluno=1' /*"
```

**Resultado esperado:** ❌ Sem resultados ou erro validação

---

## 🔗 TESTE 3: UNION-based para Enumeration

### Teste 3.1: Descobrir número de colunas
```bash
curl "http://localhost:3000/api/medicamentos?id_aluno=1' ORDER BY 1--"
curl "http://localhost:3000/api/medicamentos?id_aluno=1' ORDER BY 2--"
curl "http://localhost:3000/api/medicamentos?id_aluno=1' ORDER BY 5--"
```

**Resultado esperado:** ❌ Sem erro ou erro na última

---

### Teste 3.2: UNION para ler versão do banco
```bash
curl "http://localhost:3000/api/medicamentos?id_aluno=1' UNION SELECT version(),NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL--"
```

**Resultado esperado:** ❌ Sem dados ou erro

---

## ⏱️ TESTE 4: Timing-based Blind SQL Injection

### Teste 4.1: Sem sleep (resposta rápida)
```bash
curl -w "\nTempo: %{time_total}s\n" http://localhost:3000/api/medicamentos
```

**Resultado esperado:** < 1 segundo

---

### Teste 4.2: Com SLEEP (resposta lenta)
```bash
curl -w "\nTempo: %{time_total}s\n" \
  "http://localhost:3000/api/medicamentos?id_aluno=1' AND SLEEP(5) --"
```

**Resultado esperado:** Se levou 5+ segundos = vulnerável, se levou < 1s = seguro

---

### Teste 4.3: Condicional SLEEP
```bash
curl -w "\nTempo: %{time_total}s\n" \
  "http://localhost:3000/api/medicamentos?id_aluno=1' AND IF(1=1, SLEEP(5), 0) --"
```

---

## 🔍 TESTE 5: Error-based SQL Injection

### Teste 5.1: Forçar erro de conversão
```bash
curl "http://localhost:3000/api/medicamentos?id_aluno=1' AND CAST(version() AS INT)--"
```

**Resultado esperado:** ❌ Erro de validação ou sem erro (ambos seguros)

---

### Teste 5.2: Forçar erro de sintaxe
```bash
curl "http://localhost:3000/api/medicamentos?id_aluno=1' AND 1=CONVERT(int,(SELECT @@version))--"
```

---

## 🧪 TESTE 6: Encoding e Bypass

### Teste 6.1: URL Encoding duplo
```bash
curl "http://localhost:3000/api/medicamentos?id_aluno=%2527%20OR%20%2527%281%2527%253D%2527"
# Decodifica para: %27 OR %27(1%27=%27
```

---

### Teste 6.2: Hex Encoding
```bash
curl "http://localhost:3000/api/medicamentos?id_aluno=0x31%27%20OR%20%270x31%27%3D%270x31"
```

---

### Teste 6.3: Comentário em várias linguagens
```bash
curl "http://localhost:3000/api/medicamentos?id_aluno=1' --+" # SQL Server
curl "http://localhost:3000/api/medicamentos?id_aluno=1' %23" # URL encoded #
curl "http://localhost:3000/api/medicamentos?id_aluno=1' %2F%2A" # URL encoded /*
```

---

## 📊 TESTE 7: Validação com Headers Malformados

### Teste 7.1: Header X-User-Id com SQL
```bash
curl -H "X-User-Id: 1' OR '1'='1" \
  http://localhost:3000/api/medicamentos
```

---

### Teste 7.2: Header Autorização injetado
```bash
curl -H "Authorization: Bearer ' OR '1'='1" \
  http://localhost:3000/api/medicamentos
```

---

## 🛡️ TESTE 8: Proteção Observada

### Teste 8.1: Verificar Prepared Statements
```bash
# Se a aplicação usar prepared statements corretamente,
# esses payloads NÃO devem retornar dados extras

curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "usuario": "admin",
    "senha": "passwd1234'\''OR'\''1'\''='\''1"
  }'

# Esperado: Erro de autenticação, não bypass
```

---

### Teste 8.2: Verificar Escaping
```bash
# Testar se aspas estão sendo escapadas
curl "http://localhost:3000/api/medicamentos?id_aluno=test%27%22test"

# Se retornar erro SQL = vulnerável
# Se tratado como string = seguro
```

---

## 📈 TESTE 9: Rate Limiting

### Teste 9.1: Múltiplas tentativas de login (brute force)
```bash
for i in {1..10}; do
  curl -X POST http://localhost:3000/auth/login \
    -H "Content-Type: application/json" \
    -d '{
      "usuario": "admin",
      "senha": "wrong'$i'"
    }'
  echo "Tentativa $i"
done
```

**Resultado esperado:** Após N tentativas, receber 429 (Too Many Requests)

---

### Teste 9.2: Rapidez das respostas
```bash
for i in {1..5}; do
  echo "Requisição $i:"
  curl -w "Tempo: %{time_total}s\n" \
    "http://localhost:3000/api/medicamentos?id_aluno=$i" \
    -o /dev/null -s
done
```

**Resultado esperado:** Tempo consistente (~100-500ms), não exponencial

---

## 🔐 TESTE 10: Segurança de Senhas

### Teste 10.1: Senha em texto plano
```bash
# NÃO fazer este teste em produção!
# Apenas em dev/test
curl "http://localhost:3000/api/alunos" \
  -H "Authorization: Bearer [token_valido]" | grep -i "senha"
```

**Resultado esperado:** Sem campo "senha" na resposta

---

### Teste 10.2: Hash fraco
```bash
# Verificar se a senha retorna hash MD5 ou SHA1 simples
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"usuario": "admin", "senha": "test"}' | grep -i "hash"
```

---

## 📝 Interpretação dos Resultados

| Status | Significado | Segurança |
|--------|------------|-----------|
| 401 Unauthorized | Rejeição correta | ✅ SEGURO |
| 400 Bad Request | Validação bloqueou | ✅ SEGURO |
| 500 Internal Error | Sem detalhes SQL | ✅ SEGURO |
| 200 OK + dados | Possível SQLi | ❌ RISCO |
| Erro SQL visível | Exposição de BD | ❌ CRÍTICO |
| Resposta > 5s | Timing/Sleep exec | ❌ RISCO |

---

## 🚀 Executar Todos de Uma Vez

```bash
#!/bin/bash

echo "🧪 Iniciando testes de SQL Injection..."

# Teste 1
echo -e "\n=== TESTE 1: Login SQLi ==="
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"usuario": "admin'\''--", "senha": "x"}'

# Teste 2
echo -e "\n\n=== TESTE 2: Medicamentos OR ==="
curl "http://localhost:3000/api/medicamentos?id_aluno=1' OR '1'='1"

# Teste 3
echo -e "\n\n=== TESTE 3: Timing ==="
time curl "http://localhost:3000/api/medicamentos?id_aluno=1' AND SLEEP(3)--"

echo -e "\n\n✅ Testes concluídos!"
```

Salve como `test-sqli.sh` e execute:
```bash
chmod +x test-sqli.sh
./test-sqli.sh
```

---

## ⚠️ Advertências Legais

- ✅ Use este script APENAS em ambientes de teste
- ✅ Obtenha permissão escrita antes de testar qualquer sistema
- ❌ NÃO use contra sistemas em produção sem autorização
- ❌ NÃO cause danos ou modifique dados

---

## 📞 Suporte

Se encontrar problemas:
1. Verifique se o servidor está rodando em `http://localhost:3000`
2. Verifique logs do servidor para mais detalhes
3. Execute com `-v` para verbose: `curl -v http://localhost:3000/health`
