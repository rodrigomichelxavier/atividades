import { diasUteisEntre, somarDiasUteis } from "./datas.ts";
import type { Atividade, DataISO, Etapa } from "./tipos.ts";

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
  | { tipo: "bloqueada"; por: Etapa[] }
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
