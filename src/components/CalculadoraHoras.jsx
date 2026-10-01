import React, { useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { useApp } from '../contexto';
import { Sheet, Btn, Chip, Stepper, NumeroInput, Seg, useToast } from './UI';
import { horasPeloRitmo, ritmoPelasHoras, ritmoSemanal } from '../lib/metas';
import { padraoDoTipo } from '../lib/padraoTreino';
import { hoje } from '../lib/utils';

/* ============================================================
   CALCULADORA: TREINOS POR SEMANA × HORAS NO ANO

   Nos dois sentidos, sempre de hoje até 31/12: quem entra no meio
   do ano tem uma conta do tamanho do ano que sobra, não de janeiro.
   - pelo ritmo: quantos treinos por semana e quanto dura um treino
     viram quantas horas até o fim do ano;
   - pelas horas: quantas horas a pessoa quer, e quantos treinos por
     semana isso pede, com o selo de coerência (no seu ritmo, puxado,
     não fecha) e uma sugestão quando não fecha.
   É clareza, não diagnóstico: grátis pra todo mundo.
   ============================================================ */
const SELO = {
  ritmo: { nome: 'no seu ritmo', tom: 'jade' },
  puxado: { nome: 'puxado', tom: 'warn' },
  naoFecha: { nome: 'não fecha', tom: 'blood' },
};
const duracaoTexto = (min) => (min % 60 ? `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}` : `${min / 60}h`);

export default function CalculadoraHoras({ aberto, onClose }) {
  const { settings, salvarSettings, goals, sessions } = useApp();
  const toast = useToast();
  const hj = hoje();
  const ano = hj.slice(0, 4);
  const ritmo = ritmoSemanal(settings, goals || []) || 3;
  const duracaoPadrao = Number(padraoDoTipo(settings, 'gi').duracao) || 90;
  const jaFeitas = useMemo(() => Math.round((sessions || [])
    .filter((s) => String(s.data || '').startsWith(ano))
    .reduce((a, s) => a + (Number(s.duracao) || 0), 0) / 60), [sessions, ano]);

  const [modo, setModo] = useState('ritmo');
  const [freq, setFreq] = useState(ritmo);
  const [duracao, setDuracao] = useState(duracaoPadrao);
  const [horas, setHoras] = useState(Number(settings.metaAnualHoras) || 100);

  const pelo = horasPeloRitmo({ frequencia: freq, duracaoMin: duracao, desde: hj });
  const pelas = ritmoPelasHoras({ horas, duracaoMin: duracao, desde: hj, jaFeitas, ritmoAtual: ritmo });
  /* quando não fecha: o que cabe no ritmo de hoje, e o ano que vem inteiro */
  const noRitmo = horasPeloRitmo({ frequencia: ritmo, duracaoMin: duracao, desde: hj });
  const anoQueVem = horasPeloRitmo({ frequencia: ritmo, duracaoMin: duracao, desde: `${Number(ano) + 1}-01-01` });

  const usarRitmo = () => {
    salvarSettings({ metaSemanal: freq, duracaoTreinoPadrao: duracao, metaAnualHorasModo: 'derivada' });
    toast(`Meta: ${freq}x por semana, ≈ ${pelo.horas}h até 31/12`);
    onClose();
  };
  const usarHoras = (h) => {
    salvarSettings({ metaAnualHoras: h, metaAnualHorasModo: 'manual' });
    toast(`Meta: ${h}h até 31/12`);
    onClose();
  };

  return (
    <Sheet aberto={aberto} onClose={onClose} titulo="Calculadora de horas" subtitulo={`de hoje até 31/12/${ano}`}>
      <Seg value={modo} onChange={setModo} options={[
        { id: 'ritmo', nome: 'Pelo ritmo' },
        { id: 'horas', nome: 'Pelas horas' },
      ]} />

      <div className="row wrap" style={{ gap: 12 }}>
        {modo === 'ritmo' && (
          <div className="col" style={{ gap: 6, flex: 1, minWidth: 140 }}>
            <span className="label">Treinos por semana</span>
            <Stepper value={freq} onChange={setFreq} min={1} max={7} />
          </div>
        )}
        {modo === 'horas' && (
          <div className="col" style={{ gap: 6, flex: 1, minWidth: 140 }}>
            <span className="label">Horas até 31/12</span>
            <NumeroInput valor={horas} onChange={(v) => setHoras(Number(v) || 0)} />
          </div>
        )}
        <div className="col" style={{ gap: 6, flex: 1, minWidth: 140 }}>
          <span className="label">Duração de 1 treino</span>
          <Stepper value={duracao} onChange={setDuracao} min={30} max={180} step={15} suffix=" min" />
        </div>
      </div>

      {modo === 'ritmo' ? (
        <div className="calc-resultado">
          <div className="calc-numero num">≈ {pelo.horas}h</div>
          <p className="tiny muted">
            {freq}x por semana de {duracaoTexto(duracao)}, nas {pelo.semanas} semanas que faltam: <b>{pelo.treinos} treinos</b> até 31/12.
            {jaFeitas > 0 && ` Somando as ${jaFeitas}h que você já fez neste ano, fecha ${ano} com ≈ ${jaFeitas + pelo.horas}h.`}
          </p>
          <Btn variant="primary" icon={Check} onClick={usarRitmo} style={{ width: '100%' }}>Usar {freq}x por semana</Btn>
        </div>
      ) : (
        <div className="calc-resultado">
          <div className="row" style={{ gap: 10, alignItems: 'baseline' }}>
            <div className="calc-numero num">{pelas.faltam === 0 ? 'Batida' : Number.isFinite(pelas.porSemana) ? `${String(pelas.porSemana).replace('.', ',')}x` : 'sem prazo'}</div>
            <Chip tone={SELO[pelas.selo].tom}>{SELO[pelas.selo].nome}</Chip>
          </div>
          <p className="tiny muted">
            {pelas.faltam === 0
              ? `Você já fez ${jaFeitas}h neste ano: essa meta está batida.`
              : `por semana, de ${duracaoTexto(duracao)}. Faltam ${pelas.faltam}h (${pelas.treinos} treinos) em ${pelas.semanas} semanas${jaFeitas > 0 ? `, descontando as ${jaFeitas}h que você já fez` : ''}.`}
          </p>
          {pelas.selo === 'naoFecha' && (
            <div className="valida atencao">
              <div className="micro" style={{ lineHeight: 1.6 }}>
                No seu ritmo de {ritmo}x por semana, cabem <b>≈ {jaFeitas + noRitmo.horas}h</b> até 31/12.
                {pelas.semanas < 5 && <> Ou mire <b>{Number(ano) + 1} inteiro</b>: {ritmo}x por semana dá ≈ {anoQueVem.horas}h.</>}
              </div>
            </div>
          )}
          <div className="row wrap" style={{ gap: 8 }}>
            {pelas.selo === 'naoFecha'
              ? <Btn variant="primary" icon={Check} onClick={() => usarHoras(jaFeitas + noRitmo.horas)} style={{ flex: 1 }}>Usar {jaFeitas + noRitmo.horas}h</Btn>
              : <Btn variant="primary" icon={Check} onClick={() => usarHoras(horas)} style={{ flex: 1 }}>Usar {horas}h como meta</Btn>}
          </div>
        </div>
      )}
    </Sheet>
  );
}
