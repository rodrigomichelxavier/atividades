"use client";

import { Tabs, toast } from "@heroui/react";
import { useState, type DragEvent, type ReactNode } from "react";
import { hoje } from "@/lib/datas";
import { atividadeAtrasada, prazoEfetivo, progressoAtividade, situacaoEtapa } from "@/lib/fluxo";
import { mudarStatusAtividade, mudarStatusEtapa } from "@/lib/operacoes";
import { useDados } from "@/lib/store";
import { STATUS, type Status } from "@/lib/tipos";
import { CampoSelecao, ChipPrioridade, ChipSituacao, DataTexto, nomePessoa, opcoesPessoas } from "./comum";

type Modo = "atividades" | "etapas";

const COR_COLUNA: Record<Status, string> = {
  "A fazer": "bg-default",
  "Em andamento": "bg-accent",
  Aguardando: "bg-warning",
  Concluída: "bg-success",
};

export function Kanban({ onAbrirAtividade }: { onAbrirAtividade: (id: string) => void }) {
  const { dados, alterar } = useDados();
  const [modo, setModo] = useState<Modo>("etapas");
  const [responsavel, setResponsavel] = useState<string | null>(null);
  const [sobre, setSobre] = useState<Status | null>(null);
  const dataHoje = hoje();

  function soltar(status: Status, e: DragEvent) {
    e.preventDefault();
    setSobre(null);
    const id = e.dataTransfer.getData("text/plain");
    if (!id) return;
    if (modo === "atividades") {
      alterar((d) => mudarStatusAtividade(d, id, status));
      return;
    }
    const r = mudarStatusEtapa(dados, id, status);
    if (!r.ok) toast.warning("Etapa bloqueada", { description: r.erro });
    else alterar(() => r.dados);
  }

  const cartoes: Record<Status, ReactNode[]> = { "A fazer": [], "Em andamento": [], Aguardando: [], Concluída: [] };

  if (modo === "atividades") {
    for (const a of dados.atividades) {
      if (responsavel && a.responsavelId !== responsavel) continue;
      cartoes[a.status].push(
        <Cartao key={a.id} id={a.id} onAbrir={() => onAbrirAtividade(a.id)}>
          <div className="flex items-start justify-between gap-2">
            <span className="font-medium">{a.titulo}</span>
            <ChipPrioridade prioridade={a.prioridade} />
          </div>
          <div className="flex justify-between text-xs text-muted">
            <span>{nomePessoa(dados.pessoas, a.responsavelId)}</span>
            <DataTexto data={a.prazo} destaque={atividadeAtrasada(a, dataHoje) ? "danger" : undefined} />
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-default">
            <div className="h-full bg-accent" style={{ width: `${progressoAtividade(a.id, dados.etapas)}%` }} />
          </div>
        </Cartao>,
      );
    }
  } else {
    const porPrazo = [...dados.etapas].sort((a, b) =>
      (prazoEfetivo(a) ?? "9999").localeCompare(prazoEfetivo(b) ?? "9999"),
    );
    for (const e of porPrazo) {
      if (responsavel && e.responsavelId !== responsavel) continue;
      const atividade = dados.atividades.find((a) => a.id === e.atividadeId);
      cartoes[e.status].push(
        <Cartao key={e.id} id={e.id} onAbrir={() => onAbrirAtividade(e.atividadeId)}>
          <span className="text-xs text-muted">{atividade?.titulo}</span>
          <span className="font-medium">{e.titulo}</span>
          <div className="flex justify-between text-xs text-muted">
            <span>{nomePessoa(dados.pessoas, e.responsavelId)}</span>
            <DataTexto data={prazoEfetivo(e)} />
          </div>
          <div>
            <ChipSituacao situacao={situacaoEtapa(e, dados.etapas, dataHoje)} />
          </div>
        </Cartao>,
      );
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Tabs selectedKey={modo} variant="secondary" onSelectionChange={(k) => setModo(k as Modo)}>
          <Tabs.ListContainer>
            <Tabs.List aria-label="O que mostrar">
              <Tabs.Tab id="etapas">
                Etapas
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="atividades">
                Atividades
                <Tabs.Indicator />
              </Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>
        </Tabs>
        <div className="w-full sm:w-56">
          <CampoSelecao
            label="Responsável"
            opcoes={opcoesPessoas(dados.pessoas)}
            permitirVazio="Todos"
            valor={responsavel}
            onChange={setResponsavel}
          />
        </div>
      </div>
      <p className="text-sm text-muted">
        Arraste os cartões entre as colunas para mudar o status. Clique para abrir a atividade.
      </p>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {STATUS.map((status) => (
          <section
            key={status}
            aria-label={status}
            className={`flex min-h-24 flex-col md:min-h-64 gap-3 rounded-2xl bg-surface-secondary p-3 transition-shadow ${
              sobre === status ? "ring-2 ring-accent" : ""
            }`}
            onDragLeave={() => setSobre((s) => (s === status ? null : s))}
            onDragOver={(e) => {
              e.preventDefault();
              setSobre(status);
            }}
            onDrop={(e) => soltar(status, e)}
          >
            <header className="flex items-center gap-2 px-1">
              <span className={`size-2 rounded-full ${COR_COLUNA[status]}`} />
              <h3 className="text-sm font-semibold">{status}</h3>
              <span className="ml-auto text-xs text-muted">{cartoes[status].length}</span>
            </header>
            {cartoes[status]}
          </section>
        ))}
      </div>
    </div>
  );
}

function Cartao({ id, onAbrir, children }: { id: string; onAbrir: () => void; children: ReactNode }) {
  return (
    <div
      draggable
      className="flex cursor-grab flex-col gap-2 rounded-xl bg-surface p-3 text-sm shadow-sm hover:shadow-md active:cursor-grabbing"
      role="button"
      tabIndex={0}
      onClick={onAbrir}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onKeyDown={(e) => e.key === "Enter" && onAbrir()}
    >
      {children}
    </div>
  );
}
