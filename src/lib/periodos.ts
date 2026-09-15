import { hoje, somarDias } from "./datas.ts";
import type { DataISO } from "./tipos.ts";

export const PERIODOS = [
  "Todo o período",
  "Últimos 3 meses",
  "Últimos 12 meses",
  "Este mês",
  "Próximos 30 dias",
  "Personalizado",
] as const;

export type Periodo = (typeof PERIODOS)[number];

export interface Intervalo {
  de: DataISO | null;
  ate: DataISO | null;
}

/** Recua `meses` a partir de uma data, sem estourar para o mês seguinte. */
export function subtrairMeses(data: DataISO, meses: number): DataISO {
  const [ano, mes, dia] = data.split("-").map(Number);
  const total = ano * 12 + (mes - 1) - meses;
  const novoAno = Math.floor(total / 12);
  const novoMes = (total % 12) + 1;
  const ultimoDia = new Date(Date.UTC(novoAno, novoMes, 0)).getUTCDate();
  const novoDia = Math.min(dia, ultimoDia);
  return `${String(novoAno).padStart(4, "0")}-${String(novoMes).padStart(2, "0")}-${String(novoDia).padStart(2, "0")}`;
}

/** Intervalo de datas de um período. `null` nas pontas significa sem limite. */
export function intervaloDoPeriodo(periodo: Periodo, personalizado: Intervalo, dataHoje = hoje()): Intervalo {
  switch (periodo) {
    case "Todo o período":
      return { de: null, ate: null };
    case "Últimos 3 meses":
      return { de: subtrairMeses(dataHoje, 3), ate: dataHoje };
    case "Últimos 12 meses":
      return { de: subtrairMeses(dataHoje, 12), ate: dataHoje };
    case "Este mês": {
      const mes = dataHoje.slice(0, 7);
      const ultimoDia = new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0)).getUTCDate();
      return { de: `${mes}-01`, ate: `${mes}-${String(ultimoDia).padStart(2, "0")}` };
    }
    case "Próximos 30 dias":
      return { de: dataHoje, ate: somarDias(dataHoje, 30) };
    case "Personalizado":
      return personalizado;
  }
}

/** Uma data sem valor nunca é filtrada: fica de fora só quando há data e ela cai fora. */
export function dentroDoIntervalo(data: DataISO | null, intervalo: Intervalo): boolean {
  if (!data) return true;
  if (intervalo.de && data < intervalo.de) return false;
  if (intervalo.ate && data > intervalo.ate) return false;
  return true;
}
