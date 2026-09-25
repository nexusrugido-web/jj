import React, { useState } from 'react';
import { useApp } from '../contexto';
import { Sheet, Btn, Input } from './UI';
import { idadeDe } from '../lib/regras';
import { IDADE_MINIMA, IDADE_SEM_RESPONSAVEL } from '../lib/idade';

/* ============================================================
   A IDADE DE QUEM JÁ USAVA O APP

   Quem entrou antes do passo "Sua idade" no primeiro acesso não tem
   o ano de nascimento. O app pergunta uma vez; "Agora não" não
   pergunta de novo (dá pra pôr depois em Ajustes → Perfil).
   ============================================================ */
export default function PerguntaIdade({ pausado = false }) {
  const { settings, salvarSettings } = useApp();
  const [ano, setAno] = useState('');
  const [responsavel, setResponsavel] = useState(false);
  const aberto = !pausado && !!settings?.onboardingFeito && !settings.anoNascimento && !settings.idadePerguntada;
  const i = idadeDe(ano);
  const pode = i != null && i >= IDADE_MINIMA && i < 100 && (i >= IDADE_SEM_RESPONSAVEL || responsavel);

  return (
    <Sheet aberto={aberto} onClose={() => salvarSettings({ idadePerguntada: 1 })} titulo="Em que ano você nasceu?">
      <p className="tiny muted" style={{ lineHeight: 1.6 }}>
        A regra do jiu-jitsu muda com a idade: tem técnica que só é liberada a partir de certa idade, e a divisão de campeonato também sai daqui. O app guarda só o ano.
      </p>
      <Input type="number" inputMode="numeric" value={ano} placeholder="Ex.: 1998" onChange={(e) => setAno(e.target.value.slice(0, 4))} />
      {i != null && i < IDADE_MINIMA && (
        <p className="tiny" style={{ color: 'var(--roar)', lineHeight: 1.6 }}>O NeuroJitsu é pra quem tem {IDADE_MINIMA} anos ou mais.</p>
      )}
      {i != null && i >= IDADE_MINIMA && i < IDADE_SEM_RESPONSAVEL && (
        <button type="button" className={`opcao-meta ${responsavel ? 'on' : ''}`} onClick={() => setResponsavel(!responsavel)}>
          <div className="tiny" style={{ fontWeight: 600 }}>{responsavel ? '✓ ' : ''}Um responsável acompanha e autoriza</div>
          <p className="micro muted" style={{ marginTop: 3, lineHeight: 1.6 }}>
            Pra quem tem menos de {IDADE_SEM_RESPONSAVEL} anos, o pai, a mãe ou quem cuida precisa estar de acordo com o uso do app.
          </p>
        </button>
      )}
      <div className="col" style={{ gap: 8 }}>
        <Btn variant="primary" disabled={!pode}
          onClick={() => salvarSettings({ anoNascimento: Number(ano), responsavelAutorizou: responsavel ? 1 : 0, idadePerguntada: 1 })}>
          Salvar
        </Btn>
        <Btn variant="ghost" onClick={() => salvarSettings({ idadePerguntada: 1 })}>Agora não</Btn>
      </div>
    </Sheet>
  );
}
