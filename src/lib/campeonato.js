import { diasEntre } from './utils';

/* ============================================================
   O MODO CAMPEONATO

   A meta de campeonato vira uma preparação até o dia da luta:
   contagem, checklist, plano de peso e reta final.

   O PESO
   Os limites são os da IBJJF para adulto e master (tabela oficial,
   conferida em 01/10/2026). No gi a pesagem é DE KIMONO: a conta
   soma ~2 kg de kimono ao peso da pessoa. No no-gi, não.
   O ritmo seguro de perda usado aqui é até 1% do peso por semana;
   acima disso o app avisa e sugere a categoria de cima. Não é
   prescrição: é o alerta pra pessoa não cortar peso no escuro.
   ============================================================ */
export const KIMONO_KG = 2;

export const LIMITES_PESO = {
  gi: {
    masculino: { Galo: 57.5, Pluma: 64, Pena: 70, Leve: 76, 'Médio': 82.3, 'Meio-pesado': 88.3, Pesado: 94.3, 'Super-pesado': 100.5, 'Pesadíssimo': null },
    feminino: { Galo: 48.5, Pluma: 53.5, Pena: 58.5, Leve: 64, 'Médio': 69, 'Meio-pesado': 74, Pesado: 79.3, 'Super-pesado': null },
  },
  nogi: {
    masculino: { Galo: 55.5, Pluma: 61.5, Pena: 67.5, Leve: 73.5, 'Médio': 79.5, 'Meio-pesado': 85.5, Pesado: 91.5, 'Super-pesado': 97.5, 'Pesadíssimo': null },
    feminino: { Galo: 46.5, Pluma: 51.5, Pena: 56.5, Leve: 61.5, 'Médio': 66.5, 'Meio-pesado': 71.5, Pesado: 76.5, 'Super-pesado': null },
  },
};

export const categoriasDe = (modalidade = 'gi', sexo = 'masculino') => Object.keys(LIMITES_PESO[modalidade]?.[sexo] || {});

/* a categoria em que o peso de hoje cabe */
export function categoriaDoPeso(peso, modalidade = 'gi', sexo = 'masculino') {
  const tabela = LIMITES_PESO[modalidade]?.[sexo] || {};
  const naPesagem = Number(peso) + (modalidade === 'gi' ? KIMONO_KG : 0);
  return Object.entries(tabela).find(([, lim]) => lim == null || naPesagem <= lim)?.[0] || null;
}

export function planoDePeso({ peso, categoria, modalidade = 'gi', sexo = 'masculino', hoje, data }) {
  const p = Number(String(peso ?? '').replace(',', '.'));
  const tabela = LIMITES_PESO[modalidade]?.[sexo] || {};
  if (!p || !categoria || !(categoria in tabela)) return null;
  const limite = tabela[categoria];
  const dias = Math.max(0, diasEntre(hoje, data));
  if (limite == null) return { status: 'semLimite', limite: null, dias };
  const naPesagem = p + (modalidade === 'gi' ? KIMONO_KG : 0);
  const falta = Math.round((naPesagem - limite) * 10) / 10;
  if (falta <= 0) return { status: 'dentro', limite, folga: -falta, dias, naPesagem };
  const semanas = Math.max(dias / 7, 1 / 7);
  const porSemana = Math.round((falta / semanas) * 10) / 10;
  const seguro = Math.round(p * 0.01 * 10) / 10;
  const perigoso = porSemana > seguro;
  return {
    status: perigoso ? 'perigoso' : 'cortar',
    limite, falta, dias, porSemana, seguro, naPesagem,
    sugestao: perigoso ? categoriaDoPeso(p, modalidade, sexo) : null,
  };
}

/* a reta final muda com o tempo que falta */
export function retaFinal(dias) {
  if (dias <= 1) return 'Dorme cedo, confere a pesagem e o horário da luta. Hoje não é dia de aprender nada.';
  if (dias <= 3) return 'Pega leve no treino, cuida do peso e da hidratação. Só repete o que já sai fácil.';
  if (dias <= 7) return 'Última semana: treina o que já funciona. Nada de técnica nova agora.';
  if (dias <= 21) return 'Semanas de afiar o jogo: rola valendo, começando de onde você mais ganha.';
  return 'Tem tempo: monta o plano de luta em volta das técnicas que já entram.';
}
