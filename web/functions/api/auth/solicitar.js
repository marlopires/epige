/**
 * "Solicitar acesso" — o cadastro aberto possível enquanto a IA é paga por nós.
 *
 * Cadastro livre ligaria o cartão da API a qualquer visitante. Aqui a pessoa
 * deixa os dados e a administração da plataforma decide: aprovar cria a
 * empresa e gera o convite do administrador dela.
 */

import { json, lerCorpo, obrigatorio, email as lerEmail, texto, ip } from '../../_lib/http.js';
import { um, executar, agora, registrarEvento, contarTentativas, registrarTentativa } from '../../_lib/banco.js';

export async function onRequestPost({ request, env }) {
  const c = await lerCorpo(request, 10_000);
  // Campo-armadilha: invisível para gente, preenchido por robô. Finge sucesso.
  if (texto(c.site, 200)) return json({ ok: true }, 201);

  const chave = `solicitacao:${ip(request)}`;
  if ((await contarTentativas(env, chave, 86_400_000)) >= 5) {
    // Resposta igual à de sucesso: não ensina o robô a contornar o limite.
    return json({ ok: true }, 201);
  }
  const dados = {
    nome: obrigatorio(c.nome, 120, 'Informe o seu nome.'),
    email: lerEmail(c.email),
    empresa: obrigatorio(c.empresa, 120, 'Informe o nome da empresa.'),
    telefone: texto(c.telefone, 40),
    mensagem: texto(c.mensagem, 1000),
  };
  await registrarTentativa(env, chave);
  const pendentes = await um(env.EPIGE_DB, "SELECT COUNT(*) AS n FROM solicitacoes WHERE situacao = 'pendente'");
  if (pendentes.n >= 500) return json({ ok: true }, 201); // enchente: não grava, não avisa
  const id = crypto.randomUUID();
  await executar(
    env.EPIGE_DB,
    'INSERT INTO solicitacoes (id, nome, email, empresa, telefone, mensagem, ip, em) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    id, dados.nome, dados.email, dados.empresa, dados.telefone, dados.mensagem, ip(request), agora(),
  );
  await registrarEvento(env, { acao: 'solicitacao_de_acesso', alvo: id, detalhe: dados.empresa, ip: ip(request) });
  return json({ ok: true }, 201);
}
