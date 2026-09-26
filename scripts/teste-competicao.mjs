import { register } from 'node:module';
register('./como-vite.mjs', import.meta.url);
await import('fake-indexeddb/auto');

/* ============================================================
   O CAMPEONATO QUE JÁ ESTAVA REGISTRADO NÃO PODE SUMIR

   Competição deixou de ser um módulo e virou treino. Quem já
   tinha campeonato guardado abre o app e encontra tudo em
   Treinos, com a medalha, a categoria e o que aprendeu. E
   migrar duas vezes (dois aparelhos, ou abrir o app de novo)
   não pode criar dois treinos do mesmo campeonato.
   ============================================================ */

const { db, migrarCompeticoes } = await import('../src/db/db.js');
const C = await import('../src/lib/competicao.js');

let falhas = 0;
const ok = (nome, real, esperado) => {
  const bom = JSON.stringify(real) === JSON.stringify(esperado);
  if (!bom) falhas++;
  console.log(`${bom ? 'ok   ' : 'FALHA'} ${nome}: ${JSON.stringify(real)}${bom ? '' : ` (esperado ${JSON.stringify(esperado)})`}`);
};

/* ---------- colocação escrita na mão vira resultado ---------- */
ok('ouro, campeão e 1º são a mesma coisa',
  ['Ouro', 'campeão', '1º', '1'].map(C.resultadoDoTexto), ['ouro', 'ouro', 'ouro', 'ouro']);
ok('prata e vice', ['Prata', 'vice', '2º'].map(C.resultadoDoTexto), ['prata', 'prata', 'prata']);
ok('bronze e 3º', ['Bronze', '3º lugar'].map(C.resultadoDoTexto), ['bronze', 'bronze']);
ok('qualquer outra coisa escrita vira sem pódio', C.resultadoDoTexto('caí na primeira'), 'participou');
ok('em branco fica em branco', C.resultadoDoTexto(''), '');
ok('pódio é só até o terceiro', ['ouro', 'prata', 'bronze', 'participou'].map(C.ehPodio), [true, true, true, false]);

/* ---------- a migração ---------- */
await db.open();
await db.competitions.bulkAdd([
  {
    uid: 'comp-1', data: '2026-05-10', evento: 'Copa Bahia', organizacao: 'IBJJF / CBJJ', modalidade: 'gi',
    categoria: 'Pena', peso: '70', lutas: 3, vitorias: 2, derrotas: 1, colocacao: 'Prata',
    metodo: 'pontos', aprendizados: 'preciso puxar pra guarda mais cedo', notas: 'chave com 16', criadoEm: 1,
  },
  { uid: 'comp-2', data: '2026-08-02', evento: 'Open estadual', modalidade: 'nogi', colocacao: 'Ouro', lutas: 2, vitorias: 2, derrotas: 0, criadoEm: 2 },
]);

ok('migrou os dois campeonatos', await migrarCompeticoes(), 2);
ok('a tabela antiga fica vazia', await db.competitions.count(), 0);

const treinos = await db.sessions.orderBy('data').toArray();
ok('viraram treinos do tipo competição', treinos.map((s) => s.tipo), ['competicao', 'competicao']);

const copa = treinos[0];
ok('o campeonato vira o nome do treino', copa.competicao.evento, 'Copa Bahia');
ok('a colocação vira medalha', copa.competicao.resultado, 'prata');
ok('categoria e peso vêm junto', [copa.competicao.categoria, copa.competicao.pesoKg, copa.competicao.modalidade], ['Pena', '70', 'gi']);
ok('as lutas somadas do registro antigo ficam guardadas',
  [copa.competicao.lutas, copa.competicao.vitorias, copa.competicao.derrotas], [3, 2, 1]);
ok('o que aprendeu e as notas viram a anotação da aula',
  copa.nota, 'Aprendi: preciso puxar pra guarda mais cedo\nchave com 16');
ok('sem RPE inventado', copa.rpe, null);

/* ---------- migrar de novo não duplica ---------- */
await db.competitions.bulkAdd([
  { uid: 'comp-1', data: '2026-05-10', evento: 'Copa Bahia', modalidade: 'gi', colocacao: 'Prata', criadoEm: 1 },
]);
ok('o mesmo campeonato não vira um segundo treino', await migrarCompeticoes(), 0);
ok('continua com dois treinos', await db.sessions.count(), 2);
ok('sem campeonato guardado, a migração não faz nada', await migrarCompeticoes(), 0);

/* ---------- o resumo de Treinos filtrado por Competição ---------- */
const rolasPorSessao = new Map([[treinos[1].id, [
  { subsAplicadas: ['Armlock'] }, { resultado: 'venci_pontos' },
]]]);
ok('o resumo conta as lutas registradas e soma as antigas',
  C.resumoDeCompeticoes(treinos, rolasPorSessao), { campeonatos: 2, lutas: 5, vitorias: 4, podios: 2 });
/* finalizou 1 e levou 2: perdeu, mesmo tendo finalizado */
const perdeuMesmoFinalizando = new Map([[treinos[1].id, [
  { v2: 1, subsAplicadas: ['Armlock'], subsSofridas: ['Americana', 'Mata-leão'] },
]]]);
ok('luta com finalização que terminou perdida não conta como vitória',
  C.resumoDeCompeticoes([treinos[1]], perdeuMesmoFinalizando).vitorias, 0);

/* ---------- o pódio da categoria ---------- */
const { EU, resultadoDoPodio, podioComEu, atletasDaChave } = C;
ok('campeão no "Como terminou" põe você no 1º lugar', podioComEu({ prata: 'Rafa', bronze: ['Leo', ''] }, 'ouro'), { ouro: EU, prata: 'Rafa', bronze: ['Leo', ''] });
ok('bronze entra no 3º lugar que está vago', podioComEu({ bronze: ['Leo', ''] }, 'bronze').bronze, ['Leo', EU]);
ok('mudar de vice pra campeão não te deixa em dois lugares', podioComEu({ prata: EU }, 'ouro'), { ouro: EU, prata: '', bronze: ['', ''] });
ok('sem pódio, você sai do pódio', podioComEu({ ouro: EU, prata: 'Rafa' }, 'participou'), { ouro: '', prata: 'Rafa', bronze: ['', ''] });
ok('a colocação sai do pódio', [resultadoDoPodio({ prata: EU }), resultadoDoPodio({ bronze: ['x', EU] }), resultadoDoPodio({ ouro: 'Rafa' })], ['prata', 'bronze', null]);
ok('os nomes dos seus adversários e da chave viram sugestão, sem repetir',
  atletasDaChave([{ a: 'Rafa', b: 'Leo', venceu: 'a' }, { a: 'Rafa', b: 'Caio' }], [{ adversario: 'Duda' }, { adversario: 'Leo' }]),
  ['Duda', 'Leo', 'Rafa', 'Caio']);
ok('"Emilio" e "emílio" são a mesma pessoa', atletasDaChave([{ a: 'emílio', b: 'Paulo' }], [{ adversario: 'Emilio' }]), ['Emilio', 'Paulo']);

/* ---------- o campeonato em etapas ---------- */
const { situacaoDoCampeonato, tempoDaLuta, podioSugerido, colocarNoPodio, lugarNoPodio } = C;
ok('campeonato novo: nada pronto', situacaoDoCampeonato({ competicao: { evento: '', andamento: true } }, []), { campeonato: false, lutas: 0, chave: 0, podio: false });
ok('no meio do dia: campeonato e lutas contam, o pódio ainda não',
  situacaoDoCampeonato({ competicao: { evento: 'Copa', andamento: true, podio: { ouro: 'Rafa' }, chave: [{ a: 'Rafa', b: '' }] } }, [{ adversario: 'Pedro' }, { adversario: ' ' }]),
  { campeonato: true, lutas: 1, chave: 1, podio: false });
ok('categoria acabou: o pódio conta, até sem medalha',
  [situacaoDoCampeonato({ competicao: { evento: 'Copa', andamento: false, resultado: 'participou' } }, []).podio,
    situacaoDoCampeonato({ competicao: { evento: 'Copa', podio: { ouro: EU } } }, []).podio], [true, true]);
ok('tempo oficial: azul adulto 6, preta adulto 10, master 1 roxa 6, master 3 5, juvenil 5, infantil 4',
  [tempoDaLuta('azul', 'adulto'), tempoDaLuta('preta', 'adulto'), tempoDaLuta('roxa', 'master1'), tempoDaLuta('preta', 'master3'), tempoDaLuta('marrom', 'juvenil'), tempoDaLuta('branca', 'infantil')],
  [6, 10, 6, 5, 5, 4]);
const venceu = { v2: 1, subsAplicadas: ['Armlock'] };
ok('venceu todas: sugere você campeão e o último adversário vice',
  podioSugerido([{ ...venceu, adversario: 'Pedro' }, { ...venceu, adversario: 'Emilio' }]), { ouro: EU, prata: 'Emilio', bronze: ['', ''] });
ok('perdeu uma: o app não chuta o pódio', podioSugerido([{ ...venceu, adversario: 'Pedro' }, { v2: 1, subsSofridas: ['Americana'], adversario: 'Emilio' }]), null);
ok('pôr no 1º tira a pessoa do lugar em que estava', colocarNoPodio({ ouro: 'Rafa', prata: 'Leo', bronze: ['', ''] }, 'Leo', 'ouro'), { ouro: 'Leo', prata: '', bronze: ['', ''] });
ok('3º lugar tem duas vagas', colocarNoPodio({ bronze: ['Paulo', ''] }, 'Caio', 'bronze').bronze, ['Paulo', 'Caio']);
ok('a mesma pessoa não ocupa os dois 3º lugares', colocarNoPodio({ bronze: ['Paulo', ''] }, 'paulo', 'bronze').bronze, ['paulo', '']);
ok('tirar do pódio', colocarNoPodio({ ouro: EU, prata: 'Leo' }, 'Leo', null), { ouro: EU, prata: '', bronze: ['', ''] });
ok('o lugar de cada um, sem ligar pra acento', [lugarNoPodio({ prata: 'Emílio' }, 'emilio'), lugarNoPodio({ bronze: ['', EU] }, EU), lugarNoPodio({}, 'Rafa')], ['prata', 'bronze', null]);

/* ---------- o padrão de cada tipo de treino ---------- */
const { padraoDoTipo } = await import('../src/lib/padraoTreino.js');
const ajustes = { academiaPadraoId: 7, professorPadraoId: 3, duracaoTreinoPadrao: 90 };
ok('Gi usa a academia, o professor e a duração de sempre', padraoDoTipo(ajustes, 'gi'), { academiaId: 7, professorId: 3, duracao: 90 });
ok('competição não herda a academia nem o professor', padraoDoTipo(ajustes, 'competicao'), { academiaId: null, professorId: null, duracao: null });
ok('open mat fica na academia, sem professor', padraoDoTipo(ajustes, 'openmat'), { academiaId: 7, professorId: null, duracao: 90 });
ok('o padrão salvo de um tipo vale só pra ele',
  [padraoDoTipo({ ...ajustes, padroesTreino: { drill: { academiaId: 9, professorId: null, duracao: 60 } } }, 'drill').academiaId,
    padraoDoTipo({ ...ajustes, padroesTreino: { drill: { academiaId: 9, professorId: null, duracao: 60 } } }, 'gi').academiaId], [9, 7]);

console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);
