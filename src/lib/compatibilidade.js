import {
  resolverNome, comTecUid, uidDoGolpe, nomesDoRola, nomesDoPlano, nomesDaMeta, metaDeTecnica,
} from './identidade';

/* ============================================================
   A PASSADA NOS REGISTROS ANTIGOS (uid ao lado do nome)

   Uma vez por aparelho, como o reparo do S4: só com prova. O nome
   que bate com exatamente uma técnica ganha o uid; ambíguo ou sem
   par fica como está e é contado. Primeiro SIMULA (só os números,
   pro dono aprovar); aplicar devolve os patches, e quem grava é
   quem chama. Rodar de novo não muda nada: o que já tem uid fica.

   Plano pronto (da semente) fica de fora: é conteúdo do app.
   ============================================================ */

const zerado = () => ({ registros: 0, alterados: 0, ligados: 0, jaLigados: 0, ambiguos: 0, semPar: 0 });

/* conta cada nome do registro uma vez */
function contar(n, nomes, tecUidAntes, tecnicas) {
  for (const nome of new Set(nomes.map((x) => String(x || '').trim()).filter(Boolean))) {
    const r = resolverNome(nome, tecnicas);
    if (r.uid && tecUidAntes && r.uid in tecUidAntes) n.jaLigados++;
    else if (r.uid) n.ligados++;
    else if (r.ambiguo) n.ambiguos++;
    else n.semPar++;
  }
}

const mudou = (a, b) => JSON.stringify(a ?? {}) !== JSON.stringify(b ?? {});

export function passadaDeIdentidade({ rolls = [], attackPlans = [], goals = [], techniques = [] } = {}, { simular = true } = {}) {
  const numeros = { rolls: zerado(), attackPlans: zerado(), goals: zerado() };
  const patches = [];
  const anotar = (tabela, id, patch) => { numeros[tabela].alterados++; if (!simular) patches.push({ tabela, id, patch }); };

  for (const r of rolls) {
    const nomes = nomesDoRola(r);
    if (!nomes.length) continue;
    numeros.rolls.registros++;
    contar(numeros.rolls, nomes, r.tecUid, techniques);
    const tecUid = comTecUid(nomes, techniques, r.tecUid);
    if (Object.keys(tecUid).length && mudou(tecUid, r.tecUid)) anotar('rolls', r.id, { tecUid });
  }

  for (const p of attackPlans) {
    if (p?.pronto) continue;
    /* peça de golpe ou situação; finta (e a finta do formato de antes) não entra */
    const pecas = (p.passos || []).filter((x) => x?.tipo !== 'finta' && String(x?.acao || '').trim());
    const nomes = nomesDoPlano(p);
    if (!pecas.length && !nomes.length) continue;
    numeros.attackPlans.registros++;
    const patch = {};
    let pecasMudaram = false;
    const passos = (p.passos || []).map((x) => {
      if (x?.tipo === 'finta' || !String(x?.acao || '').trim()) return x;
      const r = resolverNome(x.acao, techniques);
      const u = uidDoGolpe(x, techniques);
      if (x.golpeUid && u === x.golpeUid) { numeros.attackPlans.jaLigados++; return x; }
      if (u) { numeros.attackPlans.ligados++; pecasMudaram = true; return { ...x, golpeUid: u }; }
      if (r.ambiguo) numeros.attackPlans.ambiguos++; else numeros.attackPlans.semPar++;
      return x;
    });
    if (pecasMudaram) patch.passos = passos;
    contar(numeros.attackPlans, nomes, p.tecUid, techniques);
    const tecUid = comTecUid(nomes, techniques, p.tecUid);
    if (Object.keys(tecUid).length && mudou(tecUid, p.tecUid)) patch.tecUid = tecUid;
    if (Object.keys(patch).length) anotar('attackPlans', p.id, patch);
  }

  for (const g of goals) {
    if (!metaDeTecnica(g)) continue;
    const nomes = nomesDaMeta(g);
    if (!nomes.length) continue;
    numeros.goals.registros++;
    contar(numeros.goals, nomes, g.tecUid, techniques);
    const tecUid = comTecUid(nomes, techniques, g.tecUid);
    if (Object.keys(tecUid).length && mudou(tecUid, g.tecUid)) anotar('goals', g.id, { tecUid });
  }

  return simular ? { numeros } : { numeros, patches };
}
