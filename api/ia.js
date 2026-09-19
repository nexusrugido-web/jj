/* Vercel Function — /api/ia
   A chave da Groq fica AQUI, no servidor. Nunca vai pro navegador.
   Configure na Vercel: Settings > Environment Variables > GROQ_API_KEY

   Ações:
   - validar_tecnica : usa busca web real (groq/compound) pra checar regra IBJJF
   - autopreencher   : preenche os campos da técnica só pelo nome
   - analisar        : lê o resumo do diário e sugere foco
   - plano_ataque    : gera uma árvore de ataque
   - revisar_dieta   : comenta um plano alimentar
   - revisar_treino  : comenta um programa de academia
   - classificar_videos : diz o que cada vídeo do acervo ensina, no
                          vocabulário de src/lib/vocab.js
*/

import { POSICOES, HABILIDADES, FORMATOS, NIVEIS, SITUACOES } from '../src/lib/vocab.js';

const GROQ = 'https://api.groq.com/openai/v1/chat/completions';

/* a lista que a IA pode usar, no formato "id (nome)" ou "id: descrição" */
const lista = (itens, comDesc = false) =>
  itens.map((x) => (comDesc && x.desc ? `${x.id}: ${x.desc}` : `${x.id} (${x.nome})`)).join('\n');

const MODELO_JSON = 'openai/gpt-oss-120b';
const MODELO_WEB = 'groq/compound';

const LIMITE = new Map(); // rate limit simples por IP

function podePassar(ip) {
  const agora = Date.now();
  const janela = 60_000;
  const max = 20;
  const reg = LIMITE.get(ip) || [];
  const recentes = reg.filter((t) => agora - t < janela);
  if (recentes.length >= max) return false;
  recentes.push(agora);
  LIMITE.set(ip, recentes);
  return true;
}

const PROMPTS = {
  ler_treino: (p) => ({
    modelo: MODELO_JSON,
    sistema: `Você lê o relato falado de um treino de jiu-jitsu brasileiro e transforma em dados.

A pessoa fala de forma natural, com repetição, pausa e correção. A transcrição pode vir com erro.
Entenda o sentido, não a letra.

Devolva SOMENTE o JSON, sem texto antes ou depois:
{
  "duracao": 60,
  "tipo": "gi",
  "academia": "nome ou vazio",
  "professor": "nome ou vazio",
  "nota": "o relato limpo, em primeira pessoa, sem repetição",
  "rolas": [
    {
      "parceiro": "nome ou vazio",
      "duracao": 5,
      "ptsMeus": ["queda", "passagem", "montada"],
      "ptsDele": ["raspagem"],
      "subsAplicadas": [],
      "subsSofridas": ["Chave de braço, armlock"]
    }
  ]
}

REGRAS DE INTERPRETAÇÃO

Quem é quem:
- "treinei com o professor X", "aula do X", "o mestre X" => professor
- "rolei com Y", "lutei com Y", "peguei o Y", "caí com o Y" => parceiro daquele rola
- "na academia Z", "lá no Z" => academia
- Se o nome estiver na lista de cadastrados, use exatamente como está lá, mesmo que a fala tenha
  escrito diferente. "ismael", "ismail", "ysmael" => o Ismael cadastrado.
- Cada parceiro citado é um rola diferente, a menos que a fala diga que foram vários com a mesma pessoa.

O que ele fez (ptsMeus) e o que sofreu (ptsDele):
- pontos válidos, use exatamente estes ids: queda, raspagem, joelho, passagem, montada, costas
- "ganhei a queda", "derrubei", "puxei ele pro chão" => ptsMeus: queda
- "passei a guarda", "passei por cima" => ptsMeus: passagem
- "cheguei na montada", "montei nele" => ptsMeus: montada
- "peguei as costas" => ptsMeus: costas
- "raspei ele" => ptsMeus: raspagem
- "tomei uma raspagem", "ele me raspou" => ptsDele: raspagem
- "ele me passou", "passou minha guarda" => ptsDele: passagem
- "ele me derrubou" => ptsDele: queda

Finalizações:
- "finalizei", "peguei", "bateu pra mim", "dei o tap nele" => subsAplicadas
- "fui finalizado", "bati", "tomei", "ele me pegou" => subsSofridas
- Use o nome da técnica como está na lista fornecida quando reconhecer. Senão use como foi falado.

Duração:
- Se não falar, use 60 para treino e 5 para cada rola.
- "uma hora" = 60, "hora e meia" = 90, "duas horas" = 120

Tipo:
- gi, nogi, drill, openmat ou competicao. Se não falar, gi.
- "sem kimono", "no gi" => nogi
- "campeonato", "competi", "torneio" => competicao

A nota:
- Reescreva o relato de forma limpa e em primeira pessoa, mantendo o que a pessoa sentiu e onde travou.
- NUNCA repita frases. Se a transcrição veio com eco, escreva uma vez só.
- Não invente nada que não foi dito.

Se não conseguir identificar nenhum rola, devolva "rolas": [].`,
    usuario: `Relato falado:
${p.texto}

Parceiros cadastrados: ${(p.parceiros || []).join(', ') || 'nenhum'}
Professores cadastrados: ${(p.professores || []).join(', ') || 'nenhum'}
Academias cadastradas: ${(p.academias || []).join(', ') || 'nenhuma'}
Técnicas conhecidas: ${(p.tecnicas || []).slice(0, 250).join(', ')}`,
  }),

  autopreencher: (p) => ({
    modelo: MODELO_JSON,
    json: true,
    system:
      'Você é um professor experiente de Jiu-Jitsu brasileiro. Responda SOMENTE com JSON válido, sem markdown, sem crases, sem texto antes ou depois. ' +
      'Schema: {"nomePt":string,"nomeEn":string,"categoria":string,"origem":string,"destino":string,"faixaMin":"branca"|"azul"|"roxa"|"marrom"|"preta","modo":"gi"|"nogi"|"ambos","restricao":string,"detalhes":string,"confianca":0-1}. ' +
      'categoria DEVE ser exatamente uma destas: Quedas, Passagens, Raspagens, Estrangulamentos, Chaves articulares, Chaves de perna, Escapadas, Transições, Retenção de guarda, Pegadas e controles, Defesas, Guardas e posições, Movimentos base. ' +
      'REGRA IMPORTANTE: se o nome for uma GUARDA ou POSIÇÃO (guarda aranha, X-guard, meia-guarda, montada, cem quilos, De La Riva, worm guard, tartaruga, ashi garami, 50/50, crucifixo...), a categoria é "Guardas e posições" — NUNCA "Pegadas e controles". ' +
      'Se for um movimento solo de deslocamento (fuga de quadril, ponte, rolamento, granby, sprawl), a categoria é "Movimentos base". ' +
      'origem e destino são OBRIGATÓRIOS e devem sair desta lista, escolhendo o mais próximo: ' +
      'De pé; Clinch; Pegada nas costas; Montada; Montada técnica; Crucifixo; Joelho na barriga; Cem quilos (por cima); Kesa gatame; Norte-sul; Meia-guarda por cima; Combatendo a guarda (por cima); Guarda fechada; Guarda aberta; Meia-guarda; Meia-guarda profunda; Guarda borboleta; De La Riva; De La Riva invertida; Guarda aranha; Guarda laçada (lasso); X-guard; Single leg X; Guarda sentada; Z-guard; Guarda 50/50; Ashi garami; Saddle; Tartaruga; Sob a meia-guarda; Sob os cem quilos; Sob o norte-sul; Sob o joelho na barriga; Sob a montada; Costas entregues; Finalização. ' +
      'Para uma GUARDA, origem e destino são a própria guarda. Para uma FINALIZAÇÃO, destino é "Finalização". ' +
      'faixaMin segue a regra IBJJF: chave de pé reta = branca; chave de pulso = azul; heel hook, toe hold, kneebar, calf slicer, bicep slicer, twister = marrom. Guardas e posições são sempre "branca" (estudar é livre). ' +
      'detalhes deve ter 2 a 4 frases com os pontos-chave da execução, em português do Brasil, tom direto de professor. ' +
      'restricao: aviso curto sobre legalidade, ou string vazia.',
    user: `Técnica ou posição: "${p.nome}". Contexto do praticante: faixa ${p.faixa || 'branca'}.`,
  }),

  validar_tecnica: (p) => ({
    modelo: MODELO_WEB,
    json: false,
    system:
      'Você é um árbitro e professor de Jiu-Jitsu. Consulte as regras atuais da IBJJF na web quando precisar. ' +
      'Responda em português do Brasil, no máximo 4 frases, tom direto. ' +
      'Comece com um veredito em MAIÚSCULA: LEGAL, ILEGAL ou ATENÇÃO. Depois explique por quê e cite a fonte encontrada.',
    user: `Um praticante FAIXA ${String(p.faixa || 'branca').toUpperCase()} cadastrou a técnica "${p.nome}" ${p.modo === 'nogi' ? 'para No-Gi' : p.modo === 'gi' ? 'para Gi' : '(gi e no-gi)'}. Essa técnica é permitida para essa faixa nas regras atuais da IBJJF? Se for uma chave de perna, seja bem específico.`,
  }),

  analisar: (p) => ({
    modelo: MODELO_JSON,
    json: true,
    system:
      'Você é um professor de Jiu-Jitsu analisando o diário de treino de um aluno. Responda SOMENTE JSON válido. ' +
      'Schema: {"leitura":string,"focos":[{"titulo":string,"porque":string,"comoTreinar":string}],"pergunta":string}. ' +
      'leitura: 2-3 frases resumindo o que os números mostram. focos: 2 a 3 itens. ' +
      'comoTreinar deve sugerir sparring posicional concreto. pergunta: uma pergunta pro aluno levar ao professor dele. ' +
      'Português do Brasil, tom de professor direto e encorajador, sem enrolação. Nunca invente dados que não estão no resumo.',
    user: `Resumo do aluno (faixa ${p.faixa || 'branca'}):\n${JSON.stringify(p.resumo)}`,
  }),

  plano_ataque: (p) => ({
    modelo: MODELO_JSON,
    json: true,
    system:
      'Você é um professor de Jiu-Jitsu montando um plano de ataque encadeado. Responda SOMENTE JSON válido. ' +
      'Schema: {"nome":string,"resumo":string,"aviso":string,"passos":[{"gatilho":string,"acao":string,"seFalhar":string,"proxima":string,"detalhe":string}]}. ' +
      'Entre 3 e 5 passos. Cada passo encadeia com a reação do oponente. ' +
      'Respeite a legalidade IBJJF da faixa informada: faixa branca só pode chave de pé reta; nada de heel hook, toe hold, kneebar até marrom. ' +
      'Se algo for ilegal para a faixa, coloque no campo aviso. Português do Brasil, direto.',
    user: `Monte um plano de ataque a partir da posição "${p.posicao}" para um praticante faixa ${p.faixa || 'branca'}, modalidade ${p.modo || 'ambos'}. ${p.contexto ? 'Contexto extra: ' + p.contexto : ''}`,
  }),

  revisar_dieta: (p) => ({
    modelo: MODELO_JSON,
    json: true,
    system:
      'Você é um educador em nutrição esportiva. Responda SOMENTE JSON válido. ' +
      'Schema: {"leitura":string,"pontos":[{"nivel":"bom"|"atencao"|"ruim","titulo":string,"texto":string}],"sugestoes":[string],"ressalva":string}. ' +
      'Baseie-se em diretrizes gerais (1,6–2,2 g de proteína por kg; fibra ~14g/1000kcal; gordura 20–35% das calorias). ' +
      'NÃO prescreva dieta individual. ressalva deve dizer que isso é orientação geral e não substitui nutricionista. ' +
      'Português do Brasil, prático, sem moralismo com comida.',
    user: `Perfil e plano do dia:\n${JSON.stringify(p.dados)}`,
  }),

  /* ------------------------------------------------------------
     Até 6 vídeos por chamada. A resposta passa por
     src/lib/classificar.js antes de ir pro banco: id fora da lista
     é jogado fora, e a certeza dela não é a última palavra.
     ------------------------------------------------------------ */
  classificar_videos: (p) => ({
    modelo: MODELO_JSON,
    json: true,
    esforco: 'low',
    maxTokens: 4000,
    system:
`Você classifica aulas de jiu-jitsu brasileiro do canal Neuro Jitsu, que ensina a lógica do jiu-jitsu, a maioria pra faixa branca e azul.
Pra cada vídeo você recebe título, descrição do YouTube, etiquetas e duração. Diga o que ele ensina usando SÓ os ids das listas. Id fora da lista é descartado.

POSIÇÕES, no formato "posicao:lado". O lado é o de QUEM ASSISTE e vai usar a aula:
- baixo = quem está embaixo ou joga guarda. "cem:baixo" ensina sair ou defender embaixo do 100kg; "guarda_fechada:baixo" ensina quem joga a guarda.
- cima = quem está por cima ou tenta passar. "cem:cima" ensina controlar no 100kg; "guarda_fechada:cima" ensina abrir e passar a guarda fechada.
- neutro = vale pros dois lados, ou a posição não tem lado (em pé, 50/50).
Só marque posição que o vídeo trata. Aula de conceito geral pode ficar sem posição.
${lista(POSICOES)}

HABILIDADES (uma ou mais):
${lista(HABILIDADES)}

FORMATO (um só):
${lista(FORMATOS, true)}

NÍVEL (um só, ou null se não der pra saber):
${lista(NIVEIS, true)}

SITUAÇÕES de quem assiste. Marque sempre que o título ou a descrição tocar no problema (força, peso, gás, não saber o que fazer, esquecer a técnica, competir):
${lista(SITUACOES, true)}

TÉCNICAS: as que o título ou a descrição citam pelo nome, como se fala no tatame ("armlock", "triângulo", "kimura", "arm drag", "raspagem de tesoura"). Não invente técnica que não foi citada.

QUASE TODO SHORT VEM SEM DESCRIÇÃO. Quando o título já diz o assunto, classifique pelo título e dê certeza alta. Hashtag (#bjj, #jiujitsu) não é assunto.
Exemplos:
"Como sair da 100kg #bjj" => posicoes ["cem:baixo"], habilidades ["escapada"], formato "tecnica", certeza 0.8
"A lógica da raspagem tesourinha" => posicoes ["guarda_fechada:baixo"], habilidades ["raspagem"], formato "conceito", tecnicas ["raspagem de tesoura"], certeza 0.85
"Jiu-jitsu sem força: aprenda isso" => habilidades ["fisico"], formato "conceito", situacoes ["menos_forca"], certeza 0.8
"Como lutar contra alguém mais pesado" => formato "conceito", situacoes ["contra_pesado"], certeza 0.8

certeza: de 0 a 1. Abaixo de 0.6 só quando nem o título nem a descrição dizem o assunto (só uma data, "testando", pedido de comentário). Aí deixe as listas vazias e diga a dúvida em uma frase em "duvida".

Responda SOMENTE JSON, com um item por vídeo recebido, na mesma ordem:
{"videos":[{"id":"...","posicoes":["cem:baixo"],"habilidades":["escapada"],"formato":"tecnica","nivel":"fundamento","situacoes":[],"tecnicas":["fuga de quadril"],"certeza":0.85,"duvida":""}]}`,
    user: JSON.stringify((p.videos || []).slice(0, 6).map((v) => ({
      id: v.id,
      titulo: String(v.titulo || '').slice(0, 200),
      descricao: String(v.descricao || '').slice(0, 700),
      etiquetas: (v.tags || []).slice(0, 12),
      duracao_segundos: v.duracao,
    }))),
  }),

  revisar_treino: (p) => ({
    modelo: MODELO_JSON,
    json: true,
    system:
      'Você é um educador em treinamento de força para atletas de grappling. Responda SOMENTE JSON válido. ' +
      'Schema: {"leitura":string,"pontos":[{"nivel":"bom"|"atencao"|"ruim","titulo":string,"texto":string}],"sugestoes":[string],"ressalva":string}. ' +
      'Considere: 10–20 séries semanais por grupo; 2–3 sessões de força pra quem treina BJJ 3–5x; equilíbrio empurrar/puxar; pescoço e pegada importam no BJJ; ' +
      'grip pesado nunca antes de rolar; fadiga concorrente. NÃO prescreva individualmente. ' +
      'ressalva deve dizer que não substitui educador físico. Português do Brasil.',
    user: `Programa e contexto:\n${JSON.stringify(p.dados)}`,
  }),
};

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Use POST.' });

  const key = process.env.GROQ_API_KEY;
  if (!key) {
    return res.status(503).json({
      erro: 'IA não configurada.',
      dica: 'Adicione GROQ_API_KEY nas variáveis de ambiente da Vercel e faça um novo deploy.',
    });
  }

  const ip = (req.headers['x-forwarded-for'] || 'anon').split(',')[0].trim();
  if (!podePassar(ip)) return res.status(429).json({ erro: 'Muitas chamadas seguidas. Espera um minuto.' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const { acao, ...params } = body || {};

  const build = PROMPTS[acao];
  if (!build) return res.status(400).json({ erro: `Ação desconhecida: ${acao}` });

  const cfg = build(params);

  try {
    const r = await fetch(GROQ, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: cfg.modelo,
        temperature: cfg.json ? 0.3 : 0.4,
        max_tokens: cfg.maxTokens || 1800,
        ...(cfg.esforco ? { reasoning_effort: cfg.esforco } : {}),
        messages: [
          { role: 'system', content: cfg.system },
          { role: 'user', content: cfg.user },
        ],
        ...(cfg.json ? { response_format: { type: 'json_object' } } : {}),
      }),
    });

    if (!r.ok) {
      const t = await r.text();
      /* 429 passa como 429: a esteira do acervo espera e tenta de
         novo, em vez de marcar o vídeo como erro */
      return res.status(r.status === 429 ? 429 : 502).json({ erro: 'A Groq recusou a chamada.', detalhe: t.slice(0, 400) });
    }

    const data = await r.json();
    const blocos = data?.choices?.[0]?.message?.content || '';
    const texto = String(blocos).replace(/```json|```/g, '').trim();

    if (cfg.json) {
      try {
        return res.status(200).json({ ok: true, dados: JSON.parse(texto) });
      } catch {
        return res.status(200).json({ ok: true, texto, aviso: 'A IA não devolveu JSON válido.' });
      }
    }
    return res.status(200).json({ ok: true, texto });
  } catch (e) {
    return res.status(500).json({ erro: 'Falha ao falar com a IA.', detalhe: String(e?.message || e) });
  }
}
