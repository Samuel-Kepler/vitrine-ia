# Pesquisa: elevar o nível do backend GERADO pelo Vitrine Studio

Escopo desta pesquisa: **só o gerador de backend** do Vitrine Studio (modo
"Arquitetura" e modo "Banco"). Não é sobre o editor visual nem sobre o servidor
do próprio Studio. Como rodar a pesquisa está no fim do arquivo.

## O que o produto faz

O usuário desenha a arquitetura num canvas (nós: API, Serviço, Worker, Fila,
Cache, Banco Postgres, Arquivos/S3, API externa, Autenticação) e um diagrama ER
de tabelas. O Studio gera, **de forma determinística (templates em TypeScript,
sem IA no código gerado)**, um zip que o usuário baixa e roda com
`docker compose up --build`. O código é um molde inicial: compila, sobe e tem
TODOs onde entra a regra de negócio. Usuários são iniciantes e intermediários;
a demo dura de 10 a 15 minutos, e o molde precisa continuar simples de ler.

## O que é gerado hoje

- Um serviço Node 24 + TypeScript por nó executável: Hono 4.13 +
  @hono/node-server, `pg` 8 (SQL puro, sem ORM), zod 4, ioredis 6, tsx.
- Rotas declaradas no canvas (`MÉTODO /caminho [auth]`). Rota que bate com
  uma tabela vira CRUD real (`GET` lista/um, `POST` com validação zod derivada
  das colunas). Erros: 400 com `issues`, 409 para UNIQUE e chave estrangeira.
- Autenticação própria opcional: tabela `users`, senha com scrypt
  (`node:crypto`), JWT HS256 (`hono/jwt`) válido por 7 dias, rotas
  protegidas pegam o dono do token.
- Fila e worker com Redis Streams; cache Redis; clientes HTTP entre serviços;
  MinIO para arquivos.
- Docker: Dockerfile multi-stage, `USER node`, HEALTHCHECK, `.dockerignore`;
  compose com healthchecks e `depends_on: service_healthy`; Postgres 17 e
  Redis 7 publicados só em 127.0.0.1; `.env` com segredos aleatórios por
  export; `.env.example` e `.gitignore`.
- Banco: schema em SQL (Postgres, MySQL, SQLite), Prisma, Drizzle e DBML. O
  Postgres aplica `db/schema.postgres.sql` só na primeira subida do volume.
- Já testado de ponta a ponta com Docker (POST/GET de uma tabela, evento no
  worker, senha errada recusada).

## Hipóteses de melhoria (a pesquisa pode confirmar, trocar ou descartar)

Foram levantadas olhando o código; **não são obrigatórias**. Itens melhores que
não estejam aqui são bem-vindos.

1. Testes gerados junto: cada serviço sai com testes das rotas (400, 201,
   409, 401). Hoje o zip não tem nenhum teste.
2. API pronta para ser publicada: CORS, limite de tamanho do corpo,
   limite de requisições e proteção contra spam no `POST` público.
3. Migrações em vez de só o schema inicial (hoje mudar o schema exige
   `docker compose down -v`).
4. OpenAPI gerado a partir das rotas e dos schemas zod (documentação
   navegável e cliente tipado).
5. Observabilidade mínima: logs estruturados, request id, `/health` que
   checa banco e Redis.
6. Encerramento gracioso (SIGTERM), retry e fila de mensagens mortas no
   worker.

## Perguntas em aberto para os agentes

- O que mais separa um "molde que sobe" de um "backend que dá para colocar
  em produção pequena", sem inchar o código para iniciantes?
- Qual ferramenta de migração combina com SQL puro + `pg` e com o schema já
  gerado em vários formatos?
- Vale gerar OpenAPI a partir do zod 4 atual? Com qual biblioteca?
- Que padrão de testes funciona dentro do `docker compose` e também sem
  Docker (ex.: banco efêmero)?
- Há riscos de segurança no que já é gerado (JWT, scrypt, SQL, compose) que
  não foram percebidos?

## Restrições

- Código gerado sem IA, legível, com poucas dependências; nada de framework
  pesado ou ORM obrigatório.
- Tem de funcionar no Windows com Docker Desktop.
- Cada melhoria precisa poder ser verificada por teste no gerador (vitest) e,
  idealmente, no `docker compose`.

## Como rodar a pesquisa

Nesta pasta (ela vira o escopo do orquestrador):

```bash
cd studio/docs/pesquisa-backend
python <caminho>/orchestrator_v5.py --agy-model gemini-4-neon-high
```

Os relatórios saem em `agent_workspace/v5/` (fora do git). O mais útil é o
`5_para_o_dev.md` quando o juiz aprova; senão, a crítica `2_critica.md`.
