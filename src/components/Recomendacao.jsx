import React, { useState, useEffect } from 'react';
import Capa from '../components/Capa';
import { Check, X, Minus, Play, Sparkles } from 'lucide-react';
import { db } from '../db/db';
import { Card, Btn, Chip, useToast } from './UI';
import { INTENCOES, RESULTADOS, chaveDaRec, respostaAoMarcar } from '../lib/recomendar';
import { capa, duracaoTexto, registrarAulaVista } from '../lib/aulas';
import { aulasPara } from '../lib/motor';
import { pedidoDaRec } from '../lib/necessidades';
import Player from './Player';
import { darXp } from '../lib/xp';
import { hoje } from '../lib/utils';
import { useApp } from '../contexto';
import { useLimite } from './Limite';

/* ============================================================
   A RECOMENDAÇÃO QUE FECHA O LAÇO

   O app diz o que treinar. Você treina. Aí você marca aqui se
   funcionou, e aquilo sai da lista por duas semanas.

   Sem isso, a mesma sugestão volta igual amanhã e você nunca
   sabe se o app está te ouvindo.
   ============================================================ */

export default function Recomendacao({ rec, faixa = 'branca', vistas = [], onFeito, comAula = true }) {
  const toast = useToast();
  const { acesso, irPara } = useApp();
  const { liberarVideo, aviso } = useLimite(acesso, irPara);
  const [marcando, setMarcando] = useState(false);
  const [resposta, setResposta] = useState(null);
  const [tocando, setTocando] = useState(null);

  async function tocar(a) {
    if (await liberarVideo(a, `recomendacao:${chaveDaRec(rec)}`)) setTocando(a);
  }

  const info = INTENCOES[rec.intencao] || INTENCOES.repetir;

  /* o motor procura pelo que o vídeo ensina, no acervo inteiro.
     Sem nada do assunto, cai no porquê das coisas. */
  const aulas = comAula
    ? aulasPara(pedidoDaRec(rec), {
        faixa,
        vistas,
        quantidade: 1,
        /* short é pra navegar no Estudo. Aqui, que é o app dizendo
           o que treinar, a aula tem que explicar de verdade. */
        soAula: true,
      })
    : [];

  async function marcar(resultado) {
    await db.recFeitas.add({
      chave: chaveDaRec(rec),
      intencao: rec.intencao,
      alvo: rec.alvo || null,
      titulo: rec.titulo,
      resultado,
      data: hoje(),
      criadoEm: Date.now(),
    });

    if (resultado !== 'nao') {
      await darXp('treino', { refId: `rec:${chaveDaRec(rec)}:${hoje()}`, detalhe: rec.titulo });
    }

    setResposta(respostaAoMarcar(resultado, rec, faixa));
    setMarcando(false);
    onFeito?.(resultado);
  }

  if (resposta) {
    return (
      <div className="rec-item" style={{ borderColor: `color-mix(in srgb, var(--${resposta.tom || 'seam-hi'}) 38%, var(--seam))` }}>
        <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
          <Check size={15} style={{ color: `var(--${resposta.tom || 'dim'})`, flex: 'none', marginTop: 2 }} />
          <div>
            <div className="tiny" style={{ fontWeight: 600 }}>{resposta.titulo}</div>
            <p className="micro muted" style={{ marginTop: 4, lineHeight: 1.65 }}>{resposta.texto}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rec-item">
      <div className="row wrap" style={{ gap: 7, marginBottom: 7 }}>
        <Chip tone={info.cor}>{info.nome}</Chip>
        <span className="tiny" style={{ fontWeight: 600 }}>{rec.titulo}</span>
      </div>
      <p className="tiny muted" style={{ lineHeight: 1.65 }}>{rec.texto}</p>
      {rec.evidencia && (
        <div className="micro" style={{ color: 'var(--dimmer)', marginTop: 6 }}>{rec.evidencia}</div>
      )}

      {aulas.length > 0 && (
        <button className="rec-aula" onClick={() => tocar(aulas[0])}>
          <Capa id={aulas[0].id} propria={aulas[0].capa} tamanho="mq" />
          <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
            <div className="micro" style={{ color: 'var(--dimmer)' }}>
              {aulas[0].porque?.length ? `ensina ${aulas[0].porque.join(' · ')}` : 'aula sobre isso'}
            </div>
            <div className="micro" style={{ fontWeight: 600, marginTop: 2, lineHeight: 1.35 }}>{aulas[0].t}</div>
          </div>
          <span className="micro muted num">{duracaoTexto(aulas[0].d)}</span>
        </button>
      )}

      {!marcando ? (
        <button className="btn ghost xs" onClick={() => setMarcando(true)} style={{ marginTop: 11 }}>
          <Check size={12} /> Já treinei isso
        </button>
      ) : (
        <div style={{ marginTop: 12 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>e aí, saiu?</div>
          <div className="row wrap" style={{ gap: 7 }}>
            {RESULTADOS.map((r) => (
              <button key={r.id} className="chip" style={{ minHeight: 38 }} onClick={() => marcar(r.id)}>
                {r.nome}
              </button>
            ))}
            <button className="btn ghost xs" onClick={() => setMarcando(false)}>Deixa</button>
          </div>
        </div>
      )}

      {tocando && (
        <Player
          aula={tocando}
          onClose={() => setTocando(null)}
          onConcluir={async (aula, segundos) => {
            const r = await registrarAulaVista(aula, segundos);
            setTocando(null);
            toast(r.xp ? `Aula vista, +${r.xp} pontos` : r.revisao ? 'Revisto' : 'Aula vista');
          }}
        />
      )}
      {aviso}
    </div>
  );
}
