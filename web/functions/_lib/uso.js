/** Gasto de IA — por empresa e no total do dia. Um só lugar, porque chat e painel usam. */

import { um, hoje } from './banco.js';

export const tetoGlobal = (env) => Number(env.TETO_DIARIO_BRL ?? 20);
export const tetoOrg = (env, org) => Number(org.teto_diario_brl ?? env.TETO_ORG_BRL ?? 10);

export async function gastoHoje(env, orgId = null) {
  const r = orgId
    ? await um(env.EPIGE_DB, 'SELECT COALESCE(SUM(custo), 0) AS v FROM chamadas WHERE dia = ? AND org_id = ?', hoje(), orgId)
    : await um(env.EPIGE_DB, 'SELECT COALESCE(SUM(custo), 0) AS v FROM chamadas WHERE dia = ?', hoje());
  return r.v;
}
