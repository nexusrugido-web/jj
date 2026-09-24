import React, { useState, useMemo } from 'react';
import {
  Info, Droplet, Beef, Wheat, Salad, Calculator, Clock, Zap, Moon, FlaskConical, ShieldAlert, Flame,
} from 'lucide-react';
import { useApp } from '../contexto';
import { Card, Btn, Sheet, Field, NumeroInput, Stepper } from '../components/UI';
import Guia from '../components/Guia';
import { Vitrine } from '../components/Plano';
import { podeVer } from '../lib/plano';
import { contasDaNutricao } from '../lib/nutricao';

/* ============================================================
   COMBUSTÍVEL PRO JIU-JITSU

   Quanto comer, pelo peso e pela semana de tatame de cada um, com
   a conta à vista; o que comer em volta do treino; e o básico que
   deixa o corpo aguentar a rotina (proteína, gás, água, intestino).
   É do premium. As contas moram em src/lib/nutricao.js.
   ============================================================ */

const PRATO = [
  { icone: Salad, cor: 'jade', pct: 50, t: 'Metade de vegetais', d: 'Salada, legume, verdura, à vontade. É o que dá saciedade sem pesar.' },
  { icone: Beef, cor: 'blood', pct: 25, t: 'Um quarto de proteína', d: 'Carne, frango, peixe, ovo, feijão. Do tamanho da palma da sua mão.' },
  { icone: Wheat, cor: 'accent', pct: 25, t: 'Um quarto de carboidrato', d: 'Arroz, macarrão, batata, mandioca. Do tamanho do seu punho fechado.' },
];

const DIA_DE_TREINO = [
  ['3 horas antes', 'Uma refeição de verdade: prato com carboidrato, proteína e pouca gordura, que é a que demora pra sair do estômago.'],
  ['30 minutos antes', 'Se bateu fome ou o treino é cedo: uma banana, um pão com mel. Leve, pra não subir no estômago na hora do rola.'],
  ['Durante', 'Goles de água a cada intervalo. Treino longo e suado (mais de uma hora e meia) pede uma bebida com sal e açúcar.'],
  ['Até 1 hora depois', 'Carboidrato e proteína juntos, que é quando o corpo mais aproveita pra repor o gás e reconstruir o músculo.'],
  ['Antes de dormir', 'Uma fonte de proteína de digestão lenta, como iogurte, kefir ou ovo, ajuda a recuperar durante o sono.'],
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
        {/* sem peso, a vitrine borrava números vazios: primeiro o peso, e aí
            quem vê o convite vê as contas dele mesmo atrás do vidro */}
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
            ? `Com os seus ${String(contas.peso).replace('.', ',')} kg, o app já fez a conta: quanto de proteína pra reconstruir o que o rola quebra, quanto de carboidrato pra ter gás até o último minuto e quanta água pra não apagar no terceiro round. Tudo com a conta à vista, do jeito que a ciência do esporte de combate recomenda.`
            : 'Coloque o seu peso e o app faz a conta: quanto de proteína pra reconstruir o que o rola quebra, quanto de carboidrato pra ter gás até o último minuto e quanta água pra não apagar no terceiro round.'}
          itens={[
            'Proteína, carboidrato e água pelo seu peso e pela sua semana de tatame',
            'O que comer 3 horas antes, 30 minutos antes e logo depois do treino',
            'Intestino, kefir e creatina: o que tem ciência por trás e o que é só propaganda',
            'Como montar o prato sem balança, na marmita ou no restaurante',
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

      <Card style={{ marginBottom: 14 }}>
        <div className="card-head">
          <div>
            <div className="eyebrow">Hora a hora</div>
            <h2 className="h-sec">O seu dia de treino</h2>
          </div>
        </div>
        <ol className="nutri-linha">
          {DIA_DE_TREINO.map(([quando, oque]) => (
            <li key={quando}>
              <span className="nutri-quando">{quando}</span>
              <span className="tiny" style={{ lineHeight: 1.6 }}>{oque}</span>
            </li>
          ))}
        </ol>
        {contas && (
          <p className="micro muted" style={{ marginTop: 12, lineHeight: 1.6 }}>
            Pro seu peso, depois do treino: uns {contas.posTreino.carbo[0]} a {contas.posTreino.carbo[1]} g de carboidrato
            e {contas.posTreino.proteina[0]} a {contas.posTreino.proteina[1]} g de proteína.
          </p>
        )}
      </Card>

      <Card style={{ marginBottom: 14 }}>
        <div className="card-head">
          <div>
            <div className="eyebrow">Sem planilha e sem balança</div>
            <h2 className="h-sec">O prato em três partes</h2>
          </div>
        </div>
        <div className="prato">
          {PRATO.map((p) => {
            const I = p.icone;
            return (
              <div key={p.t} className="prato-fatia" style={{ flex: p.pct }}>
                <span className="prato-ico" style={{ color: `var(--${p.cor})` }}><I size={17} /></span>
                <div className="prato-pct num" style={{ color: `var(--${p.cor})` }}>{p.pct}%</div>
              </div>
            );
          })}
        </div>
        <div className="col" style={{ gap: 11, marginTop: 16 }}>
          {PRATO.map((p) => (
            <div key={p.t} className="row" style={{ gap: 11, alignItems: 'flex-start' }}>
              <span style={{ width: 6, height: 6, borderRadius: 99, background: `var(--${p.cor})`, marginTop: 7, flex: 'none' }} />
              <div>
                <div className="tiny" style={{ fontWeight: 600 }}>{p.t}</div>
                <p className="micro muted" style={{ marginTop: 3, lineHeight: 1.65 }}>{p.d}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="micro muted" style={{ marginTop: 12, lineHeight: 1.65 }}>
          A mão acompanha o tamanho do corpo, então a porção se ajusta sozinha: palma é proteína, punho é carboidrato,
          mão em concha é vegetal e o polegar é gordura. Funciona no restaurante, na casa da sogra e no marmitex.
        </p>
      </Card>

      <Card style={{ marginBottom: 14 }}>
        <div className="card-head">
          <div>
            <div className="eyebrow">O que sustenta a rotina</div>
            <h2 className="h-sec">Um organismo que aguenta o tatame</h2>
          </div>
        </div>
        <OrganismoForte contas={contas} />
      </Card>

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
          <Numero icone={FlaskConical} tom="jade" rotulo="Creatina" valor={contas.creatina} conta="por dia, todo dia, com qualquer refeição"
            texto="É o suplemento com mais estudo por trás: mais força, mais potência e recuperação melhor entre um treino e outro." />
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

function OrganismoForte({ contas }) {
  return (
    <Guia inicial="proteina" topicos={[
      {
        id: 'proteina', icone: Beef, titulo: 'Proteína reconstrói o que o rola quebra', resumo: 'O motivo número um de acordar quebrado é comer pouca',
        conteudo: <p>Cada treino faz microlesões no músculo, e é a proteína que conserta. Quem luta precisa de bem mais que o sedentário{contas ? `: no seu caso, de ${contas.proteina.min} a ${contas.proteina.max} g por dia` : ''}. Espalhar em quatro refeições rende mais do que tudo de uma vez no jantar.</p>,
      },
      {
        id: 'carbo', icone: Zap, titulo: 'Carboidrato é o gás do terceiro minuto', resumo: 'Cortar carboidrato e rolar forte não combinam',
        conteudo: <p>O rola é esforço forte em rajadas, e o combustível dessas rajadas é o glicogênio, que vem do carboidrato. Dieta sem carboidrato deixa o treino pesado e a recuperação lenta. Arroz, batata, mandioca, pão e fruta estão do seu lado.</p>,
      },
      {
        id: 'agua', icone: Droplet, titulo: 'Água antes de sentir sede', resumo: 'Sede já é desidratação começando',
        conteudo: <p>Perder 2% do peso em suor já piora o fôlego e a cabeça, e num treino suado isso acontece em uma hora. Chega hidratado, bebe nos intervalos e repõe depois: uma forma simples de conferir é a cor do xixi, que deve estar clara.</p>,
      },
      {
        id: 'intestino', icone: Salad, titulo: 'Intestino, kefir e imunidade', resumo: 'Ajuda, mas é complemento, não milagre',
        conteudo: (
          <>
            <p>Treino pesado baixa a imunidade por um tempo, e é por isso que quem treina muito vive gripado. Probióticos, como os do kefir (de leite ou de água), mostram nos estudos com atletas menos problema de estômago e menos infecção respiratória, e o kefir aumentou bactérias boas do intestino em jogadoras de futebol.</p>
            <p>Um copo por dia é um bom hábito. Mas nenhum probiótico compensa dormir mal ou comer pouco.</p>
          </>
        ),
      },
      {
        id: 'creatina', icone: FlaskConical, titulo: 'Creatina: o suplemento que vale', resumo: '3 a 5 g por dia, sem precisar de fase de carga',
        conteudo: <p>É o suplemento mais estudado do esporte: mais força e potência, e ajuda a aguentar treino pesado. Toma todo dia, com qualquer refeição, inclusive nos dias sem treino. Whey é só uma forma prática de bater a proteína; comida resolve igual.</p>,
      },
      {
        id: 'sono', icone: Moon, titulo: 'Dormir também é nutrição', resumo: 'É dormindo que o que você comeu vira músculo',
        conteudo: <p>Sete a nove horas por noite. Uma proteína antes de dormir (iogurte, kefir, ovo) ajuda a recuperar durante o sono.</p>,
      },
      {
        id: 'corte', icone: ShieldAlert, titulo: 'Corte de peso pra competir', resumo: 'Nunca no improviso',
        conteudo: <p>Desidratar pra bater a categoria derruba o desempenho e já mandou atleta pro hospital. Se você precisa perder peso pra competir, começa semanas antes e com um nutricionista que entenda de esporte de combate.</p>,
      },
    ]} />
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
