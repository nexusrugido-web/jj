/* Linter de copy: falha o build se o texto soar como IA */
import fs from 'fs'; import path from 'path';

const PROIBIDOS = [
  { re: /[\u2014]/g, nome: 'travessão (—)' },
  { re: /\bconfian[çc]a\s*\d/gi, nome: 'jargão: confiança com número' },
  { re: /\bamostra\b/gi, nome: 'jargão: amostra' },
  { re: /\blimiar\b/gi, nome: 'jargão: limiar' },
  { re: /\bscore\b/gi, nome: 'jargão: score' },
  { re: /\bbayesian/gi, nome: 'jargão: bayesiano' },
  { re: /\bWilson\b/g, nome: 'jargão: Wilson' },
  { re: /\bintervalo de confian/gi, nome: 'jargão estatístico' },
  { re: /\bCem quilos\b/g, nome: '"Cem quilos" em vez de 100kg' },

  /* No jiu-jitsu se diz "o rola", masculino. */
  { re: /\b(a|da|na|uma|essa|nessa|primeira|última) rola\b/gi, nome: '"rola" no feminino' },
  { re: /\b(as|das|nas|essas|quantas|poucas|muitas|duas) rolas\b/gi, nome: '"rolas" no feminino' },
  { re: /\brolas? (registrada|completa)s?\b/gi, nome: '"rola" concordando no feminino' },
  { re: /\b(suas|numa) rolas?\b|\brolas? suas?\b/gi, nome: '"rola" no feminino (suas rolas, numa rola)' },
  { re: /\b(nenhuma|toda|todas|outra|outras|mesma|mesmas|desta|dessa|nesta|pela|pelas|minha|minhas|nossa|boa|boas|nova|novas|primeiras|aquela) rolas?\b/gi, nome: '"rola" no feminino (nenhuma rola, toda rola, desta rola)' },
  { re: /\brolas? (antigas?|vivas?|vencidas|perdidas|registradas|marcadas|feitas|seguidas|boas|novas)\b/gi, nome: '"rola" concordando no feminino (rolas antigas, rola viva)' },

  /* Texto que justifica decisão de produto em vez de ajudar o aluno.
     Ninguém abre o app querendo saber por que a equipe removeu algo. */
  { re: /de prop[óo]sito/gi, nome: 'justifica decisão: "de propósito"', soTela: true },
  { re: /\bPreferimos\b/gi, nome: 'justifica decisão: "preferimos"', soTela: true },
  { re: /\bTiramos\b|\bremovemos\b|\bretiramos\b/gi, nome: 'justifica decisão: fala do que foi removido', soTela: true },
  { re: /Esta tela tinha|Tinha aqui|antes existia|antes havia/gi, nome: 'justifica decisão: conta o que tinha antes', soTela: true },
  { re: /n[ãa]o [ée] aplicativo de|n[ãa]o [ée] um app de/gi, nome: 'comparação que o aluno não faria', soTela: true },
  { re: /o app n[ãa]o vai competir|o app n[ãa]o tem como/gi, nome: 'fala do app em vez do aluno', soTela: true },

  /* Vocabulário de IA e de corporação. O app fala como gente de tatame.
     "Alavanca" do armlock pode; o verbo corporativo "alavancar", não. */
  { re: /\bmergulh(ar|e|ando|amos)\b/gi, nome: 'voz de IA: mergulhar', soTela: true },
  { re: /\bjornada\b/gi, nome: 'voz de IA: jornada', soTela: true },
  { re: /\balavanc(ar|ando|amos|ou)\b/gi, nome: 'voz corporativa: alavancar', soTela: true },
  { re: /\bademais\b/gi, nome: 'voz professoral: ademais', soTela: true },
  { re: /\bcontudo\b/gi, nome: 'voz professoral: contudo', soTela: true },
  { re: /\bexplor(ar|e|ando|amos)\b/gi, nome: 'voz de IA: explorar', soTela: true },
  { re: /\bpotencializ/gi, nome: 'voz corporativa: potencializar', soTela: true },
  { re: /\bdesbloque(ar|ie) (todo o )?(seu )?potencial/gi, nome: 'voz de IA: desbloquear potencial', soTela: true },

  /* O plano pago é nome próprio: "Premium", sempre com maiúscula. */
  { re: /\b([Oo]|[Nn]o|[Dd]o|[Pp]ro|[Aa]o|com o|ver o|liberar o|· ) ?premium\b(?!\s*[:=?(.])/g, nome: '"Premium" com minúscula' },
];

const arquivos = [];
(function w(d){for(const f of fs.readdirSync(d)){const p=path.join(d,f);
  if(fs.statSync(p).isDirectory())w(p); else if(/\.(jsx?)$/.test(f))arquivos.push(p);}})('src');

let total = 0;
const porArquivo = {};
for (const a of arquivos) {
  /* linhas com a marca abaixo saem da checagem, serve pro código
     que precisa citar o termo antigo para migrar dados */
  const s = fs.readFileSync(a, 'utf8')
    .split('\n')
    .filter((l) => !l.includes('lint-copy-ok'))
    .join('\n');
  const ehTela = a.endsWith('.jsx');
  for (const p of PROIBIDOS) {
    /* as regras de copy defensiva só valem pras telas.
       Comentário de engenharia dentro da lib pode explicar
       decisão técnica à vontade. */
    if (p.soTela && !ehTela) continue;
    const m = s.match(p.re);
    if (m) {
      porArquivo[a] = porArquivo[a] || [];
      porArquivo[a].push(`${p.nome} (${m.length}x)`);
      total += m.length;
    }
  }
}
for (const [a, probs] of Object.entries(porArquivo)) console.log(`  ${a}\n    ${probs.join(' · ')}`);
console.log(total ? `\n${total} ocorrência(s) a corrigir` : 'copy limpa');
process.exit(total ? 1 : 0);
