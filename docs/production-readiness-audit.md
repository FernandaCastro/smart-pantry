# Auditoria de Prontidão para Produção (Smart Pantry)

Data: 2026-02-27

## Status executivo

**Conclusão:** o projeto **ainda não está pronto para produção** no estado atual.

Há pelo menos **2 riscos críticos** que precisam ser corrigidos antes do go-live, principalmente relacionados ao banco de dados e políticas de acesso.

## Pontos críticos (bloqueadores)

1. **RLS permissivo (`ALLOW ALL`) no script de setup principal**
   - O arquivo `database.sql` cria políticas que permitem leitura/escrita irrestritas em `profiles` e `pantry_items`.
   - Isso possibilita acesso cruzado entre usuários caso esse script seja aplicado em produção.
   - Evidência: `CREATE POLICY ... USING (true) WITH CHECK (true)`.

2. **Coluna `password` em `profiles`**
   - O arquivo `database.sql` define `password TEXT` em `profiles`.
   - Em arquitetura com Supabase Auth, senha não deve ser armazenada em tabela de domínio (nem mesmo hash sem necessidade clara).
   - Risco de vazamento e não conformidade de boas práticas de segurança.

## Riscos altos (recomendado corrigir antes de produção)

1. **Funções edge com CORS aberto para qualquer origem (`*`)**
   - `ai-suggestions` e `voice-assistant` aceitam `Access-Control-Allow-Origin: *`.
   - Embora exijam JWT, isso amplia superfície para abuso por origens não confiáveis (scripts third-party usando token roubado).

2. **Ausência de limite de tamanho de payload nas funções de IA**
   - Não há validação estrita de tamanho para `transcript` e lista de itens (`pantry`) antes de chamar o modelo.
   - Pode causar consumo excessivo de recursos e custos desnecessários.

3. **Políticas seguras existem, mas não fazem parte do fluxo padrão de migração**
   - Há um arquivo de políticas seguras (`supabase/rls_policies.sql`), porém ele não aparece como migração aplicada automaticamente.
   - Risco operacional: ambiente novo subir com política permissiva por engano.

## Riscos médios / melhorias importantes

1. **Governança de custo incompleta no nível global**
   - Existe cota por usuário/feature, porém sem kill-switch global por projeto e sem rate limiting por IP.

2. **Observabilidade e resposta a incidentes**
   - Faltam indicadores/alertas explícitos para picos de consumo, erros de função e padrões de abuso.

3. **Hardening de esquema de dados**
   - Faltam constraints mais fortes (ex.: quantidades não negativas no banco via `CHECK`, validação de enum para categorias/unidades no Postgres).

## Pontos positivos já implementados

- Chave do Gemini está no backend (Edge Function), sem exposição no frontend.
- Funções validam autenticação e identificam usuário via `supabase.auth.getUser()`.
- Existe controle de consumo de tokens em janela de 24h para features de IA.
- Há arquivo de políticas RLS seguras pronto para aplicação.

## Plano de ação recomendado (ordem sugerida)

1. **Bloquear produção até corrigir segurança de dados (P0)**
   - Remover `password` de `profiles`.
   - Eliminar políticas permissivas e aplicar políticas de `supabase/rls_policies.sql`.
   - Converter essas políticas em **migração oficial versionada**.

2. **Hardening de Edge Functions (P0/P1)**
   - Restringir `Access-Control-Allow-Origin` para domínios confiáveis.
   - Validar limites de entrada (`transcript` e tamanho/quantidade de itens no `pantry`).
   - Retornar `413`/`400` para payload fora do padrão.

3. **Controles de abuso e custo (P1)**
   - Adicionar limite global diário de tokens (project-level budget).
   - Adicionar rate limiting (por usuário + IP) nas funções.

4. **Confiabilidade e observabilidade (P1)**
   - Métricas e alertas para: erro de função, 429, consumo de tokens, latência.
   - Dashboard operacional mínimo para suporte pós-go-live.

5. **Governança de release (P1)**
   - Pipeline CI com gates: build, testes, validação de migrações e smoke test de auth/RLS.

## Checklist mínimo de Go-Live

- [x] Sem políticas `ALLOW ALL` em produção.
- [x] Sem coluna `password` em tabelas de domínio.
- [x] RLS validado por testes de acesso entre usuários.
- [x] CORS restrito por ambiente (dev/stage/prod).
- [ ] Limites de payload + rate limiting ativos.
- [ ] Alertas de custo/erro configurados.
- [ ] Backup, política de retenção e plano de rollback documentados.

## Veredito final

**Não recomendado para produção imediata.**

Com a correção dos itens críticos e altos listados acima, o projeto pode evoluir para um rollout seguro (idealmente começando com beta fechado e observabilidade ativa).
