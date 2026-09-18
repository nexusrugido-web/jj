/* ============================================================
   BAIXAR COMO PLANILHA

   O painel entrega as listas (carrinhos, vendas) num CSV que o
   Excel e o Google Planilhas abrem direto. O BOM na frente faz o
   Excel ler acento certo, e o ponto e vírgula é o separador que
   ele espera no Brasil.
   ============================================================ */

const celula = (v) => {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function baixarPlanilha(nome, colunas, linhas) {
  const topo = colunas.map(([, titulo]) => celula(titulo)).join(';');
  const corpo = linhas.map((l) => colunas.map(([chave]) => celula(typeof chave === 'function' ? chave(l) : l[chave])).join(';'));
  const blob = new Blob(['\ufeff' + [topo, ...corpo].join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${nome}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
