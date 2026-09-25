import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Building2 } from 'lucide-react';
import { db } from '../db/db';
import { Field } from './UI';

/* ============================================================
   ACADEMIA E PROFESSOR, DO QUE JÁ ESTÁ CADASTRADO

   Nada de digitar nome: a academia e o professor vêm de Parceiros,
   e assim a graduação, o treino e o resto do app falam da mesma
   pessoa. O professor aparece filtrado pela academia escolhida.

   valor     { academiaId, professorId }
   onChange  recebe { academiaId, professorId, academia, professor }
             (os nomes vão junto, pro histórico não quebrar se um
             cadastro for apagado depois)
   ============================================================ */
export default function AcademiaProfessor({ valor, onChange, onCadastrar }) {
  const academias = useLiveQuery(() => db.academies.filter((a) => !a.arquivada).toArray(), [], []) || [];
  const professores = useLiveQuery(() => db.professors.filter((p) => !p.arquivada).toArray(), [], []) || [];
  const daAcademia = professores.filter((p) => !valor.academiaId || p.academiaId === valor.academiaId);

  const mudar = (academiaId, professorId) => onChange({
    academiaId, professorId,
    academia: academias.find((a) => a.id === academiaId)?.nome || '',
    professor: professores.find((p) => p.id === professorId)?.nome || '',
  });

  if (!academias.length && !professores.length) {
    return (
      <div className="valida">
        <Building2 size={15} className="valida-ico" style={{ color: 'var(--dim)' }} />
        <p className="micro muted" style={{ lineHeight: 1.6 }}>
          Cadastre a sua academia e o seu professor em Parceiros e eles aparecem aqui pra escolher.
          {onCadastrar && <> <button type="button" className="btn ghost xs" onClick={onCadastrar}>Abrir Parceiros</button></>}
        </p>
      </div>
    );
  }

  return (
    <>
      {academias.length > 0 && (
        <Field label="Academia">
          <div className="row wrap" style={{ gap: 7 }}>
            {academias.map((a) => (
              <button key={a.id} type="button" className={`chip ${valor.academiaId === a.id ? 'on' : ''}`}
                onClick={() => {
                  /* trocou de academia: o professor só fica se for de lá */
                  const fica = professores.find((p) => p.id === valor.professorId && p.academiaId === a.id);
                  mudar(valor.academiaId === a.id ? null : a.id, fica ? valor.professorId : null);
                }}>
                {a.nome}
              </button>
            ))}
          </div>
        </Field>
      )}
      {daAcademia.length > 0 && (
        <Field label="Professor">
          <div className="row wrap" style={{ gap: 7 }}>
            {daAcademia.map((p) => (
              <button key={p.id} type="button" className={`chip ${valor.professorId === p.id ? 'on' : ''}`}
                onClick={() => mudar(valor.academiaId || p.academiaId || null, valor.professorId === p.id ? null : p.id)}>
                {p.nome}
              </button>
            ))}
          </div>
        </Field>
      )}
    </>
  );
}
