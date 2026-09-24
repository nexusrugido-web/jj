import React, { useMemo } from 'react';
import { GraduationCap, ShieldCheck, ArrowRight } from 'lucide-react';
import { Card, Btn, Chip, Sheet } from './UI';
import Capa from './Capa';
import { escolherAulas, duracaoTexto } from '../lib/aulas';
import { guiaDeEstudo, situacao } from '../lib/lesao';

/* ============================================================
   PARADO, MAS NÃO PERDIDO

   Quem se machuca some do app, e quando volta perdeu tudo que
   tinha construído. Isso é o pior momento possível pra pessoa
   sentir que recomeçou do zero.

   Aqui o tempo fora vira tempo de estudo: o app explica por que
   aquela lesão acontece, mostra o que estudar, e a sequência
   continua de pé enquanto você estiver estudando.
   ============================================================ */

export default function ParadoEstudando({ lesao, faixa = 'branca', vistas = [], onEstudar, onClose, aberto }) {
  const guia = useMemo(() => guiaDeEstudo(lesao?.regiao), [lesao?.regiao]);
  const sit = useMemo(() => situacao(lesao), [lesao]);

  const aulas = useMemo(
    () => escolherAulas({ temas: guia.busque, faixa, vistas, quantidade: 3, soAula: true }),
    [guia, faixa, vistas]
  );

  if (!lesao) return null;

  return (
    <Sheet
      aberto={aberto}
      onClose={onClose}
      titulo={sit?.parado ? 'Enquanto você se recupera' : 'Treinando com cuidado'}
      wide
      footer={<Btn variant="primary" icon={GraduationCap} onClick={onEstudar}>Ver as aulas</Btn>}
    >
      {sit?.parado && (
        <div className="valida bom">
          <ShieldCheck size={15} className="valida-ico" style={{ color: 'var(--jade)' }} />
          <div>
            <div className="tiny" style={{ fontWeight: 600 }}>Sua sequência está protegida</div>
            <p className="micro muted" style={{ marginTop: 4, lineHeight: 1.65 }}>
              Enquanto a lesão estiver aberta, estudar conta no lugar de treinar. Você não perde o que
              construiu por ter se machucado.
            </p>
          </div>
        </div>
      )}

      <div>
        <div className="eyebrow">por que isso acontece</div>
        <p className="tiny muted" style={{ lineHeight: 1.75 }}>{guia.porque}</p>
      </div>

      <div>
        <div className="eyebrow">o que muda quando você voltar</div>
        <p className="tiny muted" style={{ lineHeight: 1.75 }}>{guia.evitar}</p>
      </div>

      {aulas.length > 0 && (
        <div>
          <div className="eyebrow">aulas sobre isso</div>
          <div className="col" style={{ gap: 9 }}>
            {aulas.map((a) => (
              <div key={a.id} className="rec-aula" style={{ marginTop: 0 }}>
                <div className="rec-aula-capa">
                  <Capa id={a.id} propria={a.capa} tamanho="sd" />
                  <span className="aula-dur">{duracaoTexto(a.d)}</span>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div className="tiny" style={{ fontWeight: 600, lineHeight: 1.35 }}>{a.t}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="micro muted" style={{ lineHeight: 1.65 }}>
        Isto aqui não substitui médico nem fisioterapeuta. Se dói de verdade, procure quem entende antes de
        voltar pro tatame.
      </p>
    </Sheet>
  );
}
