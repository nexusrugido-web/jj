import React, { useMemo, useState } from 'react';
import { ClipboardCheck } from 'lucide-react';
import { useApp } from '../contexto';
import { Sheet, Btn, Field, NumeroInput, Chip } from './UI';
import { Vitrine } from './Plano';
import AntesDeCompetir from './AntesDeCompetir';
import { podeVer, pedirOferta } from '../lib/plano';
import { planoDePeso, retaFinal, KIMONO_KG } from '../lib/campeonato';
import { jogoPrincipal } from '../lib/graus';
import { hoje, diasEntre, fmtData } from '../lib/utils';

/* ============================================================
   A FOLHA DO MODO CAMPEONATO

   Contagem e checklist pra todo mundo; o plano de peso e a reta
   final no Premium. O peso é o mesmo da Nutrição (settings.pesoKg):
   atualizar aqui atualiza lá.
   ============================================================ */
const kg = (n) => `${String(n).replace('.', ',')} kg`;

export default function ModoCampeonato({ meta, esteira = [], onClose }) {
  const { settings, salvarSettings, acesso } = useApp();
  const [checklist, setChecklist] = useState(false);
  const hj = hoje();
  const dias = meta?.data ? Math.max(0, diasEntre(hj, meta.data)) : null;
  const livre = podeVer(acesso, 'campeonato');
  const plano = useMemo(() => (meta ? planoDePeso({
    peso: settings.pesoKg, categoria: meta.categoria, modalidade: meta.modalidade || 'gi',
    sexo: meta.sexo || 'masculino', hoje: hj, data: meta.data,
  }) : null), [meta, settings.pesoKg, hj]);
  const fortes = jogoPrincipal(esteira, 2).map((t) => t.nome);

  const peso = (
    <div className="col" style={{ gap: 10 }}>
      <Field label="Seu peso hoje (kg)" hint="O mesmo da Nutrição: mudou aqui, muda lá.">
        <NumeroInput valor={settings.pesoKg} onChange={(v) => salvarSettings({ pesoKg: v })} />
      </Field>
      {!meta?.categoria && <p className="micro muted">Escolhe a categoria de peso na meta (lápis) pra ver o plano.</p>}
      {meta?.categoria && !settings.pesoKg && <p className="micro muted">Coloca o peso de hoje pra ver o plano.</p>}
      {plano?.status === 'semLimite' && <div className="rel-linha">✅ <span><b>{meta.categoria}</b> não tem limite de peso. É só treinar.</span></div>}
      {plano?.status === 'dentro' && (
        <div className="rel-linha">✅ <span>Você está dentro do <b>{meta.categoria}</b> ({kg(plano.limite)}), com {kg(plano.folga)} de folga. Mantém.</span></div>
      )}
      {(plano?.status === 'cortar' || plano?.status === 'perigoso') && (
        <>
          <div className="rel-linha">⚖️ <span>Faltam <b>{kg(plano.falta)}</b> pro <b>{meta.categoria}</b> ({kg(plano.limite)}){meta.modalidade !== 'nogi' && <>, contando ~{KIMONO_KG} kg do kimono na pesagem</>}.</span></div>
          <div className="rel-linha">📉 <span>São <b>{kg(plano.porSemana)} por semana</b> até a luta. O ritmo seguro pro seu peso é até {kg(plano.seguro)} por semana.</span></div>
          {plano.status === 'perigoso' && (
            <div className="valida atencao"><p className="micro" style={{ lineHeight: 1.6 }}>
              Esse ritmo é perigoso: cortar peso rápido derruba o rendimento e a saúde. {plano.sugestao && <>Hoje você cabe no <b>{plano.sugestao}</b>: vale considerar lutar nele.</>}
            </p></div>
          )}
        </>
      )}
    </div>
  );

  const final = (
    <div className="col" style={{ gap: 8 }}>
      <div className="rel-linha">🥋 <span>{dias != null ? retaFinal(dias) : retaFinal(30)}</span></div>
      {fortes.length > 0 && <div className="rel-linha">🎯 <span>O que já funciona no seu jogo: <b>{fortes.join(' e ')}</b>. Monta a luta em volta disso.</span></div>}
    </div>
  );

  return (
    <>
      <Sheet aberto={!!meta} onClose={onClose} titulo={meta ? `🏆 ${meta.alvo || 'Campeonato'}` : ''}
        subtitulo={meta?.data ? `${fmtData(meta.data)}${meta.categoria ? ` · ${meta.categoria}` : ''}${meta.modalidade === 'nogi' ? ' · no-gi' : ' · gi'}` : ''}>
        {meta && (
          <>
            <div className="calc-resultado" style={{ alignItems: 'flex-start' }}>
              <div className="calc-numero num">{dias === 0 ? 'Hoje!' : dias === 1 ? 'Amanhã' : `${dias} dias`}</div>
              <p className="tiny muted">{dias === 0 ? 'Boa luta. Confia no que você treinou.' : 'até a luta. Os avisos chegam faltando 7, 3, 2 e 1 dia.'}</p>
            </div>
            <Btn variant="contorno" icon={ClipboardCheck} onClick={() => setChecklist(true)} style={{ width: '100%' }}>Checklist antes de competir</Btn>
            {livre ? (
              <>
                <div className="eyebrow">o peso</div>
                {peso}
                <div className="eyebrow">a reta final</div>
                {final}
              </>
            ) : (
              <Vitrine
                recurso="campeonato"
                fundo={<div className="col" style={{ gap: 14 }}>{peso}{final}</div>}
                titulo="O plano até a luta"
                texto="Quanto falta pra sua categoria, o ritmo seguro de perda e o que treinar em cada semana até o campeonato."
                itens={['Plano de peso pela tabela da IBJJF', 'Alerta quando o ritmo de corte fica perigoso', 'A reta final, semana a semana']}
                onAssinar={() => pedirOferta('campeonato')}
              />
            )}
            {meta.categoria && <Chip>{meta.sexo === 'feminino' ? 'Feminino' : 'Masculino'} · {meta.categoria}</Chip>}
          </>
        )}
      </Sheet>
      <AntesDeCompetir aberto={checklist} onClose={() => setChecklist(false)} />
    </>
  );
}
