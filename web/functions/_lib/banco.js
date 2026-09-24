/**
 * Banco de dados (Cloudflare D1) e migrações.
 *
 * As migrações rodam sozinhas na primeira requisição de cada instância. Não há
 * passo manual de "rodar o SQL" na publicação — é um passo a menos para errar.
 * Cada migração é uma lista de comandos aplicada numa transação só (`batch`).
 *
 * Regra para quem mexer aqui: migração publicada NÃO se edita. Mudança de
 * esquema é uma migração nova no fim da lista.
 */

const MIGRACOES = [
  // 1 — esquema inicial
  [
    `CREATE TABLE IF NOT EXISTS organizacoes (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      atividade TEXT NOT NULL DEFAULT '',
      porte TEXT NOT NULL DEFAULT '',
      nivel TEXT NOT NULL DEFAULT '',
      situacao TEXT NOT NULL DEFAULT '',
      teto_diario_brl REAL,
      ativa INTEGER NOT NULL DEFAULT 1,
      criada_em INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS usuarios (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL REFERENCES organizacoes(id),
      email TEXT NOT NULL UNIQUE,
      nome TEXT NOT NULL,
      senha TEXT NOT NULL,
      papel TEXT NOT NULL CHECK (papel IN ('admin','editor','leitor')),
      superadmin INTEGER NOT NULL DEFAULT 0,
      ativo INTEGER NOT NULL DEFAULT 1,
      totp_segredo TEXT,
      totp_pendente TEXT,
      totp_ultimo INTEGER NOT NULL DEFAULT 0,
      criado_em INTEGER NOT NULL,
      ultimo_acesso INTEGER,
      senha_alterada_em INTEGER NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS usuarios_org ON usuarios(org_id)`,
    `CREATE TABLE IF NOT EXISTS sessoes (
      id TEXT PRIMARY KEY,
      usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      criada_em INTEGER NOT NULL,
      usada_em INTEGER NOT NULL,
      expira_em INTEGER NOT NULL,
      ip TEXT,
      navegador TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS sessoes_usuario ON sessoes(usuario_id)`,
    `CREATE TABLE IF NOT EXISTS convites (
      id TEXT PRIMARY KEY,
      token_hash TEXT NOT NULL UNIQUE,
      org_id TEXT NOT NULL REFERENCES organizacoes(id),
      email TEXT NOT NULL,
      papel TEXT NOT NULL CHECK (papel IN ('admin','editor','leitor')),
      criado_por TEXT,
      criado_em INTEGER NOT NULL,
      expira_em INTEGER NOT NULL,
      usado_em INTEGER
    )`,
    `CREATE INDEX IF NOT EXISTS convites_org ON convites(org_id)`,
    `CREATE TABLE IF NOT EXISTS redefinicoes (
      token_hash TEXT PRIMARY KEY,
      usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      criado_por TEXT,
      criado_em INTEGER NOT NULL,
      expira_em INTEGER NOT NULL,
      usado_em INTEGER
    )`,
    `CREATE TABLE IF NOT EXISTS tentativas (chave TEXT NOT NULL, em INTEGER NOT NULL)`,
    `CREATE INDEX IF NOT EXISTS tentativas_chave ON tentativas(chave, em)`,
    `CREATE TABLE IF NOT EXISTS eventos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      org_id TEXT,
      usuario_id TEXT,
      acao TEXT NOT NULL,
      alvo TEXT,
      detalhe TEXT,
      ip TEXT,
      em INTEGER NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS eventos_org ON eventos(org_id, em)`,
    `CREATE TABLE IF NOT EXISTS solicitacoes (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      email TEXT NOT NULL,
      empresa TEXT NOT NULL,
      telefone TEXT NOT NULL DEFAULT '',
      mensagem TEXT NOT NULL DEFAULT '',
      situacao TEXT NOT NULL DEFAULT 'pendente',
      ip TEXT,
      em INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS documentos (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL REFERENCES organizacoes(id),
      codigo TEXT NOT NULL,
      titulo TEXT NOT NULL,
      tipo TEXT NOT NULL,
      normas TEXT NOT NULL DEFAULT '',
      versao_vigente INTEGER,
      versao_aberta INTEGER,
      obsoleto INTEGER NOT NULL DEFAULT 0,
      criado_por TEXT NOT NULL,
      criado_em INTEGER NOT NULL,
      atualizado_em INTEGER NOT NULL,
      UNIQUE (org_id, codigo)
    )`,
    `CREATE INDEX IF NOT EXISTS documentos_org ON documentos(org_id, atualizado_em)`,
    `CREATE TABLE IF NOT EXISTS versoes (
      documento_id TEXT NOT NULL REFERENCES documentos(id) ON DELETE CASCADE,
      numero INTEGER NOT NULL,
      estado TEXT NOT NULL CHECK (estado IN ('rascunho','em_revisao','vigente','substituida','obsoleta','cancelada')),
      conteudo TEXT NOT NULL,
      origem TEXT NOT NULL DEFAULT 'manual',
      resumo TEXT NOT NULL DEFAULT '',
      parecer TEXT NOT NULL DEFAULT '',
      criado_por TEXT NOT NULL,
      criado_em INTEGER NOT NULL,
      editado_por TEXT,
      editado_em INTEGER,
      enviado_por TEXT,
      enviado_em INTEGER,
      aprovado_por TEXT,
      aprovado_em INTEGER,
      PRIMARY KEY (documento_id, numero)
    )`,
    `CREATE TABLE IF NOT EXISTS chamadas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      org_id TEXT NOT NULL,
      usuario_id TEXT NOT NULL,
      agente TEXT NOT NULL,
      modelo TEXT NOT NULL,
      entrada INTEGER NOT NULL DEFAULT 0,
      saida INTEGER NOT NULL DEFAULT 0,
      cache_leitura INTEGER NOT NULL DEFAULT 0,
      cache_escrita INTEGER NOT NULL DEFAULT 0,
      custo REAL NOT NULL,
      ms INTEGER NOT NULL DEFAULT 0,
      dia TEXT NOT NULL,
      em INTEGER NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS chamadas_org_dia ON chamadas(org_id, dia)`,
    `CREATE INDEX IF NOT EXISTS chamadas_dia ON chamadas(dia)`,
    `CREATE INDEX IF NOT EXISTS chamadas_usuario ON chamadas(usuario_id, em)`,
  ],
  // 2 — documento elaborado com apoio de IA e declaração de revisão humana na aprovação
  [
    `ALTER TABLE documentos ADD COLUMN apoio_ia TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE versoes ADD COLUMN revisao_declarada INTEGER NOT NULL DEFAULT 0`,
    `UPDATE documentos SET apoio_ia = (
       SELECT SUBSTR(v.origem, 8) FROM versoes v
        WHERE v.documento_id = documentos.id AND v.origem LIKE 'agente:%' ORDER BY v.numero LIMIT 1)
     WHERE EXISTS (SELECT 1 FROM versoes v WHERE v.documento_id = documentos.id AND v.origem LIKE 'agente:%')`,
  ],
  // 3 — sinalização de resposta de IA com problema (monitoramento pós-implantação)
  [
    `CREATE TABLE IF NOT EXISTS sinalizacoes (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      usuario_id TEXT NOT NULL,
      agente TEXT NOT NULL,
      norma TEXT NOT NULL DEFAULT '',
      motivo TEXT NOT NULL,
      comentario TEXT NOT NULL DEFAULT '',
      trecho TEXT NOT NULL DEFAULT '',
      situacao TEXT NOT NULL DEFAULT 'aberta',
      tratamento TEXT NOT NULL DEFAULT '',
      em INTEGER NOT NULL,
      tratada_em INTEGER
    )`,
    `CREATE INDEX IF NOT EXISTS sinalizacoes_situacao ON sinalizacoes(situacao, em)`,
  ],
  // 4 — aceite dos termos de uso e da política de privacidade, com versão e data
  [
    `ALTER TABLE usuarios ADD COLUMN termos_versao TEXT`,
    `ALTER TABLE usuarios ADD COLUMN termos_aceitos_em INTEGER`,
  ],
];

let pronto = null;

/** Garante o esquema. Memoizado por instância: custa uma consulta, uma vez. */
export function garantirEsquema(db) {
  pronto ??= migrar(db).catch((e) => {
    pronto = null; // tenta de novo na próxima requisição
    throw e;
  });
  return pronto;
}

async function migrar(db) {
  await db.prepare('CREATE TABLE IF NOT EXISTS meta (chave TEXT PRIMARY KEY, valor TEXT NOT NULL)').run();
  const linha = await db.prepare("SELECT valor FROM meta WHERE chave = 'versao_esquema'").first();
  let versao = Number(linha?.valor ?? 0);
  while (versao < MIGRACOES.length) {
    const comandos = MIGRACOES[versao].map((sql) => db.prepare(sql));
    versao += 1;
    comandos.push(
      db
        .prepare("INSERT INTO meta (chave, valor) VALUES ('versao_esquema', ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor")
        .bind(String(versao)),
    );
    await db.batch(comandos);
  }
}

export const agora = () => Date.now();
export const hoje = () => new Date().toISOString().slice(0, 10);

/** Atalhos: a maioria das rotas precisa de uma linha, várias linhas, ou executar. */
export const um = (db, sql, ...args) => db.prepare(sql).bind(...args).first();
export const todos = async (db, sql, ...args) => (await db.prepare(sql).bind(...args).all()).results ?? [];
export const executar = (db, sql, ...args) => db.prepare(sql).bind(...args).run();

/** Log de auditoria. Nunca derruba a operação que está sendo registrada. */
export async function registrarEvento(env, { org, usuario, acao, alvo = null, detalhe = null, ip = null }) {
  try {
    await executar(
      env.EPIGE_DB,
      'INSERT INTO eventos (org_id, usuario_id, acao, alvo, detalhe, ip, em) VALUES (?, ?, ?, ?, ?, ?, ?)',
      org ?? null,
      usuario ?? null,
      acao,
      alvo,
      detalhe == null ? null : String(detalhe).slice(0, 500),
      ip,
      agora(),
    );
  } catch (e) {
    console.error('evento', acao, e);
  }
}

/**
 * Limite de tentativas por chave (ex.: "login:email", "login:ip"). Conta as
 * falhas numa janela; quem passa do limite espera a janela acabar.
 */
export async function contarTentativas(env, chave, janelaMs) {
  const r = await um(env.EPIGE_DB, 'SELECT COUNT(*) AS n FROM tentativas WHERE chave = ? AND em > ?', chave, agora() - janelaMs);
  return r?.n ?? 0;
}

export async function registrarTentativa(env, ...chaves) {
  const t = agora();
  await env.EPIGE_DB.batch([
    ...chaves.map((c) => env.EPIGE_DB.prepare('INSERT INTO tentativas (chave, em) VALUES (?, ?)').bind(c, t)),
    // Faxina: nada de tentativa com mais de um dia fica guardada.
    env.EPIGE_DB.prepare('DELETE FROM tentativas WHERE em < ?').bind(t - 86_400_000),
  ]);
}

export const limparTentativas = (env, chave) => executar(env.EPIGE_DB, 'DELETE FROM tentativas WHERE chave = ?', chave);
