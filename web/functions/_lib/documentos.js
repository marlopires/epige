/**
 * Controle de documentos — o que a cláusula 7.5 pede de toda norma de sistema de
 * gestão: identificação, análise e aprovação antes de emitir, controle de
 * alteração, versão vigente disponível para quem precisa, obsoleto identificado
 * e retido. A plataforma que ensina 7.5 precisa praticar 7.5.
 *
 * Ciclo de uma versão:
 *   rascunho → em_revisao → vigente → substituida (quando outra vira vigente)
 *        ↑_________| devolver           → obsoleta (documento inteiro cancelado)
 *   rascunho → cancelada (descartar)
 *
 * Um documento tem no máximo uma versão vigente e uma versão aberta (rascunho
 * ou em revisão) ao mesmo tempo. Registro e relatório são evidência: depois de
 * aprovados, não ganham versão nova — corrige-se com outro registro.
 */

import { um } from './banco.js';
import { HttpErro } from './http.js';

export const TIPOS = {
  procedimento: { prefixo: 'PR', rotulo: 'Procedimento' },
  politica: { prefixo: 'PO', rotulo: 'Política' },
  manual: { prefixo: 'MN', rotulo: 'Manual' },
  instrucao: { prefixo: 'IT', rotulo: 'Instrução de trabalho' },
  formulario: { prefixo: 'FR', rotulo: 'Formulário' },
  plano: { prefixo: 'PL', rotulo: 'Plano' },
  relatorio: { prefixo: 'RA', rotulo: 'Relatório de auditoria', registro: true },
  registro: { prefixo: 'RG', rotulo: 'Registro', registro: true },
  outro: { prefixo: 'DOC', rotulo: 'Outro' },
};

export const LIMITE_CONTEUDO = 200_000;

export function tipo(v) {
  if (!TIPOS[v]) throw new HttpErro(400, 'Tipo de documento inválido.');
  return v;
}

export function codigoValido(v) {
  const c = String(v ?? '').trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9.\-]{1,23}$/.test(c)) {
    throw new HttpErro(400, 'Código inválido. Use letras, números, ponto ou hífen (ex.: PR-QUA-001).');
  }
  return c;
}

/** Próximo código livre do tipo, no formato PR-001. */
export async function proximoCodigo(db, orgId, t) {
  const prefixo = TIPOS[t].prefixo;
  const r = await um(
    db,
    `SELECT MAX(CAST(SUBSTR(codigo, ?) AS INTEGER)) AS n FROM documentos
      WHERE org_id = ? AND codigo GLOB ?`,
    prefixo.length + 2, orgId, `${prefixo}-[0-9][0-9][0-9]*`,
  );
  return `${prefixo}-${String((r?.n ?? 0) + 1).padStart(3, '0')}`;
}

/** Normas associadas: lista de ids curtos, guardada como texto separado por vírgula. */
export function normas(v) {
  const lista = Array.isArray(v) ? v : String(v ?? '').split(',');
  return [...new Set(lista.map((x) => String(x).trim()).filter((x) => /^[a-z0-9-]{2,20}$/.test(x)))].slice(0, 12).join(',');
}

export function conteudo(v) {
  const c = String(v ?? '');
  if (c.length > LIMITE_CONTEUDO) throw new HttpErro(413, 'O documento passou do tamanho máximo (200 mil caracteres).');
  if (!c.trim()) throw new HttpErro(400, 'O documento está vazio.');
  return c;
}

/** Carrega o documento da empresa da sessão. Documento de outra empresa é "não encontrado". */
export async function carregar(db, s, id) {
  const d = await um(db, 'SELECT * FROM documentos WHERE id = ? AND org_id = ?', String(id), s.org.id);
  if (!d) throw new HttpErro(404, 'Documento não encontrado.');
  // Leitor só enxerga documento com versão vigente e não obsoleto.
  if (s.usuario.papel === 'leitor' && (d.versao_vigente == null || d.obsoleto)) {
    throw new HttpErro(404, 'Documento não encontrado.');
  }
  return d;
}

export async function versaoAberta(db, d) {
  if (d.versao_aberta == null) return null;
  return um(db, 'SELECT * FROM versoes WHERE documento_id = ? AND numero = ?', d.id, d.versao_aberta);
}

/** Situação do documento, derivada das versões — é o que a lista mostra. */
export function situacao(d, estadoAberta) {
  if (d.obsoleto) return 'obsoleto';
  if (d.versao_vigente != null && estadoAberta) return 'vigente_em_revisao';
  if (d.versao_vigente != null) return 'vigente';
  return estadoAberta === 'em_revisao' ? 'em_revisao' : 'em_elaboracao';
}
