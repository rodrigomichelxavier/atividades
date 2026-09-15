import type { DataISO } from "./tipos.ts";

const DIA_MS = 86_400_000;

/** Converte "AAAA-MM-DD" em dias desde 1970-01-01 (UTC), evitando problemas de fuso. */
function paraDias(data: DataISO): number {
  const [a, m, d] = data.split("-").map(Number);
  return Date.UTC(a, m - 1, d) / DIA_MS;
}

function deDias(dias: number): DataISO {
  return new Date(dias * DIA_MS).toISOString().slice(0, 10);
}

export function hoje(): DataISO {
  const agora = new Date();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");
  return `${agora.getFullYear()}-${mes}-${dia}`;
}

export function dataValida(valor: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  return deDias(paraDias(valor)) === valor;
}

export function diaDaSemana(data: DataISO): number {
  // 1970-01-01 foi quinta-feira (4). 0 = domingo … 6 = sábado.
  return (((paraDias(data) + 4) % 7) + 7) % 7;
}

export function ehDiaUtil(data: DataISO): boolean {
  const dia = diaDaSemana(data);
  return dia !== 0 && dia !== 6;
}

export function somarDias(data: DataISO, n: number): DataISO {
  return deDias(paraDias(data) + n);
}

/**
 * Data final de um SLA de `n` dias úteis iniciado em `inicio`.
 * O dia de início não conta: início na segunda com SLA 1 vence na terça.
 * Início no fim de semana conta a partir da segunda seguinte (SLA 0 vence na segunda).
 */
export function somarDiasUteis(inicio: DataISO, n: number): DataISO {
  let data = inicio;
  while (!ehDiaUtil(data)) data = somarDias(data, 1);
  let restantes = n;
  while (restantes > 0) {
    data = somarDias(data, 1);
    if (ehDiaUtil(data)) restantes--;
  }
  return data;
}

/**
 * Dias úteis de `de` até `ate`: conta os dias úteis após `de` até `ate` inclusive.
 * Negativo quando `ate` é anterior a `de`.
 */
export function diasUteisEntre(de: DataISO, ate: DataISO): number {
  if (de === ate) return 0;
  const sinal = ate > de ? 1 : -1;
  const [inicio, fim] = sinal === 1 ? [de, ate] : [ate, de];
  let total = 0;
  let data = inicio;
  while (data < fim) {
    data = somarDias(data, 1);
    if (ehDiaUtil(data)) total++;
  }
  return total * sinal;
}

export function formatarData(data: DataISO | null): string {
  if (!data) return "—";
  const [a, m, d] = data.split("-");
  return `${d}/${m}/${a}`;
}

/** Aceita "AAAA-MM-DD" ou "DD/MM/AAAA". */
export function lerDataTexto(texto: string): DataISO | null {
  const t = texto.trim();
  if (dataValida(t)) return t;
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
  if (br) {
    const iso = `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
    if (dataValida(iso)) return iso;
  }
  return null;
}

// Excel conta dias a partir de 1899-12-30.
const EPOCA_EXCEL = paraDias("1899-12-30");

export function dataParaSerialExcel(data: DataISO): number {
  return paraDias(data) - EPOCA_EXCEL;
}

export function serialExcelParaData(serial: number): DataISO {
  return deDias(Math.floor(serial) + EPOCA_EXCEL);
}
