import React, { useState, useMemo, useEffect } from 'react';
import {
  Info, Droplet, Beef, Salad, Calculator, Clock, Zap, Moon, Flame, Search, Minus, Plus, ChevronDown,
  Check, X, CircleHelp,
} from 'lucide-react';
import { useApp } from '../contexto';
import { Card, Btn, Sheet, Field, NumeroInput, Stepper } from '../components/UI';
import Guia from '../components/Guia';
import { Vitrine } from '../components/Plano';
import { podeVer } from '../lib/plano';
import { contasDaNutricao, ALIMENTOS_PROTEINA, paraFechar } from '../lib/nutricao';
import { hoje } from '../lib/utils';

/* ============================================================
   COMBUSTÍVEL PRO JIU-JITSU

   Três coisas com valor de verdade, todas pelo peso da pessoa:
   quanto comer (a calculadora), se bateu a proteína hoje (o
   contador de comida brasileira) e o que vale e o que não vale de
   suplemento. Em volta do treino, comida de verdade com receita no
   YouTube. As contas moram em src/lib/nutricao.js.
   ============================================================ */

const receita = (nome) => `https://www.youtube.com/results?search_query=${encodeURIComponent(`receita ${nome} fit`)}`;

const EM_VOLTA_DO_TREINO = [
  { quando: 'Almoço ou jantar', hora: '3 horas antes', icone: Clock,
    diz: 'Prato de sempre, com pouca fritura: gordura demora pra sair do estômago.',
    opcoes: ['Arroz, feijão e frango', 'Macarrão com carne moída', 'Batata-doce com ovo'] },
  { quando: 'Lanche', hora: '30 a 60 min antes', icone: Zap,
    diz: 'Leve e rápido de digerir, pra ter gás sem subir no estômago no rola.',
    opcoes: ['Banana com mel', 'Tapioca com banana', 'Pão francês com geleia'] },
  { quando: 'Pós-treino', hora: 'até 1 hora depois', icone: Flame,
    diz: 'Carboidrato e proteína juntos: repõe o gás e começa a consertar o músculo.',
    opcoes: ['Vitamina de banana com aveia', 'Sanduíche de frango', 'Iogurte com granola'] },
  { quando: 'Antes de dormir', hora: 'se bater fome', icone: Moon,
    diz: 'Proteína que digere devagar ajuda a recuperar enquanto você dorme.',
    opcoes: ['Iogurte ou kefir', 'Omelete', 'Copo de leite'] },
];

export default function Nutricao() {
  const { settings, salvarSettings, acesso, irPara } = useApp();
  const [duvidas, setDuvidas] = useState(false);
  const livre = podeVer(acesso, 'nutricao');
  const treinosSemana = Number(settings.metaSemanal) || 3;
  const contas = useMemo(() => contasDaNutricao(settings.pesoKg, treinosSemana), [settings.pesoKg, treinosSemana]);

  const calculadora = (
    <Calculadora
      contas={contas} settings={settings} treinosSemana={treinosSemana}
      onPeso={(v) => salvarSettings({ pesoKg: v })}
      onTreinos={(v) => salvarSettings({ metaSemanal: v })}
      podeEditar={livre}
    />
  );

  if (!livre) {
    return (
      <div className="page">
        <div className="page-head"><div><h1 className="h-page">Combustível pro jiu-jitsu</h1></div></div>
        {!contas && (
          <Card style={{ marginBottom: 14 }}>
            <Field label="Qual o seu peso? (kg)" hint="O app faz a conta de proteína, carboidrato e água pra você.">
              <NumeroInput valor={settings.pesoKg} onChange={(v) => salvarSettings({ pesoKg: v })} />
            </Field>
          </Card>
        )}
        <Vitrine
          recurso="nutricao"
          fundo={calculadora}
          titulo="Quanto comer pro seu corpo aguentar o tatame, calculado pelo seu peso"
          texto={contas
            ? `Com os seus ${String(contas.peso).replace('.', ',')} kg, o app já fez a conta: quanto de proteína pra reconstruir o que o rola quebra, quanto de carboidrato pra ter gás até o último minuto e quanta água pra não apagar no terceiro round. E todo dia você confere se bateu a proteína, com a comida que já tem em casa.`
            : 'Coloque o seu peso e o app faz a conta: quanto de proteína pra reconstruir o que o rola quebra, quanto de carboidrato pra ter gás até o último minuto e quanta água pra não apagar no terceiro round.'}
          itens={[
            'Proteína, carboidrato, água e cafeína pelo seu peso e pela sua semana de tatame',
            'Bateu a proteína hoje? Toca no que comeu e o app diz quanto falta e o que comer',
            'O que comer antes e depois do treino, com receita pronta no YouTube',
            'Suplementação com estudo: creatina, beta-alanina, cafeína pelo seu peso, e o que é só propaganda',
          ]}
          onAssinar={() => irPara('ajustes')}
        />
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-head">
        <div><h1 className="h-page">Combustível pro jiu-jitsu</h1></div>
        <Btn icon={Info} onClick={() => setDuvidas(true)}>Dúvidas</Btn>
      </div>

      {calculadora}
      {contas && <ProteinaDeHoje meta={contas.proteina.min} />}
      <EmVoltaDoTreino contas={contas} />
      <Suplementos contas={contas} />

      <p className="micro muted" style={{ lineHeight: 1.6 }}>
        As contas seguem as recomendações de nutrição esportiva pra esporte de combate e servem pra quem é saudável.
        Tem condição de saúde, é menor de idade ou vai cortar peso pra competir? Fala com um nutricionista antes.
      </p>

      <Sheet aberto={duvidas} onClose={() => setDuvidas(false)} titulo="Combustível pro jiu-jitsu" wide>
        <Duvidas />
      </Sheet>
    </div>
  );
}

/* ============================================================
   BATEU A PROTEÍNA HOJE?

   Toca no que comeu, vê quanto falta. Fica guardado neste
   aparelho só até a meia-noite: é conta do dia, não histórico.
   ============================================================ */
function ProteinaDeHoje({ meta }) {
  const chave = `proteina:${hoje()}`;
  const [comi, setComi] = useState(() => { try { return JSON.parse(localStorage.getItem(chave) || '{}'); } catch { return {}; } });
  useEffect(() => { try { localStorage.setItem(chave, JSON.stringify(comi)); } catch { /* sem armazenamento: vale até fechar */ } }, [chave, comi]);

  const total = ALIMENTOS_PROTEINA.reduce((a, x) => a + (comi[x.id] || 0) * x.g, 0);
  const pct = Math.min(100, Math.round((total / meta) * 100));
  const mudar = (id, passo) => setComi((c) => ({ ...c, [id]: Math.max(0, (c[id] || 0) + passo) }));

  return (
    <Card style={{ marginBottom: 14 }}>
      <div className="card-head">
        <div>
          <div className="eyebrow">Toca no que você comeu hoje</div>
          <h2 className="h-sec">Bateu a proteína hoje?</h2>
        </div>
      </div>

      <div className="nutri-meta">
        <div className="row" style={{ alignItems: 'baseline', gap: 8 }}>
          <span className="nutri-meta-num num" style={{ color: pct >= 100 ? 'var(--jade)' : 'var(--chalk)' }}>{total} g</span>
          <span className="tiny muted">de {meta} g</span>
        </div>
        <div className="bar"><i style={{ width: `${pct}%`, background: pct >= 100 ? 'var(--jade)' : 'var(--blood)' }} /></div>
        <p className="tiny" style={{ lineHeight: 1.55 }}>{paraFechar(meta - total)}</p>
      </div>

      <div className="nutri-comidas">
        {ALIMENTOS_PROTEINA.map((a) => {
          const n = comi[a.id] || 0;
          return (
            <div key={a.id} className={`nutri-comida${n ? ' on' : ''}`}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="tiny" style={{ fontWeight: 700 }}>{a.nome}</div>
                <div className="micro muted">{a.porcao} · {a.g} g</div>
              </div>
              {n > 0 && (
                <button type="button" className="nutri-mais" onClick={() => mudar(a.id, -1)} aria-label={`Tirar ${a.nome}`}><Minus size={15} /></button>
              )}
              {n > 0 && <span className="num tiny" style={{ minWidth: 18, textAlign: 'center', fontWeight: 700 }}>{n}</span>}
              <button type="button" className="nutri-mais" onClick={() => mudar(a.id, 1)} aria-label={`Mais ${a.nome}`}><Plus size={15} /></button>
            </div>
          );
        })}
      </div>
      <p className="micro muted" style={{ marginTop: 10 }}>Valores aproximados, pela tabela brasileira de alimentos. Zera à meia-noite.</p>
    </Card>
  );
}

/* ---------- em volta do treino: comida de verdade, receita no YouTube ---------- */
function EmVoltaDoTreino({ contas }) {
  return (
    <Card style={{ marginBottom: 14 }}>
      <div className="card-head">
        <div>
          <div className="eyebrow">Comida de verdade, sem mistério</div>
          <h2 className="h-sec">O prato em volta do treino</h2>
        </div>
      </div>
      <div className="col" style={{ gap: 10 }}>
        {EM_VOLTA_DO_TREINO.map((m) => {
          const I = m.icone;
          return (
            <div key={m.quando} className="nutri-momento">
              <div className="row" style={{ gap: 10 }}>
                <span className="stat-ico"><I size={15} /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="tiny" style={{ fontWeight: 700 }}>{m.quando}</div>
                  <div className="micro" style={{ color: 'var(--accent)', fontWeight: 700 }}>{m.hora}</div>
                </div>
              </div>
              <p className="micro muted" style={{ lineHeight: 1.55 }}>{m.diz}</p>
              <div className="row wrap" style={{ gap: 6 }}>
                {m.opcoes.map((o) => (
                  <button key={o} type="button" className="chip" onClick={() => window.open(receita(o), '_blank', 'noopener')}>
                    <Search size={12} /> {o}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <p className="micro muted" style={{ marginTop: 10, lineHeight: 1.6 }}>
        Toque numa opção pra ver a receita no YouTube.
        {contas && ` Pro seu peso, o pós-treino ideal tem uns ${contas.posTreino.carbo[0]} a ${contas.posTreino.carbo[1]} g de carboidrato e ${contas.posTreino.proteina[0]} a ${contas.posTreino.proteina[1]} g de proteína.`}
      </p>
    </Card>
  );
}

/* ============================================================
   SUPLEMENTAÇÃO: O QUE VALE

   Veredito na frente, e quem quiser abre o que a ciência diz, com
   a fonte. Nada de "turbina", "explode" ou promessa: o que tem
   estudo, a dose pelo peso e o que é só propaganda.
   ============================================================ */
function Suplementos({ contas }) {
  const [aberto, setAberto] = useState('creatina');
  const cafe = contas?.cafeina;
  const lista = [
    { id: 'creatina', nome: 'Creatina', nota: 'vale', dose: '3 a 5 g por dia, todo dia, sem fase de carga',
      resumo: 'O suplemento mais estudado do esporte, e o que mais combina com jiu-jitsu.',
      ciencia: [
        'Mais força e mais potência, e ajuda a aguentar treino pesado com recuperação melhor entre um treino e outro.',
        'Também é combustível pro cérebro: uma meta-análise de 2024 viu memória, atenção e rapidez de raciocínio melhores com creatina.',
        'Protege o raciocínio depois de uma noite mal dormida, que é a noite antes de quase todo treino cedo.',
        'Segura nas doses recomendadas e não precisa ciclar. Atenção pra quem compete: ela segura um pouco de água no músculo, e a balança sobe perto de 1 kg.',
      ],
      fonte: 'ISSN (posição sobre creatina) e meta-análise na Frontiers in Nutrition, 2024' },
    { id: 'betaalanina', nome: 'Beta-alanina', nota: 'vale', dose: '4 a 6 g por dia, divididos em doses de 1,6 g, por pelo menos 4 semanas',
      resumo: 'Pra quem rola forte ou compete: segura o braço queimando no fim do round.',
      ciencia: [
        'Aumenta a carnosina no músculo, que segura a acidez do esforço forte.',
        'O efeito aparece mais em esforços de 1 a 4 minutos, que é o tamanho de um rola.',
        'Leva de 2 a 4 semanas pra fazer efeito: não adianta tomar só no dia da luta.',
        'O formigamento na pele é normal e sem perigo. Dividir a dose em 1,6 g diminui.',
      ],
      fonte: 'ISSN (posição sobre beta-alanina)' },
    { id: 'cafeina', nome: 'Cafeína', nota: 'vale',
      dose: cafe ? `uns ${cafe.mg} mg, 1 hora antes (${cafe.xicaras} ${cafe.xicaras === 1 ? 'xícara' : 'xícaras'} de café coado)` : '3 mg por kg, 1 hora antes',
      resumo: 'Mais força e mais fôlego no treino pesado, com o café que você já toma.',
      ciencia: [
        'De 3 a 6 mg por kg melhora força, velocidade e resistência; começa pela menor dose.',
        'Mais que 9 mg por kg só aumenta tremedeira e taquicardia, sem ganho nenhum.',
        'Depois das 16h atrapalha o sono, e sono ruim cobra mais do que o café entrega.',
      ],
      fonte: 'ISSN (posição sobre cafeína)' },
    { id: 'whey', nome: 'Whey', nota: 'depende', dose: '1 scoop quando não der pra bater a proteína com comida',
      resumo: 'É só proteína em pó, prática. Não faz nada que um filé de frango não faça.',
      ciencia: ['O que importa é a proteína do dia inteiro. O whey só é o jeito mais rápido de fechar a conta.'],
      fonte: 'ISSN (posição sobre proteína)' },
    { id: 'kefir', nome: 'Kefir e probióticos', nota: 'depende', dose: '1 copo de kefir por dia',
      resumo: 'Bom hábito pro intestino, não milagre.',
      ciencia: [
        'Nos estudos com atletas: menos problema de estômago e menos gripe na época de treino pesado.',
        'Em jogadoras de futebol, o kefir aumentou as bactérias boas do intestino.',
      ],
      fonte: 'ISSN (posição sobre probióticos) e ensaio com jogadoras de futebol, 2025' },
    { id: 'bcaa', nome: 'BCAA', nota: 'nao', dose: 'não precisa',
      resumo: 'Se você bate a proteína do dia, o BCAA já veio junto. É pagar duas vezes pela mesma coisa.',
      ciencia: ['Os aminoácidos do BCAA já estão em qualquer proteína completa: carne, ovo, leite, whey.'],
      fonte: 'ISSN (posição sobre proteína)' },
    { id: 'termogenico', nome: 'Termogênico', nota: 'nao', dose: 'não vale',
      resumo: 'O que emagrece é o prato. O termogênico acelera o coração e atrapalha o sono.',
      ciencia: ['A maioria é cafeína cara com outros estimulantes. O café resolve a parte que funciona, pagando bem menos.'],
      fonte: 'ISSN (posição sobre cafeína)' },
  ];
  const ICONE = { vale: Check, depende: CircleHelp, nao: X };
  const ROTULO = { vale: 'Vale', depende: 'Depende', nao: 'Não vale' };
  return (
    <Card style={{ marginBottom: 14 }}>
      <div className="card-head">
        <div>
          <div className="eyebrow">Sem propaganda, com estudo</div>
          <h2 className="h-sec">Suplementação: o que vale</h2>
        </div>
      </div>
      <div className="col" style={{ gap: 8 }}>
        {lista.map((s) => {
          const I = ICONE[s.nota];
          const on = aberto === s.id;
          return (
            <div key={s.id} className={`nutri-supl ${s.nota}`}>
              <button type="button" className="nutri-supl-cab" onClick={() => setAberto(on ? null : s.id)} aria-expanded={on}>
                <span className="nutri-supl-selo"><I size={13} /> {ROTULO[s.nota]}</span>
                <span className="tiny" style={{ fontWeight: 700, flex: 1, textAlign: 'left' }}>{s.nome}</span>
                <ChevronDown size={17} className="muted" style={{ transform: on ? 'rotate(180deg)' : undefined, transition: 'transform .2s' }} />
              </button>
              <div className="micro" style={{ fontWeight: 600 }}>{s.dose}</div>
              <p className="micro muted" style={{ lineHeight: 1.55 }}>{s.resumo}</p>
              {on && (
                <div className="nutri-ciencia">
                  <div className="micro" style={{ fontWeight: 700, color: 'var(--cor)' }}>O que a ciência diz</div>
                  <ul>
                    {s.ciencia.map((c) => <li key={c} className="micro">{c}</li>)}
                  </ul>
                  <div className="micro muted">Fonte: {s.fonte}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ---------- a calculadora: peso e semana entram, as contas saem ---------- */
function Calculadora({ contas, settings, treinosSemana, onPeso, onTreinos, podeEditar }) {
  return (
    <Card className="accent" style={{ marginBottom: 14 }}>
      <div className="card-head">
        <div>
          <div className="eyebrow row" style={{ gap: 6 }}><Calculator size={13} /> Feito pro seu corpo</div>
          <h2 className="h-sec">Quanto você precisa por dia</h2>
        </div>
      </div>

      {podeEditar && (
        <div className="grid g2" style={{ gap: 10, marginBottom: 14 }}>
          <Field label="Seu peso (kg)"><NumeroInput valor={settings.pesoKg} onChange={onPeso} /></Field>
          <Field label="Treinos por semana"><Stepper value={treinosSemana} onChange={onTreinos} min={1} max={14} /></Field>
        </div>
      )}

      {!contas ? (
        <p className="tiny muted">Coloque o seu peso pra ver a conta.</p>
      ) : (
        <div className="nutri-grade">
          <Numero icone={Beef} tom="blood" rotulo="Proteína" valor={`${contas.proteina.min} a ${contas.proteina.max} g`} conta={contas.proteina.conta} texto={contas.proteina.exemplo} />
          <Numero icone={Zap} tom="accent" rotulo="Carboidrato" valor={`${contas.carboidrato.min} a ${contas.carboidrato.max} g`} conta={contas.carboidrato.conta} texto={contas.carboidrato.porque} />
          <Numero icone={Droplet} tom="ice" rotulo="Água" valor={`${contas.agua.litros} L`} conta={`${String(contas.peso).replace('.', ',')} kg × 35 ml, fora o treino`}
            texto={`Mais uns ${contas.agua.antes[0]} a ${contas.agua.antes[1]} ml nas 4 horas antes do treino. Perder ${contas.agua.limite2} kg de suor (2% do seu peso) já derruba o gás.`} />
        </div>
      )}
    </Card>
  );
}

function Numero({ icone: Icone, tom, rotulo, valor, conta, texto }) {
  return (
    <div className={`nutri-num ${tom}`}>
      <span className="nutri-num-rot"><Icone size={15} /> {rotulo}</span>
      <span className="nutri-num-val num">{valor}</span>
      <span className="nutri-num-conta">{conta}</span>
      <p className="micro muted" style={{ lineHeight: 1.55 }}>{texto}</p>
    </div>
  );
}

function Duvidas() {
  return (
    <Guia topicos={[
      { id: 'caloria', icone: Calculator, titulo: 'Preciso contar caloria?', resumo: 'Não. O prato em três partes e as contas daqui resolvem',
        conteudo: <p>Contar ao grama exige uns cinco minutos todo dia e quase ninguém mantém. Bater a proteína e não fugir do carboidrato em dia de treino já muda o jogo.</p> },
      { id: 'jejum', icone: Clock, titulo: 'Posso treinar em jejum?', resumo: 'Pode, mas o gás cai e o risco de lesão sobe',
        conteudo: <p>Se o treino é cedo, uma banana ou um pão meia hora antes já resolve. Jejum longo e rola forte não combinam.</p> },
      { id: 'peso', icone: Flame, titulo: 'Vou emagrecer treinando?', resumo: 'Quem decide é o prato, não o treino',
        conteudo: <p>Rolar gasta bastante e dá fome, então é comum compensar sem perceber. Pra perder peso, o caminho é a proteína lá em cima e um pouco menos de carboidrato nos dias sem treino, não cortar comida no dia de rola.</p> },
      { id: 'escorregar', icone: Salad, titulo: 'Escorreguei no fim de semana', resumo: 'Faz parte e não estraga nada',
        conteudo: <p>O que conta é o que você faz na maioria das refeições. Oitenta por cento do tempo bem feito, por anos, ganha de cem por cento por três semanas.</p> },
    ]} />
  );
}
