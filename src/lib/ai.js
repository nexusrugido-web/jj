/* Cliente da IA. A chave NÃO fica aqui, a chamada passa por /api/ia,
   que roda no servidor da Vercel. Em ambiente local sem a function,
   o app avisa e segue funcionando normalmente. */

let disponivel = null;

export async function chamarIA(acao, params = {}) {
  const r = await fetch('/api/ia', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ acao, ...params }),
  });

  let json = null;
  try { json = await r.json(); } catch { /* html de erro */ }

  if (!r.ok) {
    const msg = json?.erro || `Erro ${r.status}`;
    const dica = json?.dica ? ` ${json.dica}` : '';
    throw new Error(msg + dica);
  }
  return json;
}

export async function iaDisponivel() {
  if (disponivel !== null) return disponivel;
  try {
    const r = await fetch('/api/ia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao: '__ping' }),
    });
    // 400 = a function existe e respondeu (ação desconhecida) -> IA ligada
    // 503 = falta a chave
    disponivel = r.status === 400;
  } catch {
    disponivel = false;
  }
  return disponivel;
}

export const autopreencherTecnica = (nome, faixa) => chamarIA('autopreencher', { nome, faixa });
export const validarTecnica = (nome, faixa, modo) => chamarIA('validar_tecnica', { nome, faixa, modo });
export const analisarDiario = (resumo, faixa) => chamarIA('analisar', { resumo, faixa });
