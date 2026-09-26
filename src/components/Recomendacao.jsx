import React, { useState, useEffect } from 'react';
import Capa from '../components/Capa';
import { Check } from 'lucide-react';
import { db } from '../db/db';
import { Chip, useToast } from './UI';
import { INTENCOES, chaveDaRec, respostaAoMarcar } from '../lib/recomendar';
import { capa, duracaoTexto, registrarAulaVista } from '../lib/aulas';
import { aulasPara } from '../lib/motor';
import { pedidoDaRec, descreverPedido, rotuloDaAula } from '../lib/necessidades';
import { medir, origem as origemDe } from '../lib/medir';
import Player from './Player';
import { hoje } from '../lib/utils';
import { useApp } from '../contexto';
import { useLimite } from './Limite';
import { Vitrine } from './Plano';

/* ============================================================
   A RECOMENDAÇÃO QUE FECHA O LAÇO

   O app diz o que treinar e traz a aula. Quando você termina a
   aula, a sugestão sai da lista por duas semanas e a aula vai pra
   Vistas. Não tem botão de "já fiz": vale o que foi assistido.

   Aula já vista só volta quando as outras do assunto acabaram, e
   aí vem avisando que é pra reforçar.
   ============================================================ */

export default function Recomendacao({ rec, faixa = 'branca', vistas = [], onFeito, comAula = true, tela = 'painel' }) {
  const toast = useToast();
  const { acesso, irPara } = useApp();
  const { liberarVideo, aviso } = useLimite(acesso, irPara);
  const [resposta, setResposta] = useState(null);
  const [tocando, setTocando] = useState(null);

  const deOnde = origemDe(tela, 'rec', chaveDaRec(rec));

  async function tocar(a) {
    if (await liberarVideo(a, deOnde)) setTocando({ ...a, origem: deOnde });
  }

  const info = INTENCOES[rec.intencao] || INTENCOES.repetir;

  /* o motor procura pelo que o vídeo ensina, no acervo inteiro.
     Sem nada do assunto, cai no porquê das coisas. */
  const pedido = pedidoDaRec(rec);
  const aulas = comAula
    ? aulasPara(pedido, {
        faixa,
        vistas,
        quantidade: 1,
        /* short é pra navegar no Estudo. Aqui, que é o app dizendo
           o que treinar, a aula tem que explicar de verdade. */
        soAula: true,
      })
    : [];

  /* o que apareceu, e quando não tinha vídeo do assunto */
  const idDaAula = aulas[0]?.id || null;
  /* sem aula da técnica, a resposta geral também é falta: é pauta */
  const faltou = comAula && (!aulas.length || aulas.every((a) => a.reserva || a.generico));
  useEffect(() => {
    if (!comAula) return;
    if (idDaAula) medir('exibiu', { origem: deOnde, videoId: idDaAula });
    if (faltou) medir('faltou', { origem: deOnde, detalhe: descreverPedido(pedido) });
  }, [deOnde, idDaAula, faltou]);

  async function concluiu(resultado) {
    await db.recFeitas.add({
      chave: chaveDaRec(rec),
      intencao: rec.intencao,
      alvo: rec.alvo || null,
      titulo: rec.titulo,
      resultado,
      data: hoje(),
      criadoEm: Date.now(),
    });

    setResposta(respostaAoMarcar(resultado, rec, faixa));
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
          <div className="rec-aula-capa">
            <Capa id={aulas[0].id} propria={aulas[0].capa} tamanho="sd" />
            <span className="aula-dur">{duracaoTexto(aulas[0].d)}</span>
          </div>
          <div style={{ minWidth: 0, textAlign: 'left' }}>
            {vistas.includes(aulas[0].id) && (
              <div className="micro" style={{ color: 'var(--roar)', fontWeight: 700, marginBottom: 3 }}>Você já viu esta aula. Vale reforçar.</div>
            )}
            <div className="micro" style={{ color: 'var(--dimmer)' }}>
              {rotuloDaAula(aulas[0], pedido, rec.alvo)}
            </div>
            <div className="tiny" style={{ fontWeight: 600, marginTop: 3, lineHeight: 1.35 }}>{aulas[0].t}</div>
          </div>
        </button>
      )}


      {tocando && (
        <Player
          aula={tocando}
          onClose={() => setTocando(null)}
          onConcluir={async (aula, segundos) => {
            const r = await registrarAulaVista(aula, segundos);
            setTocando(null);
            toast(r.xp ? `Aula vista, +${r.xp} pontos` : 'Aula vista');
            /* terminou a aula da sugestão: ela sai da lista */
            await concluiu('assistiu');
          }}
        />
      )}
      {aviso}
    </div>
  );
}

/* ============================================================
   NO GRÁTIS

   "O que treinar agora" sai dos rolas da pessoa, então é do
   premium. A primeira recomendação real aparece borrada atrás do
   convite, sem aula, pra não contar como vídeo exibido.
   ============================================================ */
export function VitrineRecomendacao({ recs, faixa, vistas, onAssinar }) {
  return (
    <Vitrine
      recurso="recomendacoes"
      fundo={<Recomendacao rec={recs[0]} faixa={faixa} vistas={vistas} comAula={false} />}
      titulo="O que treinar, escolhido pelos seus rolas"
      texto={`O app já separou ${recs.length} ${recs.length === 1 ? 'coisa' : 'coisas'} pra você treinar, tiradas dos seus rolas.`}
      itens={[
        'O que corrigir primeiro, pelo que mais te pega',
        'O que repetir, pelo que já começou a sair',
        'A aula certa pra cada uma, pronta no Estudo',
      ]}
      onAssinar={onAssinar}
    />
  );
}
