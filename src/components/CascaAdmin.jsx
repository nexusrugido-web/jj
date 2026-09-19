import React from 'react';
import {
  LayoutDashboard, Film, CreditCard, Users, Sliders, Megaphone, ArrowLeft, Link as LinkIcon,
  MessageCircle, TrendingUp, Gauge,
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

/* o que mexe no app vem primeiro; venda, rastreio e automação
   ficam juntos no fim, num grupo só deles */
const GRUPOS = [
  { id: 'plataforma', nome: 'Plataforma' },
  { id: 'vendas', nome: 'Vendas e automação' },
];

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
    id: 'medicao',
    nome: 'Medição',
    icone: Gauge,
    resumo: 'Se a recomendação vira vídeo assistido, o que é largado no meio e onde falta vídeo.',
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
    id: 'links',
    nome: 'Links',
    icone: LinkIcon,
    resumo: 'Para onde o app manda a pessoa: assinar, ver o anual, pedir suporte.',
  },
  {
    id: 'ajustes',
    nome: 'Números',
    icone: Sliders,
    resumo: 'Tamanho do grupo da liga, quantos sobem e descem, e os limites do plano grátis.',
  },
  {
    id: 'recado',
    nome: 'Recado',
    icone: Megaphone,
    resumo: 'O aviso que aparece no topo do app pra todo mundo.',
  },
  {
    id: 'vendas',
    nome: 'Vendas',
    grupo: 'vendas',
    icone: TrendingUp,
    resumo: 'Quanto entrou, de qual canal e de qual campanha. E os links rastreados pra divulgar.',
  },
  {
    id: 'recuperacao',
    nome: 'Recuperação',
    grupo: 'vendas',
    icone: MessageCircle,
    resumo: 'Quem chegou perto de pagar e não pagou, as mensagens de WhatsApp que recebe e quanto voltou pro caixa.',
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
          {GRUPOS.map((g) => (
            <React.Fragment key={g.id}>
              <div className="admin-grupo">{g.nome}</div>
              {SECOES.filter((x) => (x.grupo || 'plataforma') === g.id).map((x) => (
                <button
                  key={x.id}
                  className={`admin-item ${secao === x.id ? 'on' : ''}`}
                  onClick={() => onSecao(x.id)}
                >
                  <x.icone size={15} />
                  <span>{x.nome}</span>
                </button>
              ))}
            </React.Fragment>
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
