import React, { useState, useCallback } from 'react';
import { Lock } from 'lucide-react';
import { Sheet, Card, Btn } from './UI';
import { LimiteDoDia } from './Plano';
import { limiteDoDia } from '../lib/plano';
import { estadoDoVideo } from '../lib/pago';
import { comOrigemDoApp } from '../lib/links';

/* ============================================================
   A TRAVA DO DIA

   Duas telas abrem vídeo, e o quiz e o registro de treino têm
   o mesmo problema: perguntar antes se ainda cabe hoje, e
   explicar quando não cabe.

   Vídeo tem uma pergunta a mais, que vem antes: ele é vendido
   à parte? Se for, nem entra na conta do dia, porque o que
   falta ali não é cota, é compra.

   O aviso é uma folha e não um alerta do navegador, porque a
   pessoa precisa conseguir ler o que ganha no premium e fechar
   sem sair do lugar onde estava.
   ============================================================ */
export function useLimite(acesso, irPara) {
  const [travado, setTravado] = useState(null);
  const [pago, setPago] = useState(null);

  /* abre o aviso na mão, pra quem já sabe que não cabe. O editor
     de treino sabe: ele conta o que está na tela e ainda não foi
     salvo, coisa que o banco não tem como ver. */
  const travar = useCallback((tipo) => setTravado(tipo), []);

  /* devolve true quando ainda cabe, e abre o aviso quando não */
  const liberado = useCallback(async (tipo) => {
    const l = await limiteDoDia(acesso, tipo);
    if (l.pode) return true;
    setTravado(tipo);
    return false;
  }, [acesso]);

  /* a pergunta inteira de um vídeo: primeiro se é pago, depois
     se ainda cabe hoje */
  const liberarVideo = useCallback(async (aula) => {
    if (!aula) return false;

    const e = estadoDoVideo(aula, acesso);
    if (!e.pode) { setPago(e); return false; }

    return liberado(aula.k === 'aula' ? 'aula' : 'short');
  }, [acesso, liberado]);

  const aviso = (
    <>
      <Sheet
        aberto={!!travado}
        onClose={() => setTravado(null)}
        titulo="Por hoje é isso"
      >
        <LimiteDoDia
          tipo={travado}
          onAssinar={() => { setTravado(null); irPara?.('ajustes'); }}
        />
      </Sheet>

      <Sheet
        aberto={!!pago}
        onClose={() => setPago(null)}
        titulo="Aula à parte"
      >
        {pago && (
          <Card style={{ borderStyle: 'dashed' }}>
            <div className="col center" style={{ alignItems: 'center', gap: 12, padding: '10px 0' }}>
              <span className="stat-ico" style={{ color: 'var(--accent)' }}><Lock size={17} /></span>
              <div className="center">
                <div className="tiny" style={{ fontWeight: 600 }}>{pago.titulo}</div>
                <p className="micro muted" style={{ marginTop: 5, maxWidth: 320, lineHeight: 1.6 }}>
                  {pago.texto}
                </p>
              </div>

              {pago.link ? (
                <Btn
                  size="sm"
                  variant="primary"
                  onClick={() => { window.open(comOrigemDoApp(pago.link), '_blank', 'noopener'); setPago(null); }}
                >
                  {pago.acao}
                </Btn>
              ) : (
                <p className="micro muted center" style={{ maxWidth: 300, lineHeight: 1.6 }}>
                  O link de compra ainda não foi cadastrado. Fale com o suporte.
                </p>
              )}
            </div>
          </Card>
        )}
      </Sheet>
    </>
  );

  return { liberado, liberarVideo, travar, aviso };
}
