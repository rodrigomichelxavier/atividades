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

export interface Dados {
  pessoas: Pessoa[];
  atividades: Atividade[];
  etapas: Etapa[];
}

export const DADOS_VAZIOS: Dados = { pessoas: [], atividades: [], etapas: [] };
