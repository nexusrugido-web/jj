import React from 'react';
import {
  LayoutDashboard, Film, CreditCard, Users, Sliders, Megaphone, ArrowLeft,
} from 'lucide-react';

/* ============================================================
   A CASCA DO PAINEL

   O painel morava dentro da casca do aluno, com a mesma barra
   lateral de Treinos, Metas, Nutrição e Lesões do lado. Quem
   administra não está ali pra registrar treino, e ter o menu do
   aluno em volta fazia a tela parecer uma aba perdida do app em
   vez de uma ferramenta.

   Aqui o painel tem a navegação dele, e uma única porta de volta
   pro app. Cada seção responde uma pergunta só, e é por isso que
   elas não se misturam mais numa rolagem infinita.
   ============================================================ */

export const SECOES = [
  {
    id: 'visao',
    nome: 'Visão geral',
    icone: LayoutDashboard,
    resumo: 'Quantas contas existem, quem está ativo e quanto o app andou esta semana.',
  },
  {
    id: 'acervo',
    nome: 'Vídeos',
    icone: Film,
    resumo: 'Cadastrar, categorizar e decidir de quem é cada vídeo do acervo.',
  },
  {
    id: 'acessos',
    nome: 'Acessos',
    icone: CreditCard,
    resumo: 'O que está ligado pra todo mundo, a cobrança e os links de pagamento.',
  },
  {
    id: 'contas',
    nome: 'Contas',
    icone: Users,
    resumo: 'Quem usa o app, em que faixa está, o que assinou e o que comprou.',
  },
  {
    id: 'ajustes',
    nome: 'Números',
    icone: Sliders,
    resumo: 'Tamanho do grupo da liga, cortes, limites e os links da Hotmart.',
  },
  {
    id: 'recado',
    nome: 'Recado',
    icone: Megaphone,
    resumo: 'O aviso que aparece no topo do app pra todo mundo.',
  },
];

export default function CascaAdmin({ secao, onSecao, onSair, acoes, children }) {
  const atual = SECOES.find((s) => s.id === secao) || SECOES[0];

  return (
    <div className="admin-casca">
      <aside className="admin-lado">
        <button className="admin-voltar" onClick={onSair}>
          <ArrowLeft size={14} /> Voltar pro app
        </button>

        <div className="admin-marca">
          <span className="brand-mark" style={{ width: 30, height: 30, borderRadius: 10 }} />
          <div>
            <div className="brand-name" style={{ fontSize: 14 }}>Painel</div>
            <div className="brand-sub">administração</div>
          </div>
        </div>

        <nav className="admin-nav">
          {SECOES.map((s) => (
            <button
              key={s.id}
              className={`admin-item ${secao === s.id ? 'on' : ''}`}
              onClick={() => onSecao(s.id)}
            >
              <s.icone size={15} />
              <span>{s.nome}</span>
            </button>
          ))}
        </nav>
      </aside>

      <main className="admin-corpo">
        <div className="admin-topo">
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 className="h-page">{atual.nome}</h1>
            <p className="tiny muted" style={{ marginTop: 4, lineHeight: 1.6 }}>{atual.resumo}</p>
          </div>
          {acoes}
        </div>

        {children}
      </main>
    </div>
  );
}
