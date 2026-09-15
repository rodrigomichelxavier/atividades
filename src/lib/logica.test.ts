import assert from "node:assert/strict";
import { test } from "node:test";
import * as XLSX from "xlsx";
import { diasUteisEntre, diaDaSemana, lerDataTexto, somarDiasUteis } from "./datas.ts";
import { dependentes, prazoEfetivo, proximoId, situacaoEtapa } from "./fluxo.ts";
import { gerarPlanilha, lerPlanilha, PlanilhaInvalidaError } from "./planilha.ts";
import type { Atividade, Dados, Etapa } from "./tipos.ts";

// 2026-09-14 é segunda-feira.
const SEG = "2026-09-14";

test("dia da semana", () => {
  assert.equal(diaDaSemana(SEG), 1);
  assert.equal(diaDaSemana("2026-09-19"), 6);
});

test("somar dias úteis pula fim de semana", () => {
  assert.equal(somarDiasUteis(SEG, 1), "2026-09-15");
  assert.equal(somarDiasUteis(SEG, 5), "2026-09-21");
  assert.equal(somarDiasUteis("2026-09-18", 1), "2026-09-21"); // sexta + 1 = segunda
  assert.equal(somarDiasUteis("2026-09-19", 0), "2026-09-21"); // sábado começa na segunda
  assert.equal(somarDiasUteis("2026-09-19", 1), "2026-09-22");
});

test("dias úteis entre datas", () => {
  assert.equal(diasUteisEntre(SEG, SEG), 0);
  assert.equal(diasUteisEntre(SEG, "2026-09-21"), 5);
  assert.equal(diasUteisEntre("2026-09-21", SEG), -5);
  assert.equal(diasUteisEntre("2026-09-18", "2026-09-20"), 0); // sexta → domingo
});

test("ler datas em texto", () => {
  assert.equal(lerDataTexto("5/9/2026"), "2026-09-05");
  assert.equal(lerDataTexto("2026-02-30"), null);
});

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
    criadaEm: SEG,
    fluxoId: null,
    ordem: 0,
    slaDiasUteis: null,
    predecessoras: [],
    ...parcial,
  };
}

test("situação da etapa pelo SLA", () => {
  const e = etapa({ status: "Em andamento", dataInicio: SEG, slaDiasUteis: 3 });
  assert.equal(prazoEfetivo(e), "2026-09-17");
  assert.deepEqual(situacaoEtapa(e, [e], "2026-09-15"), { tipo: "no-prazo", dias: 2 });
  assert.deepEqual(situacaoEtapa(e, [e], "2026-09-17"), { tipo: "vence-hoje" });
  assert.deepEqual(situacaoEtapa(e, [e], "2026-09-21"), { tipo: "atrasada", dias: 2 });

  const concluida = { ...e, status: "Concluída" as const, dataConclusao: "2026-09-18" };
  assert.deepEqual(situacaoEtapa(concluida, [concluida], "2026-09-30"), {
    tipo: "concluida-com-atraso",
    dias: 1,
  });
});

test("prazo manual prevalece sobre o SLA", () => {
  assert.equal(prazoEfetivo(etapa({ dataInicio: SEG, slaDiasUteis: 3, prazo: "2026-10-01" })), "2026-10-01");
});

test("etapa bloqueada por predecessora pendente", () => {
  const a = etapa({ id: "E-001" });
  const b = etapa({ id: "E-002", predecessoras: ["E-001"] });
  assert.equal(situacaoEtapa(b, [a, b], SEG).tipo, "bloqueada");
  const aFeita = { ...a, status: "Concluída" as const };
  assert.equal(situacaoEtapa(b, [aFeita, b], SEG).tipo, "sem-prazo");
});

test("dependentes evita ciclos", () => {
  const etapas = [
    etapa({ id: "E-001" }),
    etapa({ id: "E-002", predecessoras: ["E-001"] }),
    etapa({ id: "E-003", predecessoras: ["E-002"] }),
  ];
  assert.deepEqual([...dependentes("E-001", etapas)].sort(), ["E-002", "E-003"]);
});

test("próximo id", () => {
  assert.equal(proximoId("E", ["E-001", "E-009", "X-100"]), "E-010");
  assert.equal(proximoId("P", []), "P-001");
});

test("planilha: grava e lê de volta sem perdas", () => {
  const dados: Dados = {
    pessoas: [{ id: "P-001", nome: "Ana Souza", area: "Produtos", papel: "Gestor", email: "ana@x.com" }],
    atividades: [
      atividade({
        id: "A-001",
        titulo: "Desenvolvimento de produtos",
        descricao: "Novo plano",
        responsavelId: "P-001",
        prioridade: "Alta",
        status: "Em andamento",
        dataInicio: SEG,
        prazo: "2026-12-31",
      }),
      atividade({
        id: "A-002",
        titulo: "Preencher REG 568",
        fluxoId: "F-001",
        ordem: 1,
        slaDiasUteis: 3,
        prazo: "2026-09-17",
      }),
      atividade({
        id: "A-003",
        titulo: "Solicitação de NTA",
        fluxoId: "F-001",
        ordem: 2,
        slaDiasUteis: 2,
        predecessoras: ["A-002"],
      }),
    ],
    etapas: [
      etapa({ id: "E-001", responsavelId: "P-001", dataInicio: SEG, slaDiasUteis: 5, status: "Concluída", dataConclusao: "2026-09-18" }),
      etapa({ id: "E-002", ordem: 2, titulo: "Aprovação", predecessoras: ["E-001"], observacoes: "Diretoria" }),
    ],
    modelos: [
      { id: "FM-001", nome: "Desenvolvimento de produto", descricao: "Fluxo padrão", criadoEm: SEG },
    ],
    modeloItens: [
      {
        id: "MI-001",
        modeloId: "FM-001",
        ordem: 1,
        titulo: "Preencher REG 568",
        responsavelId: "P-001",
        prioridade: "Alta",
        slaDiasUteis: 3,
        predecessoras: [],
      },
      {
        id: "MI-002",
        modeloId: "FM-001",
        ordem: 2,
        titulo: "Solicitação de NTA",
        responsavelId: null,
        prioridade: "Média",
        slaDiasUteis: 2,
        predecessoras: ["MI-001"],
      },
    ],
    fluxos: [{ id: "F-001", modeloId: "FM-001", nome: "Produto 2026", dataInicio: SEG, criadoEm: SEG }],
  };
  const lido = lerPlanilha(gerarPlanilha(dados));
  assert.deepEqual(lido.avisos, []);
  assert.equal(lido.vazia, false);
  assert.deepEqual(lido.dados, dados);
});

test("planilha da versão 1, sem abas de fluxo, continua sendo lida", () => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([["ID", "Nome", "Área", "Papel", "E-mail"], ["P-001", "Ana", "TI", "Membro", ""]]),
    "Pessoas",
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ["ID", "Título", "Descrição", "Responsável (ID)", "Prioridade", "Status", "Data início", "Prazo", "Criada em"],
      ["A-001", "Atividade antiga", "", "P-001", "Alta", "A fazer", null, null, "2026-09-14"],
    ]),
    "Atividades",
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ["ID", "Atividade (ID)", "Ordem", "Etapa", "Responsável (ID)", "Status", "Data início", "Prazo", "SLA (dias úteis)", "Predecessoras", "Data conclusão", "Observações"],
      ["E-001", "A-001", 1, "Etapa antiga", "", "A fazer", null, null, null, "", null, ""],
    ]),
    "Etapas",
  );
  const r = lerPlanilha(XLSX.write(wb, { type: "array", bookType: "xlsx" }));
  assert.deepEqual(r.avisos, []);
  assert.equal(r.dados.atividades.length, 1);
  assert.equal(r.dados.atividades[0].fluxoId, null);
  assert.deepEqual(r.dados.atividades[0].predecessoras, []);
  assert.deepEqual(r.dados.modelos, []);
  assert.deepEqual(r.dados.fluxos, []);
  assert.deepEqual(r.dados.modeloItens, []);
});

test("planilha vazia é aceita como nova", () => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([]), "Planilha1");
  const r = lerPlanilha(XLSX.write(wb, { type: "array", bookType: "xlsx" }));
  assert.equal(r.vazia, true);
});

test("planilha com outro conteúdo é recusada", () => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Orçamento"], [100]]), "Planilha1");
  assert.throws(() => lerPlanilha(XLSX.write(wb, { type: "array", bookType: "xlsx" })), PlanilhaInvalidaError);
});

test("valores inválidos viram avisos", () => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["ID", "Nome", "Área", "Papel", "E-mail"]]), "Pessoas");
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ["ID", "Título", "Descrição", "Responsável (ID)", "Prioridade", "Status", "Data início", "Prazo", "Criada em"],
      ["A-001", "Teste", "", "P-999", "Altíssima", "Feito", "31/02/2026", "10/10/2026", "01/09/2026"],
    ]),
    "Atividades",
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ["ID", "Atividade (ID)", "Ordem", "Etapa", "Responsável (ID)", "Status", "Data início", "Prazo", "SLA (dias úteis)", "Predecessoras", "Data conclusão", "Observações"],
    ]),
    "Etapas",
  );
  const r = lerPlanilha(XLSX.write(wb, { type: "array", bookType: "xlsx" }));
  const a = r.dados.atividades[0];
  assert.equal(a.responsavelId, null);
  assert.equal(a.prioridade, "Média");
  assert.equal(a.status, "A fazer");
  assert.equal(a.dataInicio, null);
  assert.equal(a.prazo, "2026-10-10");
  assert.equal(r.avisos.length, 4);
});
