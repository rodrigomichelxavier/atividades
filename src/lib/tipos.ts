// Datas são sempre strings "AAAA-MM-DD" (sem fuso horário).
export type DataISO = string;

export const STATUS = ["A fazer", "Em andamento", "Aguardando", "Concluída"] as const;
export type Status = (typeof STATUS)[number];

export const PRIORIDADES = ["Baixa", "Média", "Alta", "Urgente"] as const;
export type Prioridade = (typeof PRIORIDADES)[number];

export const PAPEIS = ["Gestor", "Membro"] as const;
export type Papel = (typeof PAPEIS)[number];

export interface Pessoa {
  id: string;
  nome: string;
  area: string;
  papel: Papel;
  email: string;
}

export interface Atividade {
  id: string;
  titulo: string;
  descricao: string;
  responsavelId: string | null;
  prioridade: Prioridade;
  status: Status;
  dataInicio: DataISO | null;
  prazo: DataISO | null;
  criadaEm: DataISO;
  /** Fluxo de trabalho a que pertence. Vazio nas atividades de rotina. */
  fluxoId: string | null;
  /** Posição dentro do fluxo. Zero fora de um fluxo. */
  ordem: number;
  /** SLA em dias úteis herdado do modelo do fluxo, usado ao sugerir datas. */
  slaDiasUteis: number | null;
  /** Atividades do mesmo fluxo que precisam terminar antes desta começar. */
  predecessoras: string[];
}

export interface Etapa {
  id: string;
  atividadeId: string;
  ordem: number;
  titulo: string;
  responsavelId: string | null;
  status: Status;
  dataInicio: DataISO | null;
  /** Prazo definido manualmente. Se vazio, vale o prazo calculado pelo SLA. */
  prazo: DataISO | null;
  /** SLA em dias úteis (seg–sex), contados a partir da data de início. */
  slaDiasUteis: number | null;
  predecessoras: string[];
  dataConclusao: DataISO | null;
  observacoes: string;
}

/** Modelo reutilizável de fluxo de trabalho: a receita, sem datas. */
export interface FluxoModelo {
  id: string;
  nome: string;
  descricao: string;
  criadoEm: DataISO;
}

/** Uma atividade prevista no modelo. Vira uma Atividade quando o fluxo é iniciado. */
export interface ModeloItem {
  id: string;
  modeloId: string;
  ordem: number;
  titulo: string;
  responsavelId: string | null;
  prioridade: Prioridade;
  /** SLA em dias úteis, contado do início do fluxo ou do fim das predecessoras. */
  slaDiasUteis: number | null;
  /** Itens do mesmo modelo que precisam terminar antes deste começar. */
  predecessoras: string[];
}

/** Fluxo iniciado: agrupa as atividades criadas a partir de um modelo. */
export interface Fluxo {
  id: string;
  /** Modelo de origem. Fica vazio se o modelo for excluído depois. */
  modeloId: string | null;
  nome: string;
  dataInicio: DataISO;
  criadoEm: DataISO;
}

export interface Dados {
  pessoas: Pessoa[];
  atividades: Atividade[];
  etapas: Etapa[];
  modelos: FluxoModelo[];
  modeloItens: ModeloItem[];
  fluxos: Fluxo[];
}

export const DADOS_VAZIOS: Dados = {
  pessoas: [],
  atividades: [],
  etapas: [],
  modelos: [],
  modeloItens: [],
  fluxos: [],
};

/** Valores de uma atividade de rotina, fora de qualquer fluxo. */
export const ATIVIDADE_SEM_FLUXO = {
  fluxoId: null,
  ordem: 0,
  slaDiasUteis: null,
  predecessoras: [] as string[],
} satisfies Pick<Atividade, "fluxoId" | "ordem" | "slaDiasUteis" | "predecessoras">;
