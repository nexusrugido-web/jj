import React, { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Swords, Shirt, Repeat, Users, GraduationCap, Trophy, Medal, CalendarClock } from 'lucide-react';
import { db } from '../db/db';
import { placarDaRola } from '../lib/game';
import { resumoDeCompeticoes } from '../lib/competicao';
import { fmtDur, diasEntre, hoje, fmtData } from '../lib/utils';

/* ============================================================
   CADA TIPO DE TREINO COM A SUA TELA

   Quem filtra por Drill quer saber o que drillou; por Open mat, com
   quem rolou; por Aula privada, com quem aprendeu e o quê; por
   Competição, as medalhas. O mesmo cartão, com os números que
   importam pra cada tipo e a cor dele.
   ============================================================ */
const TEMA = {
  gi: { nome: 'Treino de kimono', cor: 'var(--accent)', icone: Shirt, frase: 'O jogo de pegada, lapela e paciência.' },
  nogi: { nome: 'Sem kimono', cor: 'var(--ice)', icone: Swords, frase: 'Menos pegada, mais ritmo e controle de corpo.' },
  drill: { nome: 'Drill', cor: 'var(--jade)', icone: Repeat, frase: 'Repetição com o parceiro colaborando: é aqui que a técnica vira reflexo.' },
  openmat: { nome: 'Open mat', cor: 'var(--roar)', icone: Users, frase: 'Rola livre, sem aula: o teste do que já entrou.' },
  privada: { nome: 'Aula privada', cor: '#a78bfa', icone: GraduationCap, frase: 'A aula feita pro seu jogo.' },
  competicao: { nome: 'Competição', cor: '#e3b04b', icone: Trophy, frase: 'O dia em que o treino encontra o árbitro.' },
};

const contarNomes = (lista) => {
  const m = new Map();
  for (const n of lista) if (n) m.set(n, (m.get(n) || 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
};

export default function ResumoDoTipo({ tipo, lista, rolasPorSessao, partners, professores = [] }) {
  const tema = TEMA[tipo];
  const metasCamp = useLiveQuery(() => db.goals.where('status').equals('ativa')
    .filter((g) => g.tipo === 'competicao').toArray(), [], []) || [];

  const r = useMemo(() => {
    const rs = lista.flatMap((s) => rolasPorSessao.get(s.id) || []);
    const placares = rs.map(placarDaRola);
    const v = placares.filter((p) => p.ganhou).length;
    const d = placares.filter((p) => p.perdeu).length;
    const minutos = lista.reduce((a, s) => a + (Number(s.duracao) || 0), 0);
    const tecnicas = contarNomes(lista.flatMap((s) => [...(s.focoTecnicas || []).map((f) => f.nome), ...(s.tecnicasDoDia || [])]));
    const parceiros = contarNomes(rs.map((x) => x.partnerId).filter(Boolean));
    const nomeParceiro = new Map(partners.map((p) => [p.id, p.nome]));
    const nomeProf = new Map(professores.map((p) => [p.id, p.nome]));
    const profs = contarNomes(lista.map((s) => nomeProf.get(s.professorId) || s.professor));
    const subs = contarNomes(rs.flatMap((x) => x.subsAplicadas || []));
    const medalhas = { ouro: 0, prata: 0, bronze: 0 };
    for (const s of lista) if (medalhas[s.competicao?.resultado] != null) medalhas[s.competicao.resultado]++;
    return {
      treinos: lista.length, horas: fmtDur(minutos), rolas: rs.length, v, d, e: rs.length - v - d,
      taxa: rs.length ? Math.round((v / rs.length) * 100) : null,
      fin: rs.reduce((a, x) => a + (x.subsAplicadas || []).length, 0),
      tecnicas, parceiros: parceiros.map(([id, n]) => [nomeParceiro.get(id) || 'Parceiro', n]),
      profs, subs, medalhas,
      /* o campeonato antigo, migrado, guarda as lutas só como número */
      comp: resumoDeCompeticoes(lista, rolasPorSessao),
    };
  }, [lista, rolasPorSessao, partners, professores]);

  if (!tema || !lista.length) return null;
  const I = tema.icone;

  const numeros = {
    gi: [['rolas', r.rolas], ['de vitória', r.taxa != null ? `${r.taxa}%` : '·'], ['finalizações', r.fin], ['no tatame', r.horas]],
    nogi: [['rolas', r.rolas], ['de vitória', r.taxa != null ? `${r.taxa}%` : '·'], ['finalizações', r.fin], ['no tatame', r.horas]],
    drill: [['treinos', r.treinos], ['no tatame', r.horas], ['técnicas', r.tecnicas.length], ['repetições', r.tecnicas.reduce((a, [, n]) => a + n, 0)]],
    openmat: [['rolas', r.rolas], ['parceiros', r.parceiros.length], ['de vitória', r.taxa != null ? `${r.taxa}%` : '·'], ['no tatame', r.horas]],
    privada: [['aulas', r.treinos], ['no tatame', r.horas], ['professores', r.profs.length], ['técnicas', r.tecnicas.length]],
    competicao: [['campeonatos', r.comp.campeonatos], ['lutas', r.comp.lutas], ['vitórias', r.comp.vitorias], ['finalizações', r.fin]],
  }[tipo];

  /* o próximo campeonato, da meta: a contagem regressiva aparece aqui */
  const proximo = metasCamp.filter((g) => g.data && g.data >= hoje()).sort((a, b) => a.data.localeCompare(b.data))[0];

  return (
    <div className="tipo-hero" style={{ '--cor': tema.cor }}>
      <div className="row" style={{ gap: 12, alignItems: 'center' }}>
        <span className="tipo-hero-ico"><I size={20} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="tipo-hero-nome">{tema.nome}</div>
          <div className="micro muted" style={{ lineHeight: 1.5 }}>{tema.frase}</div>
        </div>
      </div>

      <div className="tipo-numeros">
        {numeros.map(([rot, val]) => (
          <div key={rot}><b className="num">{val}</b><span>{rot}</span></div>
        ))}
      </div>

      {tipo === 'competicao' && (
        <>
          <div className="podio" style={{ marginTop: 6 }}>
            {[['prata', 2, 'Vice'], ['ouro', 1, 'Campeão'], ['bronze', 3, '3º lugar']].map(([id, lugar, nome]) => (
              <div key={id} className={`podio-lugar p${lugar}`}>
                <span className="podio-avatar">
                  <Medal size={lugar === 1 ? 26 : 22} />
                  <span className="podio-n">{r.medalhas[id]}</span>
                </span>
                <div className="podio-base">
                  <span className="podio-nome">{nome}</span>
                  <span className="podio-pts">{r.medalhas[id]} <small>{r.medalhas[id] === 1 ? 'vez' : 'vezes'}</small></span>
                </div>
              </div>
            ))}
          </div>
          {proximo && (
            <div className="tipo-proximo">
              <CalendarClock size={16} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="tiny" style={{ fontWeight: 700 }}>{proximo.alvo || 'Próximo campeonato'}</div>
                <div className="micro muted">{fmtData(proximo.data)}</div>
              </div>
              <span className="num" style={{ fontWeight: 800, color: 'var(--cor)' }}>
                {diasEntre(hoje(), proximo.data) === 0 ? 'hoje' : `${diasEntre(hoje(), proximo.data)}d`}
              </span>
            </div>
          )}
        </>
      )}

      {(tipo === 'gi' || tipo === 'nogi') && r.subs.length > 0 && (
        <Destaques titulo="Suas armas aqui" itens={r.subs.slice(0, 4)} />
      )}
      {tipo === 'drill' && r.tecnicas.length > 0 && (
        <Destaques titulo="O que você mais drillou" itens={r.tecnicas.slice(0, 5)} />
      )}
      {tipo === 'openmat' && r.parceiros.length > 0 && (
        <Destaques titulo="Com quem você mais rolou" itens={r.parceiros.slice(0, 4)} />
      )}
      {tipo === 'privada' && (r.profs.length > 0 || r.tecnicas.length > 0) && (
        <>
          {r.profs.length > 0 && <Destaques titulo="Com quem" itens={r.profs.slice(0, 3)} />}
          {r.tecnicas.length > 0 && <Destaques titulo="O que você aprendeu" itens={r.tecnicas.slice(0, 5)} />}
        </>
      )}
    </div>
  );
}

/* uma lista curta com barra: o maior enche, o resto na proporção */
function Destaques({ titulo, itens }) {
  const max = Math.max(1, ...itens.map(([, n]) => n));
  return (
    <div className="col" style={{ gap: 7 }}>
      <div className="eyebrow">{titulo}</div>
      {itens.map(([nome, n]) => (
        <div key={nome} className="tipo-destaque">
          <span className="tiny" style={{ fontWeight: 600, minWidth: 0, flex: 1 }}>{nome}</span>
          <span className="tipo-destaque-barra"><i style={{ width: `${(n / max) * 100}%` }} /></span>
          <span className="num micro" style={{ minWidth: 24, textAlign: 'right' }}>{n}×</span>
        </div>
      ))}
    </div>
  );
}
