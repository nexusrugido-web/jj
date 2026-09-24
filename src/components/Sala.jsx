import React, { useEffect, useState, useCallback } from 'react';
import { Users, UserPlus, LogOut, Crown, Hourglass } from 'lucide-react';
import { useApp } from '../contexto';
import { Card, Btn, Chip, Sheet, Confirmar, useToast } from './UI';
import Avatar from './Avatar';
import {
  minhaSala, criarSala, entrarNaSala, sairDaSala, verSala, convidar, conviteDaURL, esquecerConvite,
} from '../lib/sala';
import { hoje, addDias, fmtData } from '../lib/utils';
import { inicioSemana } from '../lib/stats';

/* ============================================================
   A SALA NA TELA DA LIGA

   Sem sala: o convite pra montar uma. Com sala: quem está, desde
   quando vale, e os botões de convidar e sair. O convite que chega
   pelo link abre aqui, depois que a pessoa entrou na conta.
   ============================================================ */
const MINIMO = 3;
const MAXIMO = 5;

export default function Sala({ onMudou }) {
  const { sessao, ligada } = useApp();
  const toast = useToast();
  const [membros, setMembros] = useState(null);
  const [indo, setIndo] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const [convite, setConvite] = useState(null);

  const ativa = ligada?.('liga');

  const buscar = useCallback(async () => {
    if (!sessao) return;
    try { setMembros(await minhaSala()); } catch { setMembros([]); }
  }, [sessao]);

  useEffect(() => { if (ativa) buscar(); }, [ativa, buscar]);

  /* chegou pelo link de convite */
  useEffect(() => {
    if (!ativa || !sessao) return;
    const cod = conviteDaURL();
    if (!cod) return;
    verSala(cod)
      .then((info) => setConvite({ codigo: cod, info }))
      .catch(() => setConvite({ codigo: cod, info: null }));
  }, [ativa, sessao]);

  if (!ativa || !sessao || membros === null) return null;

  const tem = membros.length > 0;
  const proximaSegunda = addDias(inicioSemana(hoje()), 7);

  async function criar() {
    setIndo(true);
    try {
      const r = await criarSala();
      toast(r.mensagem, r.ok ? '' : 'err');
      /* o compartilhar do celular só abre logo depois de um toque: o
         Convidar fica ali, em destaque, pra pessoa tocar */
      if (r.ok) { await buscar(); onMudou?.(); }
    } catch { toast('Não deu pra criar a sala agora', 'err'); }
    setIndo(false);
  }

  async function aceitar() {
    setIndo(true);
    try {
      const r = await entrarNaSala(convite.codigo);
      toast(r.mensagem, r.ok ? '' : 'err');
      if (r.ok) { esquecerConvite(); setConvite(null); await buscar(); onMudou?.(); }
    } catch { toast('Não deu pra entrar agora', 'err'); }
    setIndo(false);
  }

  const folhaConvite = (
    <Sheet
      aberto={!!convite}
      onClose={() => { esquecerConvite(); setConvite(null); }}
      titulo="Convite pra uma sala"
      footer={(
        <>
          <Btn variant="ghost" onClick={() => { esquecerConvite(); setConvite(null); }}>Agora não</Btn>
          <Btn variant="primary" icon={UserPlus} onClick={aceitar} disabled={indo || !convite?.info || convite?.info?.cheia}>Entrar na sala</Btn>
        </>
      )}
    >
      {!convite?.info ? (
        <p className="tiny muted">Esse convite não existe mais. Peça um link novo pra quem te chamou.</p>
      ) : convite.info.cheia ? (
        <p className="tiny muted">A sala de {convite.info.quem_convidou} já está com {MAXIMO} pessoas.</p>
      ) : (
        <>
          <p className="tiny" style={{ lineHeight: 1.7 }}>
            <b>{convite.info.quem_convidou}</b> te chamou pra correr a liga junto. A sala tem {convite.info.pessoas}{' '}
            {convite.info.pessoas === 1 ? 'pessoa' : 'pessoas'} e cabe até {MAXIMO}.
          </p>
          <p className="micro muted" style={{ lineHeight: 1.65 }}>
            Ela começa na segunda, {fmtData(proximaSegunda)}, e corre no lugar da liga automática: pontos de treino,
            aula e quiz, com pódio e sobe e desce de divisão. Tem sempre um grupo seu, toda semana, até alguém sair.
          </p>
        </>
      )}
    </Sheet>
  );

  if (!tem) {
    return (
      <Card style={{ marginBottom: 14 }}>
        <div className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
          <span className="stat-ico" style={{ color: 'var(--accent)' }}><Users size={17} /></span>
          <div style={{ flex: 1 }}>
            <div className="eyebrow">liga com os amigos</div>
            <div className="h-sec" style={{ marginTop: 3 }}>Monte a sua sala</div>
            <p className="tiny muted" style={{ marginTop: 6, lineHeight: 1.65 }}>
              De {MINIMO} a {MAXIMO} pessoas, pelo link no WhatsApp. A sala começa na segunda seguinte e corre no lugar
              da liga automática, toda semana, com pódio e sobe e desce de divisão.
            </p>
            <Btn variant="primary" icon={UserPlus} onClick={criar} disabled={indo} style={{ marginTop: 12 }}>
              {indo ? 'Criando…' : 'Criar sala'}
            </Btn>
          </div>
        </div>
        {folhaConvite}
      </Card>
    );
  }

  const n = membros.length;
  const { valendo, proxima, sou_dono: souDono, codigo } = membros[0];
  const estado = valendo
    ? { tom: 'jade', texto: 'valendo esta semana' }
    : proxima
      ? { tom: 'warn', texto: `começa segunda, ${fmtData(proximaSegunda, { curto: true })}` }
      : { tom: '', texto: `falta${MINIMO - n === 1 ? '' : 'm'} ${MINIMO - n} pra começar` };

  return (
    <Card style={{ marginBottom: 14 }}>
      <div className="card-head">
        <div>
          <div className="eyebrow">liga com os amigos</div>
          <h2 className="h-sec row" style={{ gap: 8 }}><Users size={16} /> Sua sala</h2>
        </div>
        <Chip tone={estado.tom}>{estado.tom === 'warn' && <Hourglass size={11} />} {estado.texto}</Chip>
      </div>

      <div className="col" style={{ gap: 6 }}>
        {membros.map((m) => (
          <div key={m.user_id} className={`liga-linha ${m.sou_eu ? 'eu' : ''}`}>
            <Avatar nome={m.nome} foto={m.foto} className="liga-avatar" />
            <span className="tiny liga-nome" style={{ fontWeight: m.sou_eu ? 600 : 400 }}>
              {m.nome}{m.sou_eu ? ' (você)' : ''}
            </span>
            {m.dono && <Chip><Crown size={11} /> criou</Chip>}
            {m.vale_desde > hoje() && <span className="micro muted">a partir de {fmtData(m.vale_desde, { curto: true })}</span>}
          </div>
        ))}
        {Array.from({ length: Math.max(0, MINIMO - n) }).map((_, i) => (
          <div key={`vaga${i}`} className="liga-linha sala-vaga"><span className="micro muted">vaga</span></div>
        ))}
      </div>

      <p className="micro muted" style={{ marginTop: 10, lineHeight: 1.6 }}>
        Quem entra hoje corre a partir da próxima segunda. Sair vale a partir da semana seguinte, e com menos de {MINIMO}{' '}
        a sala para e cada um volta pra liga automática.
      </p>

      <div className="row wrap" style={{ gap: 8, marginTop: 12 }}>
        {n < MAXIMO && (
          <Btn variant="primary" size="sm" icon={UserPlus} onClick={() => convidar(codigo)}>Convidar</Btn>
        )}
        <Btn variant="ghost" size="sm" icon={LogOut} onClick={() => setSaindo(true)}>Sair da sala</Btn>
      </div>

      <Confirmar
        aberto={saindo}
        onClose={() => setSaindo(false)}
        titulo="Sair da sala?"
        rotulo="Sair"
        texto={souDono && n > 1 ? 'Você criou a sala, mas ela continua com os outros. Você corre nela até domingo e depois volta pra liga automática.' : 'Você corre nela até domingo e depois volta pra liga automática.'}
        onConfirmar={async () => { await sairDaSala().catch(() => {}); await buscar(); onMudou?.(); toast('Você sai da sala no fim da semana'); }}
      />
      {folhaConvite}
    </Card>
  );
}
