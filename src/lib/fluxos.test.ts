import assert from "node:assert/strict";
import test from "node:test";
import {
  datasDoFluxo,
  dependentesDoItem,
  itensDeTrabalho,
  itensDoModelo,
  niveisDeDerivacao,
  ordenarPorDependencia,
  situacaoAtividade,
} from "./fluxo.ts";
import { dentroDoIntervalo, intervaloDoPeriodo, subtrairMeses, type Intervalo } from "./periodos.ts";
import type { Atividade, Etapa, ModeloItem } from "./tipos.ts";

const VAZIO: Intervalo = { de: null, ate: null };

function item(id: string, ordem: number, sla: number | null, predecessoras: string[] = []): ModeloItem {
  return {
    id,
    modeloId: "FM-001",
    ordem,
    titulo: id,
    responsavelId: null,
    prioridade: "Média",
    slaDiasUteis: sla,
    predecessoras,
  };
}

const todos = (itens: ModeloItem[]) => new Set(itens.map((i) => i.id));

test("item sem predecessora começa no início do fluxo", () => {
  const itens = [item("I-001", 1, 2)];
  // 2026-06-01 é uma segunda-feira.
  const datas = datasDoFluxo(itens, "2026-06-01", todos(itens));
  assert.deepEqual(datas.get("I-001"), { dataInicio: "2026-06-01", prazo: "2026-06-03" });
});

test("itens em cadeia começam no dia útil seguinte ao prazo da predecessora", () => {
  const itens = [item("I-001", 1, 2), item("I-002", 2, 3, ["I-001"])];
  const datas = datasDoFluxo(itens, "2026-06-01", todos(itens));
  assert.deepEqual(datas.get("I-001"), { dataInicio: "2026-06-01", prazo: "2026-06-03" });
  assert.deepEqual(datas.get("I-002"), { dataInicio: "2026-06-04", prazo: "2026-06-09" });
});

test("itens independentes correm em paralelo, a partir do início do fluxo", () => {
  const itens = [item("I-001", 1, 2), item("I-002", 2, 5)];
  const datas = datasDoFluxo(itens, "2026-06-01", todos(itens));
  assert.equal(datas.get("I-001")!.dataInicio, "2026-06-01");
  assert.equal(datas.get("I-002")!.dataInicio, "2026-06-01");
  assert.equal(datas.get("I-002")!.prazo, "2026-06-08");
});

test("com várias predecessoras, vale a que termina por último", () => {
  const itens = [item("I-001", 1, 2), item("I-002", 2, 5), item("I-003", 3, 1, ["I-001", "I-002"])];
  const datas = datasDoFluxo(itens, "2026-06-01", todos(itens));
  assert.equal(datas.get("I-003")!.dataInicio, "2026-06-09"); // dia útil após 08/06
  assert.equal(datas.get("I-003")!.prazo, "2026-06-10");
});

test("a cadeia pula fim de semana", () => {
  const itens = [item("I-001", 1, 4), item("I-002", 2, 1, ["I-001"])];
  const datas = datasDoFluxo(itens, "2026-06-01", todos(itens));
  assert.equal(datas.get("I-001")!.prazo, "2026-06-05"); // sexta
  assert.equal(datas.get("I-002")!.dataInicio, "2026-06-08"); // segunda, não sábado
});

test("início de fluxo no fim de semana anda para a segunda", () => {
  const itens = [item("I-001", 1, 1)];
  const datas = datasDoFluxo(itens, "2026-06-06", todos(itens)); // sábado
  assert.equal(datas.get("I-001")!.dataInicio, "2026-06-08");
});

test("item sem SLA dura um dia útil", () => {
  const itens = [item("I-001", 1, null)];
  const datas = datasDoFluxo(itens, "2026-06-01", todos(itens));
  assert.equal(datas.get("I-001")!.prazo, "2026-06-02");
});

test("SLA zero vence no próprio dia de início", () => {
  const itens = [item("I-001", 1, 0), item("I-002", 2, 1, ["I-001"])];
  const datas = datasDoFluxo(itens, "2026-06-01", todos(itens));
  assert.equal(datas.get("I-001")!.prazo, "2026-06-01");
  assert.equal(datas.get("I-002")!.dataInicio, "2026-06-02");
});

test("item desmarcado sai do resultado e liga a cadeia em quem sobrou", () => {
  const itens = [item("I-001", 1, 2), item("I-002", 2, 3, ["I-001"]), item("I-003", 3, 1, ["I-002"])];
  const datas = datasDoFluxo(itens, "2026-06-01", new Set(["I-001", "I-003"]));
  assert.equal(datas.has("I-002"), false);
  // I-003 passa a depender de I-001, que vence em 03/06.
  assert.equal(datas.get("I-003")!.dataInicio, "2026-06-04");
});

test("desmarcar o primeiro item solta o seguinte no início do fluxo", () => {
  const itens = [item("I-001", 1, 2), item("I-002", 2, 3, ["I-001"])];
  const datas = datasDoFluxo(itens, "2026-06-01", new Set(["I-002"]));
  assert.equal(datas.get("I-002")!.dataInicio, "2026-06-01");
});

test("predecessora inexistente é ignorada", () => {
  const itens = [item("I-002", 2, 3, ["I-999"])];
  const datas = datasDoFluxo(itens, "2026-06-01", todos(itens));
  assert.equal(datas.get("I-002")!.dataInicio, "2026-06-01");
});

test("ciclo não trava o cálculo", () => {
  const itens = [item("I-001", 1, 1, ["I-002"]), item("I-002", 2, 1, ["I-001"])];
  const datas = datasDoFluxo(itens, "2026-06-01", todos(itens));
  assert.equal(datas.size, 2);
});

test("dependentesDoItem pega dependências indiretas", () => {
  const itens = [item("I-001", 1, 1), item("I-002", 2, 1, ["I-001"]), item("I-003", 3, 1, ["I-002"])];
  assert.deepEqual([...dependentesDoItem("I-001", itens)].sort(), ["I-002", "I-003"]);
  assert.deepEqual([...dependentesDoItem("I-003", itens)], []);
});

test("itensDoModelo filtra por modelo e ordena", () => {
  const itens = [item("I-002", 2, 1), item("I-001", 1, 1), { ...item("I-003", 0, 1), modeloId: "FM-002" }];
  assert.deepEqual(
    itensDoModelo("FM-001", itens).map((i) => i.id),
    ["I-001", "I-002"],
  );
});

test("subtrairMeses não estoura o fim do mês", () => {
  assert.equal(subtrairMeses("2026-03-31", 1), "2026-02-28");
  assert.equal(subtrairMeses("2026-01-15", 1), "2025-12-15");
  assert.equal(subtrairMeses("2026-06-30", 12), "2025-06-30");
  assert.equal(subtrairMeses("2024-03-30", 1), "2024-02-29"); // ano bissexto
});

test("intervalos dos períodos", () => {
  assert.deepEqual(intervaloDoPeriodo("Todo o período", VAZIO, "2026-06-15"), { de: null, ate: null });
  assert.deepEqual(intervaloDoPeriodo("Últimos 3 meses", VAZIO, "2026-06-15"), {
    de: "2026-03-15",
    ate: "2026-06-15",
  });
  assert.deepEqual(intervaloDoPeriodo("Este mês", VAZIO, "2026-02-10"), { de: "2026-02-01", ate: "2026-02-28" });
  assert.deepEqual(intervaloDoPeriodo("Próximos 30 dias", VAZIO, "2026-06-15"), {
    de: "2026-06-15",
    ate: "2026-07-15",
  });
  const meu = { de: "2026-01-01", ate: "2026-01-31" };
  assert.deepEqual(intervaloDoPeriodo("Personalizado", meu, "2026-06-15"), meu);
});

test("data sem valor nunca é filtrada pelo período", () => {
  const intervalo = { de: "2026-06-01", ate: "2026-06-30" };
  assert.equal(dentroDoIntervalo(null, intervalo), true);
  assert.equal(dentroDoIntervalo("2026-06-15", intervalo), true);
  assert.equal(dentroDoIntervalo("2026-05-31", intervalo), false);
  assert.equal(dentroDoIntervalo("2026-07-01", intervalo), false);
  assert.equal(dentroDoIntervalo("2026-07-01", { de: null, ate: null }), true);
});

test("ordenar por dependência põe cada item depois das predecessoras", () => {
  const itens = [item("I-001", 1, 1, ["I-003"]), item("I-002", 2, 1), item("I-003", 3, 1, ["I-002"])];
  assert.deepEqual(
    ordenarPorDependencia(itens).map((i) => i.id),
    ["I-002", "I-003", "I-001"],
  );
});

test("ordenar preserva a ordem de quem não depende de ninguém", () => {
  const itens = [item("I-001", 1, 1), item("I-002", 2, 1), item("I-003", 3, 1)];
  assert.deepEqual(
    ordenarPorDependencia(itens).map((i) => i.id),
    ["I-001", "I-002", "I-003"],
  );
});

test("ordenar não trava com ciclo", () => {
  const itens = [item("I-001", 1, 1, ["I-002"]), item("I-002", 2, 1, ["I-001"])];
  assert.equal(ordenarPorDependencia(itens).length, 2);
});

test("cadeia linear fica toda no mesmo nível", () => {
  const itens = ordenarPorDependencia([
    item("I-001", 1, 1),
    item("I-002", 2, 1, ["I-001"]),
    item("I-003", 3, 1, ["I-002"]),
  ]);
  const niveis = niveisDeDerivacao(itens);
  assert.deepEqual([...niveis.values()], [0, 0, 0]);
});

test("caminho paralelo a partir da mesma atividade ganha um nível", () => {
  const itens = ordenarPorDependencia([
    item("I-001", 1, 1),
    item("I-002", 2, 1, ["I-001"]),
    item("I-003", 3, 1, ["I-001"]),
  ]);
  const niveis = niveisDeDerivacao(itens);
  assert.equal(niveis.get("I-001"), 0);
  assert.equal(niveis.get("I-002"), 0); // continua a cadeia
  assert.equal(niveis.get("I-003"), 1); // deriva
});

test("junção volta ao nível de fora", () => {
  const itens = ordenarPorDependencia([
    item("I-001", 1, 1),
    item("I-002", 2, 1, ["I-001"]),
    item("I-003", 3, 1, ["I-001"]),
    item("I-004", 4, 1, ["I-002", "I-003"]),
  ]);
  const niveis = niveisDeDerivacao(itens);
  assert.equal(niveis.get("I-003"), 1);
  assert.equal(niveis.get("I-004"), 0);
});

test("item sem predecessora começa no nível zero mesmo no meio da lista", () => {
  const itens = ordenarPorDependencia([
    item("I-001", 1, 1),
    item("I-002", 2, 1, ["I-001"]),
    item("I-003", 3, 1),
  ]);
  assert.equal(niveisDeDerivacao(itens).get("I-003"), 0);
});

test("o ramo fica junto: quem deriva vem logo depois, antes dos independentes", () => {
  const itens = [
    item("I-001", 1, 1),
    item("I-002", 2, 1),
    item("I-003", 3, 1, ["I-002"]),
    item("I-004", 4, 1),
    item("I-005", 5, 1, ["I-002"]),
  ];
  assert.deepEqual(
    ordenarPorDependencia(itens).map((i) => i.id),
    ["I-001", "I-002", "I-003", "I-005", "I-004"],
  );
});

test("junção só entra depois da última predecessora", () => {
  const itens = [
    item("I-001", 1, 1),
    item("I-002", 2, 1, ["I-001"]),
    item("I-003", 3, 1, ["I-001", "I-004"]),
    item("I-004", 4, 1),
  ];
  const ordem = ordenarPorDependencia(itens).map((i) => i.id);
  assert.ok(ordem.indexOf("I-003") > ordem.indexOf("I-004"), ordem.join(","));
  assert.ok(ordem.indexOf("I-003") > ordem.indexOf("I-001"), ordem.join(","));
});

// ---------- Painel: itens de trabalho ----------

function atividade(parcial: Partial<Atividade>): Atividade {
  return {
    id: "A-001",
    titulo: "Atividade",
    descricao: "",
    responsavelId: null,
    prioridade: "Média",
    status: "A fazer",
    dataInicio: null,
    prazo: null,
    dataConclusao: null,
    criadaEm: "2026-06-01",
    fluxoId: null,
    ordem: 0,
    slaDiasUteis: null,
    predecessoras: [],
    ...parcial,
  };
}

function etapa(parcial: Partial<Etapa>): Etapa {
  return {
    id: "E-001",
    atividadeId: "A-001",
    ordem: 1,
    titulo: "Etapa",
    responsavelId: null,
    status: "A fazer",
    dataInicio: null,
    prazo: null,
    slaDiasUteis: null,
    predecessoras: [],
    dataConclusao: null,
    observacoes: "",
    ...parcial,
  };
}

test("atividade sem etapas conta como item de trabalho", () => {
  const a = atividade({ id: "A-001", responsavelId: "P-001", status: "Concluída", dataConclusao: "2026-06-10" });
  const itens = itensDeTrabalho([a], [], "2026-06-15");
  assert.equal(itens.length, 1);
  assert.equal(itens[0].responsavelId, "P-001");
  assert.equal(itens[0].dataConclusao, "2026-06-10");
});

test("atividade com etapas é representada pelas etapas, sem contar duas vezes", () => {
  const a = atividade({ id: "A-001" });
  const b = atividade({ id: "A-002", titulo: "Sozinha" });
  const itens = itensDeTrabalho([a, b], [etapa({ id: "E-001", atividadeId: "A-001" })], "2026-06-15");
  assert.deepEqual(itens.map((i) => i.id).sort(), ["A-002", "E-001"]);
  assert.equal(itens.find((i) => i.id === "E-001")!.contexto, "Atividade");
});

test("situação da atividade: atrasada, vence hoje e no prazo", () => {
  const base = { id: "A-001", status: "Em andamento" as const };
  assert.equal(situacaoAtividade(atividade({ ...base, prazo: "2026-06-10" }), [], "2026-06-15").tipo, "atrasada");
  assert.equal(situacaoAtividade(atividade({ ...base, prazo: "2026-06-15" }), [], "2026-06-15").tipo, "vence-hoje");
  assert.equal(situacaoAtividade(atividade({ ...base, prazo: "2026-06-20" }), [], "2026-06-15").tipo, "no-prazo");
  assert.equal(situacaoAtividade(atividade({ ...base }), [], "2026-06-15").tipo, "sem-prazo");
});

test("situação da atividade concluída compara com o prazo", () => {
  const noPrazo = atividade({ status: "Concluída", prazo: "2026-06-15", dataConclusao: "2026-06-12" });
  assert.equal(situacaoAtividade(noPrazo, [], "2026-06-20").tipo, "concluida-no-prazo");
  const atrasada = atividade({ status: "Concluída", prazo: "2026-06-10", dataConclusao: "2026-06-15" });
  assert.deepEqual(situacaoAtividade(atrasada, [], "2026-06-20"), { tipo: "concluida-com-atraso", dias: 3 });
  const semData = atividade({ status: "Concluída", prazo: "2026-06-10" });
  assert.equal(situacaoAtividade(semData, [], "2026-06-20").tipo, "concluida");
});

test("atividade de fluxo esperando predecessora aparece como bloqueada", () => {
  const primeira = atividade({ id: "A-001", fluxoId: "F-001" });
  const segunda = atividade({ id: "A-002", fluxoId: "F-001", predecessoras: ["A-001"] });
  assert.equal(situacaoAtividade(segunda, [primeira, segunda], "2026-06-15").tipo, "bloqueada");
  const feita = { ...primeira, status: "Concluída" as const };
  assert.equal(situacaoAtividade(segunda, [feita, segunda], "2026-06-15").tipo, "sem-prazo");
});
