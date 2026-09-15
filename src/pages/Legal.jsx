import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Card, Btn } from '../components/UI';

/* ============================================================
   OS DOCUMENTOS

   Ficam dentro do app, em endereço próprio, pra poderem ser
   linkados de qualquer lugar e pra ninguém precisar sair do
   app pra ler o que aceitou.

   Escritos em português de gente. Documento que ninguém
   entende não protege ninguém, nem a pessoa nem você.
   ============================================================ */

const ATUALIZADO = '14 de setembro de 2026';
const CONTATO = 'batistavisuais@gmail.com';

export function Termos({ onVoltar }) {
  return (
    <Documento titulo="Termos de uso" onVoltar={onVoltar}>
      <Bloco titulo="O que é o NeuroJitsu">
        <p>
          É um caderno de treino de jiu-jitsu. Você registra o que aconteceu no tatame e o app organiza
          isso em números, gráficos e sugestões de estudo.
        </p>
      </Bloco>

      <Bloco titulo="O que ele não é">
        <p>
          Não é professor, não é médico e não é fisioterapeuta. As sugestões saem de cálculo em cima do
          que você registrou, não de alguém que te viu rolar.
        </p>
        <p>
          Quem corrige a sua técnica é o seu professor. Quem cuida de lesão é profissional de saúde. Se
          algo dói, procure um antes de voltar pro tatame.
        </p>
      </Bloco>

      <Bloco titulo="A sua conta">
        <p>
          Você pode usar o app sem conta nenhuma, e nesse caso tudo fica só no seu aparelho. Criando conta,
          os dados sincronizam entre os seus aparelhos.
        </p>
        <p>
          Você é responsável pela senha. Se suspeitar que alguém entrou, troque.
        </p>
      </Bloco>

      <Bloco titulo="Assinatura">
        <p>
          Registrar treino é grátis e continua grátis. A assinatura libera análise, sincronização e a
          leitura da IA.
        </p>
        <p>
          Se a assinatura vencer, você <b>não perde nada do que registrou</b>. Continua vendo e podendo
          baixar tudo. O que fica travado são os recursos de análise.
        </p>
        <p>
          O pagamento é processado pela Hotmart, e cancelamento e reembolso seguem as regras dela e o
          Código de Defesa do Consumidor.
        </p>
      </Bloco>

      <Bloco titulo="Conteúdo de terceiros">
        <p>
          As aulas em vídeo são do YouTube e pertencem a quem as publicou. O app apenas organiza e indica
          qual assistir. Não hospedamos nem vendemos esse conteúdo.
        </p>
      </Bloco>

      <Bloco titulo="Uso indevido">
        <p>
          Não tente burlar limites do plano, não use o app para automatizar cadastro em massa e não
          publique dado de outra pessoa sem que ela saiba.
        </p>
      </Bloco>

      <Bloco titulo="Mudanças">
        <p>
          Estes termos podem mudar. Se a mudança for relevante, você é avisado dentro do app antes de
          continuar usando.
        </p>
      </Bloco>

      <Bloco titulo="Falar com a gente">
        <p>Qualquer dúvida sobre estes termos, escreva para {CONTATO}.</p>
      </Bloco>
    </Documento>
  );
}

export function Privacidade({ onVoltar }) {
  return (
    <Documento titulo="Política de privacidade" onVoltar={onVoltar}>
      <Bloco titulo="Resumo em uma frase">
        <p>
          Os seus treinos são seus. Não vendemos, não trocamos e não mostramos pra ninguém sem você
          mandar.
        </p>
      </Bloco>

      <Bloco titulo="O que guardamos">
        <ul>
          <li>Nome e e-mail, se você criar conta.</li>
          <li>O que você registra: treinos, rolas, técnicas, metas, lesões e aulas vistas.</li>
          <li>Faixa, academia e professor, se você preencher.</li>
        </ul>
        <p>
          Sem conta, nada disso sai do seu aparelho. Com conta, fica guardado no Supabase, em servidor
          protegido por regra que só deixa você ler os seus próprios dados.
        </p>
      </Bloco>

      <Bloco titulo="O que não guardamos">
        <ul>
          <li>Dado de cartão. O pagamento inteiro acontece na Hotmart.</li>
          <li>Sua localização.</li>
          <li>Seus contatos, fotos ou qualquer coisa fora do app.</li>
        </ul>
      </Bloco>

      <Bloco titulo="Quem mais vê">
        <p>
          Ninguém, por padrão. Se você entrar na liga, aparecem para os outros participantes apenas o seu
          nome (ou o apelido que escolher), a sua faixa e quantos pontos fez na semana. Nada do que você
          registrou nos treinos.
        </p>
        <p>
          Se você usar a leitura da IA, os números do seu treino são enviados para o serviço que processa
          o texto. Vão números e nomes de técnica, não o seu nome nem o seu e-mail.
        </p>
      </Bloco>

      <Bloco titulo="Os seus direitos">
        <p>Pela Lei Geral de Proteção de Dados, você pode a qualquer momento:</p>
        <ul>
          <li>Ver tudo que está guardado sobre você.</li>
          <li>Corrigir o que estiver errado.</li>
          <li>Baixar os seus dados num arquivo.</li>
          <li>Apagar a conta e tudo que está nela.</li>
        </ul>
        <p>
          A exportação e a exclusão estão dentro do app, em Ajustes. Não precisa pedir para ninguém nem
          esperar resposta.
        </p>
      </Bloco>

      <Bloco titulo="Por quanto tempo">
        <p>
          Enquanto a sua conta existir. Apagando a conta, os dados vão junto, e a remoção nos backups
          acontece em até trinta dias.
        </p>
      </Bloco>

      <Bloco titulo="Menores de idade">
        <p>
          O app é feito para maiores de dezesseis anos. Quem tiver menos precisa do consentimento de um
          responsável.
        </p>
      </Bloco>

      <Bloco titulo="Falar com a gente">
        <p>Para qualquer pedido sobre os seus dados, escreva para {CONTATO}.</p>
      </Bloco>
    </Documento>
  );
}

function Documento({ titulo, onVoltar, children }) {
  return (
    <div className="page" style={{ maxWidth: 720 }}>
      <div className="page-head">
        <div>
          <div className="eyebrow">atualizado em {ATUALIZADO}</div>
          <h1 className="h-page">{titulo}</h1>
        </div>
        {onVoltar && <Btn icon={ArrowLeft} onClick={onVoltar}>Voltar</Btn>}
      </div>
      <Card>
        <div className="doc">{children}</div>
      </Card>
    </div>
  );
}

function Bloco({ titulo, children }) {
  return (
    <section>
      <h2 className="h-sec">{titulo}</h2>
      {children}
    </section>
  );
}

export default Termos;
