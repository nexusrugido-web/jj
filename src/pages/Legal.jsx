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

const ATUALIZADO = '6 de outubro de 2026';
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
          Registrar treino é grátis e continua grátis, e a conta sincroniza entre os seus aparelhos
          também de graça. A assinatura Premium libera as análises (gráficos, Meu jogo por situação,
          relatório do mês, raio-x dos parceiros), a leitura da IA, registrar falando e os limites maiores.
        </p>
        <p>
          Se a assinatura vencer, você <b>não perde nada do que registrou</b>. Continua vendo e podendo
          baixar tudo. O que fica travado são os recursos de análise.
        </p>
        <p>
          O pagamento é processado pela Hotmart ou pela Getfy, conforme o link que você usar, e
          cancelamento e reembolso seguem as regras de quem processou e o Código de Defesa do Consumidor.
        </p>
        <p>
          No primeiro treino registrado com conta, você ganha 7 dias de Premium de presente. O presente
          acaba sozinho, sem cobrança e sem pedir cartão.
        </p>
      </Bloco>

      <Bloco titulo="Conteúdo de terceiros">
        <p>
          As aulas em vídeo são do YouTube e pertencem a quem as publicou. O app apenas organiza e indica
          qual assistir. Não hospedamos nem vendemos esse conteúdo.
        </p>
      </Bloco>

      <Bloco titulo="Avisos no celular">
        <p>
          Se você ligar os avisos, o app manda no máximo um por dia (a reta final da ofensiva e da liga,
          domingo à noite, são a exceção), nunca entre 22h e 8h. Dá pra desligar quando quiser, em Ajustes
          ou nas configurações do celular.
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
          <li>Faixa, academia, professor e parceiros de treino, se você preencher.</li>
          <li>Peso e o que você registrar em Nutrição, Lesões e Força, se usar essas partes.</li>
          <li>A foto de perfil, se você colocar uma.</li>
          <li>O ano em que você nasceu (só o ano): a regra das técnicas e a divisão de campeonato mudam com a idade.</li>
          <li>
            Como você usa o Estudo: que aulas o app te recomendou, quais você abriu e terminou. Serve pra
            melhorar as recomendações e saber que aula falta gravar, e a equipe só vê isso em números somados,
            nunca o de uma pessoa.
          </li>
          <li>
            Se você ligar os avisos, o endereço de aviso do seu aparelho (gerado pelo navegador, não é o seu
            número) e o seu fuso horário, pra o aviso chegar na hora certa. E se você abriu cada aviso.
          </li>
          <li>
            Se você comprar: nome, e-mail, telefone e a situação da compra, que a Hotmart ou a Getfy nos
            enviam pra liberar o Premium. Se uma compra ficar pela metade, podemos mandar uma mensagem de
            WhatsApp pra esse telefone lembrando de concluir.
          </li>
          <li>Quando você abre a oferta do Premium e de qual tela veio, em números somados.</li>
          <li>
            Quando o app dá erro, um relatório técnico do erro (tela, versão, aparelho) pra gente consertar.
            Não vai o conteúdo dos seus treinos.
          </li>
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
          A liga. Quando você registra um treino na semana, entra num grupo pequeno de praticantes, e quem
          está no seu grupo vê: o seu primeiro nome com a inicial do sobrenome (ou o apelido que escolher, ou
          só "Anônimo"), a sua foto, se você colocar uma (no modo Anônimo ela não aparece), a sua faixa, a sua divisão na liga, quantas vezes por semana você disse que treina,
          a sua ofensiva (sequência de semanas com treino, preservada por pausas e escudos) e os pontos que fez na semana. Nada do que
          você registrou nos treinos. Dá pra escolher como aparecer e sair da liga quando quiser, na tela Liga; a
          saída vale a partir da
          semana seguinte.
        </p>
        <p>
          A sala. Se você criar ou entrar numa sala com amigos, quem está nela vê o mesmo que o grupo da liga, e quem
          recebe o seu link de convite vê o seu nome público e quantas pessoas estão na sala. Dá pra sair quando
          quiser, valendo a partir da semana seguinte.
        </p>
        <p>
          Os amigos. Amizade só existe quando os dois aceitam. Um amigo vê o seu nome público, a foto, a faixa, a
          ofensiva e os pontos da semana, mesmo quando vocês não estão no mesmo grupo, e pode te chamar pra sala dele.
          Dá pra desfazer a amizade quando quiser.
        </p>
        <p>
          A IA. Se você usar a leitura da IA ou registrar falando, o que é preciso pra montar a resposta vai
          pra Groq, o serviço que roda a IA: os números e as técnicas do treino e, no registro falado, o
          áudio (pra virar texto), o texto e os nomes dos parceiros, professores e academias que você
          cadastrou (pra reconhecer quem é quem). Não vai o seu e-mail. O áudio não fica guardado: vira
          texto e é descartado.
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
          Jiu-jitsu é pra criança também: o app pode ser usado a partir dos oito anos. Quem tiver menos de
          dezesseis precisa que um responsável acompanhe e autorize, e o app pergunta isso no primeiro acesso.
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
