"use client";

import { toast } from "@heroui/react";
import { useState } from "react";
import { hoje, somarDiasUteis } from "@/lib/datas";
import { dependentes, etapasDaAtividade, proximoId } from "@/lib/fluxo";
import { aplicarStatusEtapa, salvarAtividade, salvarEtapa, salvarPessoa } from "@/lib/operacoes";
import { useDados } from "@/lib/store";
import { PAPEIS, PRIORIDADES, STATUS, type Atividade, type Etapa, type Pessoa } from "@/lib/tipos";
import {
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
      criadaEm: hoje(),
    },
  );
  const set = <K extends keyof Atividade>(k: K, v: Atividade[K]) => setValor((a) => ({ ...a, [k]: v }));
  const prazoAntesDoInicio = !!valor.dataInicio && !!valor.prazo && valor.prazo < valor.dataInicio;

  return (
    <JanelaFormulario
      aberta
      podeSalvar={valor.titulo.trim() !== "" && !prazoAntesDoInicio}
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
          onChange={(v) => v && set("status", v as Atividade["status"])}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
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
