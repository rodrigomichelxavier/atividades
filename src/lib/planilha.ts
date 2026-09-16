import * as XLSX from "xlsx";
import { dataParaSerialExcel, lerDataTexto, serialExcelParaData } from "./datas.ts";
import {
  PAPEIS,
  PRIORIDADES,
  STATUS,
  DADOS_VAZIOS,
  type Atividade,
  type Dados,
  type DataISO,
  type Etapa,
  type Fluxo,
  type FluxoModelo,
  type ModeloItem,
  type Pessoa,
} from "./tipos.ts";

const VERSAO_FORMATO = 2;

// Ordem e nomes das colunas de cada aba. A leitura localiza as colunas pelo nome,
// então é possível reordenar colunas ou acrescentar colunas próprias no Excel.
const COLUNAS = {
  Pessoas: ["ID", "Nome", "Área", "Papel", "E-mail"],
  Atividades: [
    "ID",
    "Título",
    "Descrição",
    "Responsável (ID)",
    "Prioridade",
    "Status",
    "Data início",
    "Prazo",
    "Data conclusão",
    "Criada em",
    "Fluxo (ID)",
    "Ordem",
    "SLA (dias úteis)",
    "Predecessoras",
  ],
  Etapas: [
    "ID",
    "Atividade (ID)",
    "Ordem",
    "Etapa",
    "Responsável (ID)",
    "Status",
    "Data início",
    "Prazo",
    "SLA (dias úteis)",
    "Predecessoras",
    "Data conclusão",
    "Observações",
  ],
  Fluxos: ["ID", "Modelo (ID)", "Nome", "Data início", "Criado em"],
  "Fluxos modelo": ["ID", "Nome", "Descrição", "Criado em"],
  "Fluxos modelo itens": [
    "ID",
    "Modelo (ID)",
    "Ordem",
    "Atividade",
    "Responsável (ID)",
    "Prioridade",
    "SLA (dias úteis)",
    "Predecessoras",
  ],
} as const;

type Aba = keyof typeof COLUNAS;

/**
 * Abas e colunas criadas depois da versão 1 do formato: planilhas antigas não as
 * têm, então a ausência não é erro — a leitura devolve vazio e a próxima
 * gravação já sai no formato novo.
 */
const ABAS_OBRIGATORIAS = ["Pessoas", "Atividades", "Etapas"] as const satisfies readonly Aba[];

const COLUNAS_OPCIONAIS: Partial<Record<Aba, readonly string[]>> = {
  Atividades: ["Data conclusão", "Fluxo (ID)", "Ordem", "SLA (dias úteis)", "Predecessoras"],
};

type Celula = string | number | boolean | Date | null;

export interface ErroPlanilha {
  aba: string;
  linha: number | null;
  mensagem: string;
}

export interface ResultadoLeitura {
  dados: Dados;
  /** Problemas em valores de células: os valores inválidos foram descartados. */
  avisos: ErroPlanilha[];
  /** Planilha sem nenhuma das abas esperadas (ex.: arquivo em branco). */
  vazia: boolean;
}

export class PlanilhaInvalidaError extends Error {
  erros: ErroPlanilha[];

  constructor(erros: ErroPlanilha[]) {
    super("A planilha não está no formato esperado.");
    this.erros = erros;
  }
}

// ---------- Gravação ----------

function celulaData(data: DataISO | null): XLSX.CellObject | null {
  if (!data) return null;
  return { t: "n", v: dataParaSerialExcel(data), z: "dd/mm/yyyy" };
}

function montarAba(aba: Aba, linhas: (Celula | XLSX.CellObject | null)[][]): XLSX.WorkSheet {
  const cabecalho = [...COLUNAS[aba]];
  const ws = XLSX.utils.aoa_to_sheet([cabecalho]);
  linhas.forEach((linha, i) => {
    linha.forEach((valor, c) => {
      if (valor == null || valor === "") return;
      const ref = XLSX.utils.encode_cell({ r: i + 1, c });
      ws[ref] =
        typeof valor === "object" && !(valor instanceof Date)
          ? valor
          : { t: typeof valor === "number" ? "n" : "s", v: valor as string | number };
    });
  });
  ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: linhas.length, c: cabecalho.length - 1 } });
  ws["!cols"] = cabecalho.map((nome) => ({ wch: Math.max(12, nome.length + 2) }));
  ws["!autofilter"] = { ref: ws["!ref"] };
  return ws;
}

export function gerarPlanilha(dados: Dados): ArrayBuffer {
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    wb,
    montarAba(
      "Atividades",
      dados.atividades.map((a) => [
        a.id,
        a.titulo,
        a.descricao,
        a.responsavelId,
        a.prioridade,
        a.status,
        celulaData(a.dataInicio),
        celulaData(a.prazo),
        celulaData(a.dataConclusao),
        celulaData(a.criadaEm),
        a.fluxoId,
        a.fluxoId ? a.ordem : null,
        a.slaDiasUteis,
        a.predecessoras.join(", "),
      ]),
    ),
    "Atividades",
  );

  XLSX.utils.book_append_sheet(
    wb,
    montarAba(
      "Etapas",
      dados.etapas.map((e) => [
        e.id,
        e.atividadeId,
        e.ordem,
        e.titulo,
        e.responsavelId,
        e.status,
        celulaData(e.dataInicio),
        celulaData(e.prazo),
        e.slaDiasUteis,
        e.predecessoras.join(", "),
        celulaData(e.dataConclusao),
        e.observacoes,
      ]),
    ),
    "Etapas",
  );

  XLSX.utils.book_append_sheet(
    wb,
    montarAba(
      "Fluxos",
      dados.fluxos.map((f) => [f.id, f.modeloId, f.nome, celulaData(f.dataInicio), celulaData(f.criadoEm)]),
    ),
    "Fluxos",
  );

  XLSX.utils.book_append_sheet(
    wb,
    montarAba(
      "Fluxos modelo",
      dados.modelos.map((m) => [m.id, m.nome, m.descricao, celulaData(m.criadoEm)]),
    ),
    "Fluxos modelo",
  );

  XLSX.utils.book_append_sheet(
    wb,
    montarAba(
      "Fluxos modelo itens",
      dados.modeloItens.map((i) => [
        i.id,
        i.modeloId,
        i.ordem,
        i.titulo,
        i.responsavelId,
        i.prioridade,
        i.slaDiasUteis,
        i.predecessoras.join(", "),
      ]),
    ),
    "Fluxos modelo itens",
  );

  XLSX.utils.book_append_sheet(
    wb,
    montarAba(
      "Pessoas",
      dados.pessoas.map((p) => [p.id, p.nome, p.area, p.papel, p.email]),
    ),
    "Pessoas",
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ["Gestão de Atividades"],
      ["Versão do formato", VERSAO_FORMATO],
      [],
      ["Esta planilha é o banco de dados da aplicação Gestão de Atividades."],
      ["Feche o arquivo no Excel antes de usar a aplicação, senão ela não consegue salvar."],
      ["Não renomeie as abas nem os cabeçalhos das colunas."],
    ]),
    "Sobre",
  );

  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

// ---------- Leitura ----------

function hojeISO(): DataISO {
  return new Date().toISOString().slice(0, 10);
}

/** Lê uma célula "E-001, E-002" como lista de IDs. */
function listaDeIds(texto: string): string[] {
  return texto
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizar(texto: string): string {
  return texto.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

class LeitorAba {
  private indices = new Map<string, number>();
  private avisos: ErroPlanilha[];
  readonly aba: Aba;
  readonly linhas: Celula[][];

  constructor(aba: Aba, ws: XLSX.WorkSheet, avisos: ErroPlanilha[], erros: ErroPlanilha[]) {
    this.aba = aba;
    this.avisos = avisos;
    const todas = XLSX.utils.sheet_to_json<Celula[]>(ws, { header: 1, raw: true, defval: null });
    const cabecalho = (todas[0] ?? []).map((c) => normalizar(String(c ?? "")));
    const opcionais = COLUNAS_OPCIONAIS[aba] ?? [];
    for (const coluna of COLUNAS[aba]) {
      const i = cabecalho.indexOf(normalizar(coluna));
      if (i !== -1) this.indices.set(coluna, i);
      else if (!opcionais.includes(coluna)) {
        erros.push({ aba, linha: 1, mensagem: `Coluna "${coluna}" não encontrada.` });
      }
    }
    this.linhas = todas.slice(1);
  }

  /** Número da linha no Excel (cabeçalho é a linha 1). */
  static linhaExcel(i: number): number {
    return i + 2;
  }

  bruto(linha: Celula[], coluna: string): Celula {
    const i = this.indices.get(coluna);
    return i === undefined ? null : (linha[i] ?? null);
  }

  vazia(linha: Celula[]): boolean {
    return linha.every((c) => c == null || String(c).trim() === "");
  }

  texto(linha: Celula[], coluna: string): string {
    const v = this.bruto(linha, coluna);
    if (v == null) return "";
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    return String(v).trim();
  }

  textoOuNulo(linha: Celula[], coluna: string): string | null {
    return this.texto(linha, coluna) || null;
  }

  data(linha: Celula[], coluna: string, i: number): DataISO | null {
    const v = this.bruto(linha, coluna);
    if (v == null || v === "") return null;
    let data: DataISO | null = null;
    if (typeof v === "number") data = serialExcelParaData(v);
    else if (v instanceof Date) data = v.toISOString().slice(0, 10);
    else data = lerDataTexto(String(v));
    if (!data) this.avisar(i, `"${coluna}" com data inválida: "${String(v)}".`);
    return data;
  }

  inteiro(linha: Celula[], coluna: string, i: number): number | null {
    const v = this.bruto(linha, coluna);
    if (v == null || v === "") return null;
    const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
    if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
      this.avisar(i, `"${coluna}" deve ser um número inteiro maior ou igual a zero: "${String(v)}".`);
      return null;
    }
    return n;
  }

  opcao<T extends string>(
    linha: Celula[],
    coluna: string,
    opcoes: readonly T[],
    padrao: T,
    i: number,
  ): T {
    const v = this.texto(linha, coluna);
    if (!v) return padrao;
    const achada = opcoes.find((o) => normalizar(o) === normalizar(v));
    if (!achada) {
      this.avisar(i, `"${coluna}" com valor desconhecido: "${v}". Usado "${padrao}".`);
      return padrao;
    }
    return achada;
  }

  avisar(i: number, mensagem: string) {
    this.avisos.push({ aba: this.aba, linha: LeitorAba.linhaExcel(i), mensagem });
  }
}

/** Leitor de uma aba que pode não existir em planilhas antigas. */
function opcional(
  aba: Aba,
  wb: XLSX.WorkBook,
  avisos: ErroPlanilha[],
  erros: ErroPlanilha[],
): LeitorAba | null {
  return wb.Sheets[aba] ? new LeitorAba(aba, wb.Sheets[aba], avisos, erros) : null;
}

export function lerPlanilha(conteudo: ArrayBuffer): ResultadoLeitura {
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(conteudo, { type: "array" });
  } catch {
    throw new PlanilhaInvalidaError([
      { aba: "—", linha: null, mensagem: "Não foi possível ler o arquivo. Ele é mesmo um .xlsx?" },
    ]);
  }

  const encontradas = ABAS_OBRIGATORIAS.filter((aba) => wb.Sheets[aba]);
  if (encontradas.length === 0) {
    const temConteudo = wb.SheetNames.some((nome) => {
      const ref = wb.Sheets[nome]?.["!ref"];
      return ref && ref !== "A1";
    });
    if (temConteudo) {
      throw new PlanilhaInvalidaError([
        {
          aba: "—",
          linha: null,
          mensagem:
            "A planilha tem conteúdo, mas não tem as abas Atividades, Etapas e Pessoas. " +
            "Para não apagar nada, ela não foi usada.",
        },
      ]);
    }
    return { dados: { ...DADOS_VAZIOS }, avisos: [], vazia: true };
  }

  const erros: ErroPlanilha[] = [];
  const avisos: ErroPlanilha[] = [];
  for (const aba of ABAS_OBRIGATORIAS) {
    if (!wb.Sheets[aba]) erros.push({ aba, linha: null, mensagem: `Aba "${aba}" não encontrada.` });
  }
  if (erros.length > 0) throw new PlanilhaInvalidaError(erros);

  const pessoasL = new LeitorAba("Pessoas", wb.Sheets.Pessoas, avisos, erros);
  const atividadesL = new LeitorAba("Atividades", wb.Sheets.Atividades, avisos, erros);
  const etapasL = new LeitorAba("Etapas", wb.Sheets.Etapas, avisos, erros);
  // Abas de fluxo só existem a partir da versão 2 do formato.
  const modelosL = opcional("Fluxos modelo", wb, avisos, erros);
  const itensL = opcional("Fluxos modelo itens", wb, avisos, erros);
  const fluxosL = opcional("Fluxos", wb, avisos, erros);
  if (erros.length > 0) throw new PlanilhaInvalidaError(erros);

  const idsVistos = new Set<string>();
  function idValido(leitor: LeitorAba, linha: Celula[], i: number): string | null {
    const id = leitor.texto(linha, "ID");
    if (!id) {
      leitor.avisar(i, "Linha sem ID foi ignorada.");
      return null;
    }
    if (idsVistos.has(id)) {
      leitor.avisar(i, `ID "${id}" repetido: a linha foi ignorada.`);
      return null;
    }
    idsVistos.add(id);
    return id;
  }

  const pessoas: Pessoa[] = [];
  pessoasL.linhas.forEach((linha, i) => {
    if (pessoasL.vazia(linha)) return;
    const id = idValido(pessoasL, linha, i);
    if (!id) return;
    pessoas.push({
      id,
      nome: pessoasL.texto(linha, "Nome") || id,
      area: pessoasL.texto(linha, "Área"),
      papel: pessoasL.opcao(linha, "Papel", PAPEIS, "Membro", i),
      email: pessoasL.texto(linha, "E-mail"),
    });
  });
  const idsPessoas = new Set(pessoas.map((p) => p.id));

  function responsavel(leitor: LeitorAba, linha: Celula[], i: number): string | null {
    const id = leitor.textoOuNulo(linha, "Responsável (ID)");
    if (id && !idsPessoas.has(id)) {
      leitor.avisar(i, `Responsável "${id}" não existe na aba Pessoas.`);
      return null;
    }
    return id;
  }

  const modelos: FluxoModelo[] = [];
  modelosL?.linhas.forEach((linha, i) => {
    if (modelosL.vazia(linha)) return;
    const id = idValido(modelosL, linha, i);
    if (!id) return;
    modelos.push({
      id,
      nome: modelosL.texto(linha, "Nome") || id,
      descricao: modelosL.texto(linha, "Descrição"),
      criadoEm: modelosL.data(linha, "Criado em", i) ?? hojeISO(),
    });
  });
  const idsModelos = new Set(modelos.map((m) => m.id));

  const modeloItens: ModeloItem[] = [];
  itensL?.linhas.forEach((linha, i) => {
    if (itensL.vazia(linha)) return;
    const modeloId = itensL.texto(linha, "Modelo (ID)");
    if (!idsModelos.has(modeloId)) {
      itensL.avisar(i, `Modelo "${modeloId}" não existe: a atividade do modelo foi ignorada.`);
      return;
    }
    const id = idValido(itensL, linha, i);
    if (!id) return;
    modeloItens.push({
      id,
      modeloId,
      ordem: itensL.inteiro(linha, "Ordem", i) ?? 0,
      titulo: itensL.texto(linha, "Atividade") || id,
      responsavelId: responsavel(itensL, linha, i),
      prioridade: itensL.opcao(linha, "Prioridade", PRIORIDADES, "Média", i),
      slaDiasUteis: itensL.inteiro(linha, "SLA (dias úteis)", i),
      predecessoras: listaDeIds(itensL.texto(linha, "Predecessoras")),
    });
  });

  const fluxos: Fluxo[] = [];
  fluxosL?.linhas.forEach((linha, i) => {
    if (fluxosL.vazia(linha)) return;
    const id = idValido(fluxosL, linha, i);
    if (!id) return;
    const modeloId = fluxosL.textoOuNulo(linha, "Modelo (ID)");
    fluxos.push({
      id,
      modeloId: modeloId && idsModelos.has(modeloId) ? modeloId : null,
      nome: fluxosL.texto(linha, "Nome") || id,
      dataInicio: fluxosL.data(linha, "Data início", i) ?? hojeISO(),
      criadoEm: fluxosL.data(linha, "Criado em", i) ?? hojeISO(),
    });
  });
  const idsFluxos = new Set(fluxos.map((f) => f.id));

  const atividades: Atividade[] = [];
  atividadesL.linhas.forEach((linha, i) => {
    if (atividadesL.vazia(linha)) return;
    const id = idValido(atividadesL, linha, i);
    if (!id) return;
    const fluxoBruto = atividadesL.textoOuNulo(linha, "Fluxo (ID)");
    if (fluxoBruto && !idsFluxos.has(fluxoBruto)) {
      atividadesL.avisar(i, `Fluxo "${fluxoBruto}" não existe: a atividade ficou como rotina.`);
    }
    const fluxo = fluxoBruto && idsFluxos.has(fluxoBruto) ? fluxoBruto : null;
    atividades.push({
      id,
      titulo: atividadesL.texto(linha, "Título") || id,
      descricao: atividadesL.texto(linha, "Descrição"),
      responsavelId: responsavel(atividadesL, linha, i),
      prioridade: atividadesL.opcao(linha, "Prioridade", PRIORIDADES, "Média", i),
      status: atividadesL.opcao(linha, "Status", STATUS, "A fazer", i),
      dataInicio: atividadesL.data(linha, "Data início", i),
      prazo: atividadesL.data(linha, "Prazo", i),
      dataConclusao: atividadesL.data(linha, "Data conclusão", i),
      criadaEm: atividadesL.data(linha, "Criada em", i) ?? hojeISO(),
      fluxoId: fluxo,
      ordem: (fluxo && atividadesL.inteiro(linha, "Ordem", i)) || 0,
      slaDiasUteis: atividadesL.inteiro(linha, "SLA (dias úteis)", i),
      predecessoras: fluxo ? listaDeIds(atividadesL.texto(linha, "Predecessoras")) : [],
    });
  });
  const idsAtividades = new Set(atividades.map((a) => a.id));

  // Predecessoras de atividade precisam existir e ser do mesmo fluxo.
  const atividadePorId = new Map(atividades.map((a) => [a.id, a]));
  for (const atividade of atividades) {
    atividade.predecessoras = atividade.predecessoras.filter((pid) => {
      const pred = atividadePorId.get(pid);
      const ok = !!pred && pred.fluxoId === atividade.fluxoId && pid !== atividade.id;
      if (!ok) {
        avisos.push({
          aba: "Atividades",
          linha: null,
          mensagem: `Atividade ${atividade.id}: predecessora "${pid}" inválida (inexistente ou de outro fluxo) foi removida.`,
        });
      }
      return ok;
    });
  }

  const etapas: Etapa[] = [];
  etapasL.linhas.forEach((linha, i) => {
    if (etapasL.vazia(linha)) return;
    const atividadeId = etapasL.texto(linha, "Atividade (ID)");
    if (!idsAtividades.has(atividadeId)) {
      etapasL.avisar(i, `Atividade "${atividadeId}" não existe: a etapa foi ignorada.`);
      return;
    }
    const id = idValido(etapasL, linha, i);
    if (!id) return;
    etapas.push({
      id,
      atividadeId,
      ordem: etapasL.inteiro(linha, "Ordem", i) ?? 0,
      titulo: etapasL.texto(linha, "Etapa") || id,
      responsavelId: responsavel(etapasL, linha, i),
      status: etapasL.opcao(linha, "Status", STATUS, "A fazer", i),
      dataInicio: etapasL.data(linha, "Data início", i),
      prazo: etapasL.data(linha, "Prazo", i),
      slaDiasUteis: etapasL.inteiro(linha, "SLA (dias úteis)", i),
      predecessoras: listaDeIds(etapasL.texto(linha, "Predecessoras")),
      dataConclusao: etapasL.data(linha, "Data conclusão", i),
      observacoes: etapasL.texto(linha, "Observações"),
    });
  });

  // Predecessoras precisam existir e pertencer à mesma atividade.
  const porId = new Map(etapas.map((e) => [e.id, e]));
  for (const etapa of etapas) {
    etapa.predecessoras = etapa.predecessoras.filter((pid) => {
      const pred = porId.get(pid);
      const ok = !!pred && pred.atividadeId === etapa.atividadeId && pid !== etapa.id;
      if (!ok) {
        avisos.push({
          aba: "Etapas",
          linha: null,
          mensagem: `Etapa ${etapa.id}: predecessora "${pid}" inválida (inexistente ou de outra atividade) foi removida.`,
        });
      }
      return ok;
    });
  }

  return { dados: { pessoas, atividades, etapas, modelos, modeloItens, fluxos }, avisos, vazia: false };
}
