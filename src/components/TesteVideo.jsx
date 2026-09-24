import React, { useState } from 'react';
import { Check, X, Loader, Wifi } from 'lucide-react';
import { Card, Btn } from './UI';

/* ============================================================
   TESTE DE VÍDEO

   Quando a aula não abre, existem quatro motivos possíveis e
   eles pedem soluções diferentes. Isto diz qual é, em vez de
   deixar a pessoa olhando um retângulo preto.
   ============================================================ */

const VIDEO_TESTE = 'dVdrfF6ORWw';

export default function TesteVideo() {
  const [rodando, setRodando] = useState(false);
  const [r, setR] = useState(null);

  async function testar() {
    setRodando(true);
    const out = {};

    /* 1. a miniatura chega? */
    out.miniatura = await new Promise((ok) => {
      const img = new Image();
      img.onload = () => ok(true);
      img.onerror = () => ok(false);
      img.src = `https://i.ytimg.com/vi/${VIDEO_TESTE}/mqdefault.jpg?t=${Date.now()}`;
      setTimeout(() => ok(false), 6000);
    });

    /* 2. o script do player chega? */
    out.script = await new Promise((ok) => {
      if (window.YT?.Player) return ok(true);
      const s = document.createElement('script');
      s.src = 'https://www.youtube-nocookie.com/iframe_api';
      s.onload = () => ok(true);
      s.onerror = () => ok(false);
      document.head.appendChild(s);
      setTimeout(() => ok(!!window.YT), 6000);
    });

    /* 3. quem está servindo as requisições */
    out.sw = !!navigator.serviceWorker?.controller;
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      out.swEspera = !!reg?.waiting;
    } catch { out.swEspera = false; }

    setR(out);
    setRodando(false);
  }

  const Linha = ({ ok, nome, quando }) => (
    <div className="row" style={{ gap: 10, padding: '9px 0', alignItems: 'flex-start' }}>
      <span style={{ color: ok ? 'var(--jade)' : 'var(--blood)', marginTop: 1 }}>
        {ok ? <Check size={15} /> : <X size={15} />}
      </span>
      <div style={{ flex: 1 }}>
        <div className="tiny" style={{ fontWeight: 600 }}>{nome}</div>
        {!ok && <p className="micro muted" style={{ marginTop: 3, lineHeight: 1.55 }}>{quando}</p>}
      </div>
    </div>
  );

  return (
    <Card style={{ marginBottom: 14 }}>
      <div className="card-head">
        <div>
          <div className="eyebrow">quando a aula não abre</div>
          <h2 className="h-sec">Testar o vídeo</h2>
        </div>
        <Btn size="sm" icon={rodando ? Loader : Wifi} onClick={testar} disabled={rodando}>
          {rodando ? 'Testando' : 'Testar'}
        </Btn>
      </div>

      {!r ? (
        <p className="tiny muted" style={{ lineHeight: 1.65 }}>
          Isto confere se o seu navegador consegue falar com o YouTube e diz exatamente o que está barrando.
        </p>
      ) : (
        <>
          <Linha
            ok={r.miniatura}
            nome="A imagem da aula chega"
            quando="Alguma extensão está bloqueando. No computador costuma ser DuckDuckGo, uBlock ou Privacy Badger. Clique no ícone dela na barra e libere este site."
          />
          <Linha
            ok={r.script}
            nome="O player do YouTube carrega"
            quando="O mesmo bloqueador, ou a rede da academia barrando o YouTube. No celular, tente pelos dados em vez do wi-fi."
          />
          <Linha
            ok={!r.swEspera}
            nome="O app está na versão atual"
            quando="Tem uma versão mais nova esperando. Feche todas as abas do app e abra de novo."
          />

          <div className="valida bom" style={{ marginTop: 12 }}>
            <Check size={15} className="valida-ico" style={{ color: 'var(--jade)' }} />
            <p className="micro muted" style={{ lineHeight: 1.6 }}>
              {r.miniatura && r.script
                ? 'Está tudo certo do lado da conexão. Se a aula continuar preta, me avise que o problema é outro.'
                : 'Enquanto isso, toda aula tem o botão de abrir no YouTube, que funciona de qualquer jeito.'}
            </p>
          </div>
        </>
      )}
    </Card>
  );
}
