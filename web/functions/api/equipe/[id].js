/**
 * Alterar papel, desativar, gerar link de nova senha, remover 2FA de alguém da
 * equipe. Três travas: só o admin; só alguém da própria empresa; e a empresa
 * nunca fica sem administrador ativo.
 */

import { json, lerCorpo, papel as lerPapel, HttpErro, ip } from '../../_lib/http.js';
import { um, executar, registrarEvento } from '../../_lib/banco.js';
import { exigir, encerrarTodas } from '../../_lib/sessao.js';
import { criarRedefinicao } from '../../_lib/convites.js';

async function alvo(ctx, s) {
  const u = await um(
    ctx.env.EPIGE_DB,
    'SELECT id, nome, email, papel, ativo, superadmin FROM usuarios WHERE id = ? AND org_id = ?',
    String(ctx.params.id), s.org.id,
  );
  if (!u) throw new HttpErro(404, 'Pessoa não encontrada nesta empresa.');
  if (u.id === s.usuario.id) throw new HttpErro(400, 'Você não pode alterar o próprio acesso por aqui.');
  // Sem esta trava, um admin da mesma empresa do dono da plataforma geraria um
  // link de nova senha para a conta dele e herdaria a administração da plataforma.
  if (u.superadmin && !s.usuario.superadmin) {
    throw new HttpErro(403, 'Esta conta administra a plataforma e só pode ser alterada por ela mesma.');
  }
  return u;
}

async function outrosAdminsAtivos(ctx, s, excetoId) {
  const r = await um(
    ctx.env.EPIGE_DB,
    "SELECT COUNT(*) AS n FROM usuarios WHERE org_id = ? AND papel = 'admin' AND ativo = 1 AND id != ?",
    s.org.id, excetoId,
  );
  return r.n;
}

export async function onRequestPatch(ctx) {
  const s = exigir(ctx, { papeis: ['admin'] });
  const { env, request } = ctx;
  const u = await alvo(ctx, s);
  const c = await lerCorpo(request, 1_000);
  const novoPapel = c.papel === undefined ? u.papel : lerPapel(c.papel);
  const novoAtivo = c.ativo === undefined ? !!u.ativo : !!c.ativo;

  const deixaDeSerAdmin = u.papel === 'admin' && u.ativo && (novoPapel !== 'admin' || !novoAtivo);
  if (deixaDeSerAdmin && (await outrosAdminsAtivos(ctx, s, u.id)) === 0) {
    throw new HttpErro(409, 'A empresa precisa de pelo menos um administrador ativo.');
  }

  await executar(env.EPIGE_DB, 'UPDATE usuarios SET papel = ?, ativo = ? WHERE id = ?', novoPapel, novoAtivo ? 1 : 0, u.id);
  if (!novoAtivo || novoPapel !== u.papel) await encerrarTodas(env, u.id); // novo papel vale já, não no próximo login
  await registrarEvento(env, {
    org: s.org.id, usuario: s.usuario.id, acao: 'acesso_alterado', alvo: u.email,
    detalhe: `papel ${u.papel}→${novoPapel}; ativo ${!!u.ativo}→${novoAtivo}`, ip: ip(request),
  });
  return json({ ok: true });
}

export async function onRequestPost(ctx) {
  const s = exigir(ctx, { papeis: ['admin'] });
  const { env, request } = ctx;
  const u = await alvo(ctx, s);
  const c = await lerCorpo(request, 1_000);

  if (c.acao === 'redefinir_senha') {
    const r = await criarRedefinicao(env, request, { usuarioId: u.id, criadoPor: s.usuario.id });
    await registrarEvento(env, { org: s.org.id, usuario: s.usuario.id, acao: 'redefinicao_gerada', alvo: u.email, ip: ip(request) });
    return json(r, 201);
  }
  if (c.acao === 'remover_2fa') {
    await executar(env.EPIGE_DB, 'UPDATE usuarios SET totp_segredo = NULL, totp_pendente = NULL WHERE id = ?', u.id);
    await encerrarTodas(env, u.id);
    await registrarEvento(env, { org: s.org.id, usuario: s.usuario.id, acao: '2fa_removido_pelo_admin', alvo: u.email, ip: ip(request) });
    return json({ ok: true });
  }
  throw new HttpErro(400, 'Ação desconhecida.');
}
