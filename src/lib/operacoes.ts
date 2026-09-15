import { hoje } from "./datas.ts";
import { predecessorasPendentes } from "./fluxo.ts";
import type { Atividade, Dados, Etapa, Pessoa, Status } from "./tipos.ts";

export type Resultado = { ok: true; dados: Dados } | { ok: false; erro: string };

function substituir<T extends { id: string }>(lista: T[], item: T): T[] {
  return lista.some((x) => x.id === item.id)
    ? lista.map((x) => (x.id === item.id ? item : x))
    : [...lista, item];
}

export function salvarPessoa(dados: Dados, pessoa: Pessoa): Dados {
  return { ...dados, pessoas: substituir(dados.pessoas, pessoa) };
}

export function excluirPessoa(dados: Dados, id: string): Resultado {
  const usos =
    dados.atividades.filter((a) => a.responsavelId === id).length +
    dados.etapas.filter((e) => e.responsavelId === id).length;
  if (usos > 0) {
    return {
      ok: false,
      erro: `Essa pessoa é responsável por ${usos} atividade(s) ou etapa(s). Troque o responsável antes de excluir.`,
    };
  }
  return { ok: true, dados: { ...dados, pessoas: dados.pessoas.filter((p) => p.id !== id) } };
}

export function salvarAtividade(dados: Dados, atividade: Atividade): Dados {
  return { ...dados, atividades: substituir(dados.atividades, atividade) };
}

export function excluirAtividade(dados: Dados, id: string): Dados {
  return {
    ...dados,
    atividades: dados.atividades.filter((a) => a.id !== id),
    etapas: dados.etapas.filter((e) => e.atividadeId !== id),
  };
}

export function salvarEtapa(dados: Dados, etapa: Etapa): Dados {
  return { ...dados, etapas: substituir(dados.etapas, etapa) };
}

export function excluirEtapa(dados: Dados, id: string): Dados {
  return {
    ...dados,
    etapas: dados.etapas
      .filter((e) => e.id !== id)
      .map((e) =>
        e.predecessoras.includes(id)
          ? { ...e, predecessoras: e.predecessoras.filter((p) => p !== id) }
          : e,
      ),
  };
}

/** Ajusta datas de acordo com a mudança de status. */
export function aplicarStatusEtapa(etapa: Etapa, status: Status, dataHoje = hoje()): Etapa {
  const nova = { ...etapa, status };
  if (status === "Em andamento" || status === "Concluída") nova.dataInicio ??= dataHoje;
  if (status === "Concluída") nova.dataConclusao ??= dataHoje;
  else nova.dataConclusao = null;
  return nova;
}

export function mudarStatusEtapa(dados: Dados, id: string, status: Status): Resultado {
  const etapa = dados.etapas.find((e) => e.id === id);
  if (!etapa) return { ok: false, erro: "Etapa não encontrada." };
  if (status === "Em andamento" || status === "Concluída") {
    const pendentes = predecessorasPendentes(etapa, dados.etapas);
    if (pendentes.length > 0) {
      return {
        ok: false,
        erro: `"${etapa.titulo}" depende de: ${pendentes.map((p) => p.titulo).join(", ")}. Conclua essas etapas primeiro.`,
      };
    }
  }
  return { ok: true, dados: salvarEtapa(dados, aplicarStatusEtapa(etapa, status)) };
}

export function mudarStatusAtividade(dados: Dados, id: string, status: Status): Dados {
  const atividade = dados.atividades.find((a) => a.id === id);
  if (!atividade) return dados;
  const nova = { ...atividade, status };
  if (status !== "A fazer") nova.dataInicio ??= hoje();
  return salvarAtividade(dados, nova);
}
