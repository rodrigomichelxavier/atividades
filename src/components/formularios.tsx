"use client";

import { toast } from "@heroui/react";
import { useState } from "react";
import { hoje, somarDiasUteis } from "@/lib/datas";
import { dependentes, dependentesDoItem, etapasDaAtividade, itensDoModelo, proximoId } from "@/lib/fluxo";
import {
  aplicarStatusAtividade,
  aplicarStatusEtapa,
  salvarAtividade,
  salvarEtapa,
  salvarModelo,
  salvarModeloItem,
  salvarPessoa,
} from "@/lib/operacoes";
import { useDados } from "@/lib/store";
import {
  ATIVIDADE_SEM_FLUXO,
  PAPEIS,
  PRIORIDADES,
  STATUS,
  type Atividade,
  type Etapa,
  type FluxoModelo,
  type ModeloItem,
  type Pessoa,
} from "@/lib/tipos";
import {
  CampoCheck,
  CampoMultiplo,
  CampoSelecao,
  CampoTexto,
  JanelaFormulario,
  opcoesDe,
  opcoesPessoas,
} from "./comum";

// ---------- Pessoa ----------

export function FormPessoa({ pessoa, onFechar }: { pessoa: Pessoa | null; onFechar: () => void }) {
  const { dados, alterar } = useDados();
  const [valor, setValor] = useState<Pessoa>(
    pessoa ?? { id: "", nome: "", area: "", papel: "Membro", email: "" },
  );
  const set = <K extends keyof Pessoa>(k: K, v: Pessoa[K]) => setValor((p) => ({ ...p, [k]: v }));

  return (
    <JanelaFormulario
      aberta
      podeSalvar={valor.nome.trim() !== ""}
      titulo={pessoa ? "Editar pessoa" : "Nova pessoa"}
      onFechar={onFechar}
      onSalvar={() => {
        const id = valor.id || proximoId("P", dados.pessoas.map((p) => p.id));
        alterar((d) => salvarPessoa(d, { ...valor, id, nome: valor.nome.trim() }));
        toast.success(pessoa ? "Pessoa atualizada" : "Pessoa cadastrada");
        onFechar();
      }}
    >
      <CampoTexto autoFocus obrigatorio label="Nome" valor={valor.nome} onChange={(v) => set("nome", v)} />
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoTexto label="Área" valor={valor.area} onChange={(v) => set("area", v)} />
        <CampoSelecao
          label="Papel"
          opcoes={opcoesDe(PAPEIS)}
          valor={valor.papel}
          onChange={(v) => v && set("papel", v as Pessoa["papel"])}
        />
      </div>
      <CampoTexto label="E-mail" tipo="email" valor={valor.email} onChange={(v) => set("email", v)} />
    </JanelaFormulario>
  );
}

// ---------- Atividade ----------

export function FormAtividade({
  atividade,
  onFechar,
  onCriada,
}: {
  atividade: Atividade | null;
  onFechar: () => void;
  onCriada?: (id: string) => void;
}) {
  const { dados, alterar } = useDados();
  const [valor, setValor] = useState<Atividade>(
    atividade ?? {
      id: "",
      titulo: "",
      descricao: "",
      responsavelId: null,
      prioridade: "Média",
      status: "A fazer",
      dataInicio: null,
      prazo: null,
      dataConclusao: null,
      criadaEm: hoje(),
      ...ATIVIDADE_SEM_FLUXO,
    },
  );
  const set = <K extends keyof Atividade>(k: K, v: Atividade[K]) => setValor((a) => ({ ...a, [k]: v }));
  const prazoAntesDoInicio = !!valor.dataInicio && !!valor.prazo && valor.prazo < valor.dataInicio;
  const conclusaoAntesDoInicio =
    !!valor.dataInicio && !!valor.dataConclusao && valor.dataConclusao < valor.dataInicio;

  return (
    <JanelaFormulario
      aberta
      podeSalvar={valor.titulo.trim() !== "" && !prazoAntesDoInicio && !conclusaoAntesDoInicio}
      tamanho="lg"
      titulo={atividade ? "Editar atividade" : "Nova atividade"}
      onFechar={onFechar}
      onSalvar={() => {
        const id = valor.id || proximoId("A", dados.atividades.map((a) => a.id));
        alterar((d) => salvarAtividade(d, { ...valor, id, titulo: valor.titulo.trim() }));
        toast.success(atividade ? "Atividade atualizada" : "Atividade criada");
        onFechar();
        if (!atividade) onCriada?.(id);
      }}
    >
      <CampoTexto
        autoFocus
        obrigatorio
        label="Título"
        placeholder="Ex.: Desenvolvimento de produtos"
        valor={valor.titulo}
        onChange={(v) => set("titulo", v)}
      />
      <CampoTexto multilinha label="Descrição" valor={valor.descricao} onChange={(v) => set("descricao", v)} />
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <CampoSelecao
          label="Responsável"
          opcoes={opcoesPessoas(dados.pessoas)}
          permitirVazio="Sem responsável"
          valor={valor.responsavelId}
          onChange={(v) => set("responsavelId", v)}
        />
        <CampoSelecao
          label="Prioridade"
          opcoes={opcoesDe(PRIORIDADES)}
          valor={valor.prioridade}
          onChange={(v) => v && set("prioridade", v as Atividade["prioridade"])}
        />
        <CampoSelecao
          label="Status"
          opcoes={opcoesDe(STATUS)}
          valor={valor.status}
          onChange={(v) => v && setValor((a) => aplicarStatusAtividade(a, v as Atividade["status"]))}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <CampoTexto
          label="Data de início"
          tipo="date"
          valor={valor.dataInicio ?? ""}
          onChange={(v) => set("dataInicio", v || null)}
        />
        <CampoTexto
          descricao={prazoAntesDoInicio ? "O prazo não pode ser antes do início." : undefined}
          label="Prazo"
          tipo="date"
          valor={valor.prazo ?? ""}
          onChange={(v) => set("prazo", v || null)}
        />
        <CampoTexto
          descricao={conclusaoAntesDoInicio ? "A conclusão não pode ser antes do início." : undefined}
          label="Data de conclusão"
          tipo="date"
          valor={valor.dataConclusao ?? ""}
          onChange={(v) => {
            const data = v || null;
            setValor((a) => ({
              ...a,
              dataConclusao: data,
              status: data ? "Concluída" : a.status === "Concluída" ? "Em andamento" : a.status,
            }));
          }}
        />
      </div>
    </JanelaFormulario>
  );
}

// ---------- Etapa ----------

export function FormEtapa({
  atividadeId,
  etapa,
  onFechar,
}: {
  atividadeId: string;
  etapa: Etapa | null;
  onFechar: () => void;
}) {
  const { dados, alterar } = useDados();
  const irmas = etapasDaAtividade(atividadeId, dados.etapas);
  const [valor, setValor] = useState<Etapa>(
    etapa ?? {
      id: "",
      atividadeId,
      ordem: (irmas.at(-1)?.ordem ?? 0) + 1,
      titulo: "",
      responsavelId: null,
      status: "A fazer",
      dataInicio: null,
      prazo: null,
      slaDiasUteis: null,
      predecessoras: irmas.length > 0 ? [irmas.at(-1)!.id] : [],
      dataConclusao: null,
      observacoes: "",
    },
  );
  const set = <K extends keyof Etapa>(k: K, v: Etapa[K]) => setValor((e) => ({ ...e, [k]: v }));

  // Não pode ser predecessora de si mesma nem de quem já depende dela (evita ciclos).
  const bloqueadas = etapa ? dependentes(etapa.id, dados.etapas) : new Set<string>();
  const opcoesPredecessoras = irmas
    .filter((e) => e.id !== valor.id && !bloqueadas.has(e.id))
    .map((e) => ({ id: e.id, rotulo: `${e.id} · ${e.titulo}` }));

  const pendentes = valor.predecessoras
    .map((id) => dados.etapas.find((e) => e.id === id))
    .filter((e): e is Etapa => !!e && e.status !== "Concluída");
  const statusBloqueado = pendentes.length > 0 && (valor.status === "Em andamento" || valor.status === "Concluída");

  const prazoSlaCalculado =
    valor.dataInicio && valor.slaDiasUteis != null ? somarDiasUteis(valor.dataInicio, valor.slaDiasUteis) : null;
  const conclusaoAntesDoInicio =
    !!valor.dataInicio && !!valor.dataConclusao && valor.dataConclusao < valor.dataInicio;

  return (
    <JanelaFormulario
      aberta
      podeSalvar={valor.titulo.trim() !== "" && !statusBloqueado && !conclusaoAntesDoInicio}
      tamanho="lg"
      titulo={etapa ? `Editar etapa ${etapa.id}` : "Nova etapa"}
      onFechar={onFechar}
      onSalvar={() => {
        const id = valor.id || proximoId("E", dados.etapas.map((e) => e.id));
        const final = aplicarStatusEtapa({ ...valor, id, titulo: valor.titulo.trim() }, valor.status);
        alterar((d) => salvarEtapa(d, final));
        toast.success(etapa ? "Etapa atualizada" : "Etapa criada");
        onFechar();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-[1fr_7rem]">
        <CampoTexto
          autoFocus
          obrigatorio
          label="Etapa"
          placeholder="Ex.: Levantamento de requisitos"
          valor={valor.titulo}
          onChange={(v) => set("titulo", v)}
        />
        <CampoTexto
          label="Ordem"
          tipo="number"
          valor={String(valor.ordem)}
          onChange={(v) => set("ordem", Math.max(0, Math.floor(Number(v) || 0)))}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoSelecao
          label="Responsável"
          opcoes={opcoesPessoas(dados.pessoas)}
          permitirVazio="Sem responsável"
          valor={valor.responsavelId}
          onChange={(v) => set("responsavelId", v)}
        />
        <CampoSelecao
          descricao={
            statusBloqueado
              ? `Conclua antes: ${pendentes.map((p) => p.titulo).join(", ")}.`
              : "Iniciar ou concluir preenche as datas de hoje, se estiverem vazias."
          }
          label="Status"
          opcoes={opcoesDe(STATUS)}
          valor={valor.status}
          onChange={(v) => v && set("status", v as Etapa["status"])}
        />
      </div>
      <CampoMultiplo
        descricao={
          irmas.length === 0 || opcoesPredecessoras.length === 0
            ? "Nenhuma outra etapa disponível nesta atividade."
            : "A etapa só pode começar depois que estas forem concluídas."
        }
        label="Predecessoras"
        opcoes={opcoesPredecessoras}
        placeholder="Nenhuma"
        valores={valor.predecessoras.filter((id) => opcoesPredecessoras.some((o) => o.id === id))}
        onChange={(v) => set("predecessoras", v)}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <CampoTexto
          label="Data de início"
          tipo="date"
          valor={valor.dataInicio ?? ""}
          onChange={(v) => set("dataInicio", v || null)}
        />
        <CampoTexto
          descricao="Dias úteis (seg–sex) a partir do início."
          label="SLA (dias úteis)"
          tipo="number"
          valor={valor.slaDiasUteis == null ? "" : String(valor.slaDiasUteis)}
          onChange={(v) => set("slaDiasUteis", v === "" ? null : Math.max(0, Math.floor(Number(v) || 0)))}
        />
        <CampoTexto
          descricao={
            prazoSlaCalculado
              ? `Pelo SLA: ${prazoSlaCalculado.split("-").reverse().join("/")}. Deixe vazio para usar.`
              : "Opcional quando houver SLA e data de início."
          }
          label="Prazo"
          tipo="date"
          valor={valor.prazo ?? ""}
          onChange={(v) => set("prazo", v || null)}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <CampoTexto
          descricao={conclusaoAntesDoInicio ? "A conclusão não pode ser antes do início." : undefined}
          label="Data de conclusão"
          tipo="date"
          valor={valor.dataConclusao ?? ""}
          onChange={(v) => {
            const data = v || null;
            setValor((e) => ({
              ...e,
              dataConclusao: data,
              status: data ? "Concluída" : e.status === "Concluída" ? "Em andamento" : e.status,
            }));
          }}
        />
      </div>
      <CampoTexto multilinha label="Observações" valor={valor.observacoes} onChange={(v) => set("observacoes", v)} />
    </JanelaFormulario>
  );
}

// ---------- Fluxo de trabalho ----------

export function FormModelo({ modelo, onFechar, onCriado }: { modelo: FluxoModelo | null; onFechar: () => void; onCriado?: (id: string) => void }) {
  const { dados, alterar } = useDados();
  const [valor, setValor] = useState<FluxoModelo>(
    modelo ?? { id: "", nome: "", descricao: "", criadoEm: hoje() },
  );

  return (
    <JanelaFormulario
      aberta
      podeSalvar={valor.nome.trim() !== ""}
      titulo={modelo ? "Editar fluxo padrão" : "Novo fluxo padrão"}
      onFechar={onFechar}
      onSalvar={() => {
        const id = valor.id || proximoId("FM", dados.modelos.map((m) => m.id));
        alterar((d) => salvarModelo(d, { ...valor, id, nome: valor.nome.trim() }));
        toast.success(modelo ? "Fluxo padrão atualizado" : "Fluxo padrão criado");
        onFechar();
        if (!modelo) onCriado?.(id);
      }}
    >
      <CampoTexto
        autoFocus
        obrigatorio
        label="Nome do fluxo"
        placeholder="Ex.: Desenvolvimento de produto"
        valor={valor.nome}
        onChange={(v) => setValor((m) => ({ ...m, nome: v }))}
      />
      <CampoTexto
        multilinha
        descricao="Opcional. Aparece na lista de fluxos padrão."
        label="Descrição"
        valor={valor.descricao}
        onChange={(v) => setValor((m) => ({ ...m, descricao: v }))}
      />
    </JanelaFormulario>
  );
}

export function FormModeloItem({
  modeloId,
  item,
  onFechar,
}: {
  modeloId: string;
  item: ModeloItem | null;
  onFechar: () => void;
}) {
  const { dados, alterar } = useDados();
  const irmas = itensDoModelo(modeloId, dados.modeloItens);
  const [valor, setValor] = useState<ModeloItem>(
    item ?? {
      id: "",
      modeloId,
      ordem: (irmas.at(-1)?.ordem ?? 0) + 1,
      titulo: "",
      responsavelId: null,
      prioridade: "Média",
      slaDiasUteis: null,
      predecessoras: irmas.length > 0 ? [irmas.at(-1)!.id] : [],
    },
  );
  const set = <K extends keyof ModeloItem>(k: K, v: ModeloItem[K]) => setValor((i) => ({ ...i, [k]: v }));

  // Não pode depender de si mesma nem de quem já depende dela (evita ciclos).
  const bloqueadas = item ? dependentesDoItem(item.id, dados.modeloItens) : new Set<string>();
  const opcoesPredecessoras = irmas
    .filter((i) => i.id !== valor.id && !bloqueadas.has(i.id))
    .map((i) => ({ id: i.id, rotulo: i.titulo }));

  return (
    <JanelaFormulario
      aberta
      podeSalvar={valor.titulo.trim() !== ""}
      tamanho="lg"
      titulo={item ? "Editar atividade do fluxo" : "Nova atividade do fluxo"}
      onFechar={onFechar}
      onSalvar={() => {
        const id = valor.id || proximoId("MI", dados.modeloItens.map((i) => i.id));
        alterar((d) => salvarModeloItem(d, { ...valor, id, titulo: valor.titulo.trim() }));
        toast.success(item ? "Atividade atualizada" : "Atividade adicionada ao fluxo");
        onFechar();
      }}
    >
      <CampoTexto
        autoFocus
        obrigatorio
        label="Atividade"
        placeholder="Ex.: Protocolo de NTA"
        valor={valor.titulo}
        onChange={(v) => set("titulo", v)}
      />
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <CampoSelecao
          descricao="Sugestão ao iniciar o fluxo; dá para trocar na hora."
          label="Responsável padrão"
          opcoes={opcoesPessoas(dados.pessoas)}
          permitirVazio="Sem responsável"
          valor={valor.responsavelId}
          onChange={(v) => set("responsavelId", v)}
        />
        <CampoSelecao
          label="Prioridade"
          opcoes={opcoesDe(PRIORIDADES)}
          valor={valor.prioridade}
          onChange={(v) => v && set("prioridade", v as ModeloItem["prioridade"])}
        />
        <CampoTexto
          descricao="Dias úteis. Vazio = 1 dia."
          label="SLA (dias úteis)"
          tipo="number"
          valor={valor.slaDiasUteis == null ? "" : String(valor.slaDiasUteis)}
          onChange={(v) => set("slaDiasUteis", v === "" ? null : Math.max(0, Math.floor(Number(v) || 0)))}
        />
      </div>
      <CampoMultiplo
        descricao={
          opcoesPredecessoras.length === 0
            ? "Nenhuma outra atividade disponível neste fluxo."
            : "Começa depois que estas terminarem. Sem predecessora, começa junto com o fluxo."
        }
        label="Depende de"
        opcoes={opcoesPredecessoras}
        placeholder="Nenhuma (começa no início do fluxo)"
        valores={valor.predecessoras.filter((id) => opcoesPredecessoras.some((o) => o.id === id))}
        onChange={(v) => set("predecessoras", v)}
      />
    </JanelaFormulario>
  );
}

/** Cola uma lista pronta: uma atividade por linha, encadeadas na ordem. */
export function FormModeloLote({ modeloId, onFechar }: { modeloId: string; onFechar: () => void }) {
  const { alterar } = useDados();
  const [texto, setTexto] = useState("");
  const [encadear, setEncadear] = useState(false);

  const titulos = texto
    .split("\n")
    .map((l) => l.replace(/^\s*(\d+[.)-]|[-*•])\s*/, "").trim())
    .filter(Boolean);

  return (
    <JanelaFormulario
      aberta
      podeSalvar={titulos.length > 0}
      tamanho="lg"
      titulo="Colar lista de atividades"
      onFechar={onFechar}
      onSalvar={() => {
        alterar((d) => {
          let dadosAtuais = d;
          const irmas = itensDoModelo(modeloId, d.modeloItens);
          let ordem = (irmas.at(-1)?.ordem ?? 0) + 1;
          let anterior = irmas.at(-1)?.id ?? null;
          for (const titulo of titulos) {
            const id = proximoId("MI", dadosAtuais.modeloItens.map((i) => i.id));
            dadosAtuais = salvarModeloItem(dadosAtuais, {
              id,
              modeloId,
              ordem: ordem++,
              titulo,
              responsavelId: null,
              prioridade: "Média",
              slaDiasUteis: null,
              predecessoras: encadear && anterior ? [anterior] : [],
            });
            anterior = id;
          }
          return dadosAtuais;
        });
        toast.success(`${titulos.length} atividade(s) adicionada(s)`);
        onFechar();
      }}
    >
      <CampoTexto
        autoFocus
        multilinha
        descricao="Uma atividade por linha. Numeração e marcadores no começo da linha são descartados."
        label="Atividades"
        placeholder={"Preencher REG 568\nSolicitação de NTA Controladoria\nAprovação de preços NTA"}
        valor={texto}
        onChange={setTexto}
      />
      <CampoCheck
        descricao="Cada uma passa a começar depois que a anterior terminar. Deixe desmarcado para definir as dependências você mesmo, uma a uma."
        marcado={encadear}
        rotulo="Já encadear na ordem da lista"
        onChange={setEncadear}
      />
      {titulos.length > 0 && (
        <p className="text-sm text-muted">
          {titulos.length} atividade(s) serão adicionadas ao fim do fluxo, {encadear ? "encadeadas na ordem" : "sem dependência entre elas"}. O SLA
          fica vazio (1 dia útil) — ajuste depois na lista.
        </p>
      )}
    </JanelaFormulario>
  );
}
