import { diasUteisEntre, ehDiaUtil, somarDias, somarDiasUteis } from "./datas.ts";
import type { Atividade, DataISO, Etapa, ModeloItem } from "./tipos.ts";

/** A própria data, se for dia útil; senão a segunda-feira seguinte. */
function proximoDiaUtil(data: DataISO): DataISO {
  let atual = data;
  while (!ehDiaUtil(atual)) atual = somarDias(atual, 1);
  return atual;
}

/** Prazo calculado pelo SLA (data de início + N dias úteis). */
export function prazoSla(etapa: Etapa): DataISO | null {
  if (!etapa.dataInicio || etapa.slaDiasUteis == null) return null;
  return somarDiasUteis(etapa.dataInicio, etapa.slaDiasUteis);
}

/** Prazo que vale para a etapa: o manual, ou o do SLA. */
export function prazoEfetivo(etapa: Etapa): DataISO | null {
  return etapa.prazo ?? prazoSla(etapa);
}

export function predecessorasPendentes(etapa: Etapa, etapas: Etapa[]): Etapa[] {
  return etapa.predecessoras
    .map((id) => etapas.find((e) => e.id === id))
    .filter((e): e is Etapa => !!e && e.status !== "Concluída");
}

export type Situacao =
  | { tipo: "concluida-no-prazo" }
  | { tipo: "concluida-com-atraso"; dias: number }
  | { tipo: "concluida" }
  | { tipo: "bloqueada"; por: { id: string; titulo: string }[] }
  | { tipo: "atrasada"; dias: number }
  | { tipo: "vence-hoje" }
  | { tipo: "no-prazo"; dias: number }
  | { tipo: "sem-prazo" };

export function situacaoEtapa(etapa: Etapa, etapas: Etapa[], dataHoje: DataISO): Situacao {
  const prazo = prazoEfetivo(etapa);

  if (etapa.status === "Concluída") {
    if (!prazo || !etapa.dataConclusao) return { tipo: "concluida" };
    const atraso = diasUteisEntre(prazo, etapa.dataConclusao);
    return atraso > 0
      ? { tipo: "concluida-com-atraso", dias: atraso }
      : { tipo: "concluida-no-prazo" };
  }

  const pendentes = predecessorasPendentes(etapa, etapas);
  if (pendentes.length > 0 && etapa.status === "A fazer") {
    return { tipo: "bloqueada", por: pendentes };
  }

  if (!prazo) return { tipo: "sem-prazo" };
  if (prazo === dataHoje) return { tipo: "vence-hoje" };
  if (prazo < dataHoje) return { tipo: "atrasada", dias: Math.max(1, diasUteisEntre(prazo, dataHoje)) };
  return { tipo: "no-prazo", dias: diasUteisEntre(dataHoje, prazo) };
}

export function estaAtrasada(etapa: Etapa, etapas: Etapa[], dataHoje: DataISO): boolean {
  return situacaoEtapa(etapa, etapas, dataHoje).tipo === "atrasada";
}

/** IDs que dependem (direta ou indiretamente) da etapa — não podem virar predecessoras dela. */
export function dependentes(etapaId: string, etapas: Etapa[]): Set<string> {
  const resultado = new Set<string>();
  const fila = [etapaId];
  while (fila.length > 0) {
    const atual = fila.shift()!;
    for (const e of etapas) {
      if (e.predecessoras.includes(atual) && !resultado.has(e.id)) {
        resultado.add(e.id);
        fila.push(e.id);
      }
    }
  }
  return resultado;
}

export function etapasDaAtividade(atividadeId: string, etapas: Etapa[]): Etapa[] {
  return etapas
    .filter((e) => e.atividadeId === atividadeId)
    .sort((a, b) => a.ordem - b.ordem || a.id.localeCompare(b.id));
}

export function progressoAtividade(atividadeId: string, etapas: Etapa[]): number {
  const lista = etapasDaAtividade(atividadeId, etapas);
  if (lista.length === 0) return 0;
  const concluidas = lista.filter((e) => e.status === "Concluída").length;
  return Math.round((concluidas / lista.length) * 100);
}

export function atividadeAtrasada(atividade: Atividade, dataHoje: DataISO): boolean {
  return atividade.status !== "Concluída" && !!atividade.prazo && atividade.prazo < dataHoje;
}

/** Próximo ID sequencial com prefixo, ex.: "E-007". */
export function proximoId(prefixo: string, ids: string[]): string {
  const maior = ids.reduce((max, id) => {
    const m = new RegExp(`^${prefixo}-(\\d+)$`).exec(id);
    return m ? Math.max(max, Number(m[1])) : max;
  }, 0);
  return `${prefixo}-${String(maior + 1).padStart(3, "0")}`;
}

// ---------- Fluxos de trabalho ----------

/** Itens de um modelo, na ordem em que aparecem na configuração. */
export function itensDoModelo(modeloId: string, itens: ModeloItem[]): ModeloItem[] {
  return itens
    .filter((i) => i.modeloId === modeloId)
    .sort((a, b) => a.ordem - b.ordem || a.id.localeCompare(b.id));
}

export function atividadesDoFluxo(fluxoId: string, atividades: Atividade[]): Atividade[] {
  return atividades
    .filter((a) => a.fluxoId === fluxoId)
    .sort((a, b) => a.ordem - b.ordem || a.id.localeCompare(b.id));
}

export function progressoFluxo(fluxoId: string, atividades: Atividade[]): number {
  const lista = atividadesDoFluxo(fluxoId, atividades);
  if (lista.length === 0) return 0;
  const concluidas = lista.filter((a) => a.status === "Concluída").length;
  return Math.round((concluidas / lista.length) * 100);
}

/** IDs que dependem (direta ou indiretamente) do item — não podem virar predecessoras dele. */
export function dependentesDoItem(itemId: string, itens: ModeloItem[]): Set<string> {
  const resultado = new Set<string>();
  const fila = [itemId];
  while (fila.length > 0) {
    const atual = fila.shift()!;
    for (const i of itens) {
      if (i.predecessoras.includes(atual) && !resultado.has(i.id)) {
        resultado.add(i.id);
        fila.push(i.id);
      }
    }
  }
  return resultado;
}

export interface DatasSugeridas {
  dataInicio: DataISO;
  prazo: DataISO;
}

/**
 * Datas sugeridas para cada item selecionado, a partir do início do fluxo.
 *
 * Um item sem predecessoras começa no dia do início do fluxo. Um item com
 * predecessoras começa no primeiro dia útil após o prazo da última delas —
 * predecessoras desmarcadas são ignoradas, e a cadeia se liga em quem sobrou.
 * O prazo é o início mais o SLA em dias úteis; sem SLA, dura um dia.
 */
export function datasDoFluxo(
  itens: ModeloItem[],
  inicioDoFluxo: DataISO,
  selecionados: ReadonlySet<string>,
): Map<string, DatasSugeridas> {
  const porId = new Map(itens.map((i) => [i.id, i]));
  const datas = new Map<string, DatasSugeridas>();

  // Predecessoras desmarcadas são substituídas pelas predecessoras delas, para
  // que desmarcar um item no meio não solte os seguintes no início do fluxo.
  function efetivas(item: ModeloItem, vistos = new Set<string>()): string[] {
    return item.predecessoras.flatMap((id) => {
      if (vistos.has(id)) return [];
      vistos.add(id);
      if (selecionados.has(id)) return [id];
      const pred = porId.get(id);
      return pred ? efetivas(pred, vistos) : [];
    });
  }

  function calcular(item: ModeloItem, emCurso: Set<string>): DatasSugeridas {
    const jaFeito = datas.get(item.id);
    if (jaFeito) return jaFeito;

    // Ciclo (não deveria acontecer, a configuração bloqueia): trata como sem predecessora.
    const predecessoras = emCurso.has(item.id) ? [] : efetivas(item);
    emCurso.add(item.id);

    let dataInicio = inicioDoFluxo;
    for (const id of predecessoras) {
      const pred = porId.get(id);
      if (!pred) continue;
      const depois = proximoDiaUtil(somarDias(calcular(pred, emCurso).prazo, 1));
      if (depois > dataInicio) dataInicio = depois;
    }
    dataInicio = proximoDiaUtil(dataInicio);

    const resultado: DatasSugeridas = {
      dataInicio,
      prazo: somarDiasUteis(dataInicio, item.slaDiasUteis ?? 1),
    };
    datas.set(item.id, resultado);
    emCurso.delete(item.id);
    return resultado;
  }

  for (const item of itens) {
    if (selecionados.has(item.id)) calcular(item, new Set());
  }
  // Itens desmarcados entram no cálculo como apoio da cadeia, mas não no resultado.
  for (const id of [...datas.keys()]) {
    if (!selecionados.has(id)) datas.delete(id);
  }
  return datas;
}

/**
 * Ordena os itens seguindo as derivações: cada atividade vem logo depois da que
 * ela espera, com o ramo inteiro junto, e quem não depende de ninguém entra na
 * ordem atual. Uma atividade com várias predecessoras só entra depois da última.
 */
export function ordenarPorDependencia(itens: ModeloItem[]): ModeloItem[] {
  const existentes = new Set(itens.map((i) => i.id));
  const naOrdem = [...itens].sort((a, b) => a.ordem - b.ordem || a.id.localeCompare(b.id));
  const colocados = new Set<string>();
  const resultado: ModeloItem[] = [];

  const pendentes = (item: ModeloItem) =>
    item.predecessoras.filter((p) => existentes.has(p) && !colocados.has(p));

  function emitir(item: ModeloItem) {
    resultado.push(item);
    colocados.add(item.id);
    // Logo em seguida, os ramos que saem desta atividade.
    for (const filho of naOrdem) {
      if (!colocados.has(filho.id) && filho.predecessoras.includes(item.id) && pendentes(filho).length === 0) {
        emitir(filho);
      }
    }
  }

  let restam = naOrdem.length;
  while (colocados.size < restam) {
    const proximo = naOrdem.find((i) => !colocados.has(i.id) && pendentes(i).length === 0);
    // Nenhum pronto significa ciclo (a configuração impede): segue pela ordem atual.
    const escolhido = proximo ?? naOrdem.find((i) => !colocados.has(i.id));
    if (!escolhido) break;
    emitir(escolhido);
    restam = naOrdem.length;
  }
  return resultado;
}

/**
 * Nível de indentação de cada item, para a lista mostrar as derivações.
 *
 * Uma cadeia linear fica toda no mesmo nível — indentar a cada passo jogaria um
 * fluxo de 35 atividades para fora da tela. O nível só aumenta quando uma
 * atividade abre um caminho paralelo a partir de outra que já tem continuação,
 * e volta ao nível de origem quando os caminhos se juntam.
 *
 * Espera os itens já ordenados por `ordenarPorDependencia`.
 */
export function niveisDeDerivacao(itens: ModeloItem[]): Map<string, number> {
  const posicao = new Map(itens.map((i, indice) => [i.id, indice]));
  const niveis = new Map<string, number>();
  const comContinuacao = new Set<string>();

  for (const item of itens) {
    const predecessoras = item.predecessoras.filter((p) => posicao.has(p) && posicao.get(p)! < posicao.get(item.id)!);
    if (predecessoras.length === 0) {
      niveis.set(item.id, 0);
      continue;
    }
    if (predecessoras.length > 1) {
      // Junção: volta para o caminho mais externo entre os que chegam aqui.
      niveis.set(item.id, Math.min(...predecessoras.map((p) => niveis.get(p) ?? 0)));
      continue;
    }
    const pai = predecessoras[0];
    const nivelPai = niveis.get(pai) ?? 0;
    if (comContinuacao.has(pai)) {
      niveis.set(item.id, nivelPai + 1);
    } else {
      comContinuacao.add(pai);
      niveis.set(item.id, nivelPai);
    }
  }
  return niveis;
}

// ---------- Itens de trabalho (o que o painel conta) ----------

/** Situação de uma atividade, na mesma linguagem das etapas. */
export function situacaoAtividade(
  atividade: Atividade,
  atividades: Atividade[],
  dataHoje: DataISO,
): Situacao {
  if (atividade.status === "Concluída") {
    if (!atividade.prazo || !atividade.dataConclusao) return { tipo: "concluida" };
    const atraso = diasUteisEntre(atividade.prazo, atividade.dataConclusao);
    return atraso > 0 ? { tipo: "concluida-com-atraso", dias: atraso } : { tipo: "concluida-no-prazo" };
  }

  if (atividade.status === "A fazer" && atividade.predecessoras.length > 0) {
    const pendentes = atividade.predecessoras
      .map((id) => atividades.find((a) => a.id === id))
      .filter((a): a is Atividade => !!a && a.status !== "Concluída");
    if (pendentes.length > 0) {
      return { tipo: "bloqueada", por: pendentes.map((a) => ({ id: a.id, titulo: a.titulo })) };
    }
  }

  if (!atividade.prazo) return { tipo: "sem-prazo" };
  if (atividade.prazo === dataHoje) return { tipo: "vence-hoje" };
  if (atividade.prazo < dataHoje) {
    return { tipo: "atrasada", dias: Math.max(1, diasUteisEntre(atividade.prazo, dataHoje)) };
  }
  return { tipo: "no-prazo", dias: diasUteisEntre(dataHoje, atividade.prazo) };
}

/**
 * O que está na ponta do trabalho: a etapa, quando a atividade tem etapas, e a
 * própria atividade quando não tem. Assim o painel conta uma vez só, e serve
 * tanto para quem detalha atividades em etapas quanto para quem trabalha com as
 * atividades de um fluxo.
 */
export interface ItemTrabalho {
  id: string;
  titulo: string;
  atividadeId: string;
  /** Nome da atividade quando o item é uma etapa dela. */
  contexto: string | null;
  responsavelId: string | null;
  status: Atividade["status"];
  prazo: DataISO | null;
  dataConclusao: DataISO | null;
  situacao: Situacao;
}

export function itensDeTrabalho(
  atividades: Atividade[],
  etapas: Etapa[],
  dataHoje: DataISO,
): ItemTrabalho[] {
  const comEtapas = new Set(etapas.map((e) => e.atividadeId));
  const itens: ItemTrabalho[] = [];

  for (const a of atividades) {
    if (comEtapas.has(a.id)) continue;
    itens.push({
      id: a.id,
      titulo: a.titulo,
      atividadeId: a.id,
      contexto: null,
      responsavelId: a.responsavelId,
      status: a.status,
      prazo: a.prazo,
      dataConclusao: a.dataConclusao,
      situacao: situacaoAtividade(a, atividades, dataHoje),
    });
  }

  for (const e of etapas) {
    const atividade = atividades.find((a) => a.id === e.atividadeId);
    itens.push({
      id: e.id,
      titulo: e.titulo,
      atividadeId: e.atividadeId,
      contexto: atividade?.titulo ?? null,
      responsavelId: e.responsavelId,
      status: e.status,
      prazo: prazoEfetivo(e),
      dataConclusao: e.dataConclusao,
      situacao: situacaoEtapa(e, etapas, dataHoje),
    });
  }

  return itens;
}
