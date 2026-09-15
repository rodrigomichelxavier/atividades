import { hoje } from "./datas.ts";
import { itensDoModelo, ordenarPorDependencia, predecessorasPendentes, proximoId } from "./fluxo.ts";
import {
  ATIVIDADE_SEM_FLUXO,
  type Atividade,
  type Dados,
  type DataISO,
  type Etapa,
  type FluxoModelo,
  type ModeloItem,
  type Pessoa,
  type Prioridade,
  type Status,
} from "./tipos.ts";

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
  return {
    ok: true,
    dados: {
      ...dados,
      pessoas: dados.pessoas.filter((p) => p.id !== id),
      // Nos modelos o responsável é só uma sugestão: sai sem impedir a exclusão.
      modeloItens: dados.modeloItens.map((i) => (i.responsavelId === id ? { ...i, responsavelId: null } : i)),
    },
  };
}

export function salvarAtividade(dados: Dados, atividade: Atividade): Dados {
  return { ...dados, atividades: substituir(dados.atividades, atividade) };
}

export function excluirAtividade(dados: Dados, id: string): Dados {
  return {
    ...dados,
    atividades: dados.atividades
      .filter((a) => a.id !== id)
      .map((a) =>
        a.predecessoras.includes(id) ? { ...a, predecessoras: a.predecessoras.filter((p) => p !== id) } : a,
      ),
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

/** Ajusta datas de acordo com a mudança de status, como nas etapas. */
export function aplicarStatusAtividade(atividade: Atividade, status: Status, dataHoje = hoje()): Atividade {
  const nova = { ...atividade, status };
  if (status !== "A fazer") nova.dataInicio ??= dataHoje;
  if (status === "Concluída") nova.dataConclusao ??= dataHoje;
  else nova.dataConclusao = null;
  return nova;
}

export function mudarStatusAtividade(dados: Dados, id: string, status: Status): Dados {
  const atividade = dados.atividades.find((a) => a.id === id);
  if (!atividade) return dados;
  return salvarAtividade(dados, aplicarStatusAtividade(atividade, status));
}

// ---------- Fluxos de trabalho ----------

export function salvarModelo(dados: Dados, modelo: FluxoModelo): Dados {
  return { ...dados, modelos: substituir(dados.modelos, modelo) };
}

export function excluirModelo(dados: Dados, id: string): Dados {
  return {
    ...dados,
    modelos: dados.modelos.filter((m) => m.id !== id),
    modeloItens: dados.modeloItens.filter((i) => i.modeloId !== id),
    // Fluxos já iniciados continuam existindo, apenas sem o modelo de origem.
    fluxos: dados.fluxos.map((f) => (f.modeloId === id ? { ...f, modeloId: null } : f)),
  };
}

export function salvarModeloItem(dados: Dados, item: ModeloItem): Dados {
  return { ...dados, modeloItens: substituir(dados.modeloItens, item) };
}

export function excluirModeloItem(dados: Dados, id: string): Dados {
  return {
    ...dados,
    modeloItens: dados.modeloItens
      .filter((i) => i.id !== id)
      .map((i) =>
        i.predecessoras.includes(id) ? { ...i, predecessoras: i.predecessoras.filter((p) => p !== id) } : i,
      ),
  };
}

/** Move um item do modelo uma posição para cima ou para baixo. */
export function moverModeloItem(dados: Dados, id: string, direcao: -1 | 1): Dados {
  const item = dados.modeloItens.find((i) => i.id === id);
  if (!item) return dados;
  const lista = itensDoModelo(item.modeloId, dados.modeloItens);
  const posicao = lista.findIndex((i) => i.id === id);
  const vizinho = lista[posicao + direcao];
  if (!vizinho) return dados;
  const trocados = new Map([
    [item.id, { ...item, ordem: vizinho.ordem }],
    [vizinho.id, { ...vizinho, ordem: item.ordem }],
  ]);
  // Ordens repetidas (planilha editada à mão) desempatam renumerando a lista toda.
  const ordensRepetidas = new Set(lista.map((i) => i.ordem)).size !== lista.length;
  if (ordensRepetidas) {
    const nova = [...lista];
    nova.splice(posicao + direcao, 0, ...nova.splice(posicao, 1));
    return {
      ...dados,
      modeloItens: dados.modeloItens.map((i) => {
        const indice = nova.findIndex((n) => n.id === i.id);
        return indice === -1 ? i : { ...i, ordem: indice + 1 };
      }),
    };
  }
  return { ...dados, modeloItens: dados.modeloItens.map((i) => trocados.get(i.id) ?? i) };
}

/** Uma atividade a criar quando o fluxo for iniciado. */
export interface AtividadePlanejada {
  itemId: string;
  titulo: string;
  responsavelId: string | null;
  prioridade: Prioridade;
  slaDiasUteis: number | null;
  dataInicio: DataISO | null;
  prazo: DataISO | null;
}

/**
 * Cria o fluxo e uma atividade por item planejado, preservando entre elas as
 * predecessoras definidas no modelo (só as que também entraram no fluxo).
 */
export function iniciarFluxo(
  dados: Dados,
  fluxo: { nome: string; modeloId: string | null; dataInicio: DataISO },
  planejadas: AtividadePlanejada[],
  dataHoje = hoje(),
): { dados: Dados; fluxoId: string } {
  const fluxoId = proximoId("F", dados.fluxos.map((f) => f.id));
  const itens = new Map(dados.modeloItens.map((i) => [i.id, i]));

  const ids = dados.atividades.map((a) => a.id);
  const idPorItem = new Map<string, string>();
  for (const planejada of planejadas) {
    const id = proximoId("A", ids);
    ids.push(id);
    idPorItem.set(planejada.itemId, id);
  }

  const novas: Atividade[] = planejadas.map((planejada, indice) => ({
    id: idPorItem.get(planejada.itemId)!,
    titulo: planejada.titulo.trim(),
    descricao: "",
    responsavelId: planejada.responsavelId,
    prioridade: planejada.prioridade,
    status: "A fazer",
    dataInicio: planejada.dataInicio,
    prazo: planejada.prazo,
    dataConclusao: null,
    criadaEm: dataHoje,
    fluxoId,
    ordem: indice + 1,
    slaDiasUteis: planejada.slaDiasUteis,
    predecessoras: (itens.get(planejada.itemId)?.predecessoras ?? [])
      .map((p) => idPorItem.get(p))
      .filter((p): p is string => !!p),
  }));

  return {
    fluxoId,
    dados: {
      ...dados,
      fluxos: [
        ...dados.fluxos,
        { id: fluxoId, modeloId: fluxo.modeloId, nome: fluxo.nome.trim(), dataInicio: fluxo.dataInicio, criadoEm: dataHoje },
      ],
      atividades: [...dados.atividades, ...novas],
    },
  };
}

/** Exclui o fluxo. As atividades podem virar rotina ou ser excluídas junto. */
export function excluirFluxo(dados: Dados, id: string, comAtividades: boolean): Dados {
  const daqui = new Set(dados.atividades.filter((a) => a.fluxoId === id).map((a) => a.id));
  return {
    ...dados,
    fluxos: dados.fluxos.filter((f) => f.id !== id),
    atividades: comAtividades
      ? dados.atividades.filter((a) => !daqui.has(a.id))
      : dados.atividades.map((a) => (daqui.has(a.id) ? { ...a, ...ATIVIDADE_SEM_FLUXO } : a)),
    etapas: comAtividades ? dados.etapas.filter((e) => !daqui.has(e.atividadeId)) : dados.etapas,
  };
}

/** Reordena o modelo para que cada atividade venha depois de suas predecessoras. */
export function ordenarModeloPorDependencia(dados: Dados, modeloId: string): Dados {
  const ordenados = ordenarPorDependencia(itensDoModelo(modeloId, dados.modeloItens));
  const novaOrdem = new Map(ordenados.map((i, indice) => [i.id, indice + 1]));
  return {
    ...dados,
    modeloItens: dados.modeloItens.map((i) => {
      const ordem = novaOrdem.get(i.id);
      return ordem === undefined || ordem === i.ordem ? i : { ...i, ordem };
    }),
  };
}
