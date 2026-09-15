"use client";

import {
  ArrowLeft,
  CircleCheck,
  ListUl,
  Magnifier,
  Pencil,
  Play,
  Plus,
  TrashBin,
} from "@gravity-ui/icons";
import { Button, Card, Input, Label, ProgressBar, Table, TextField, Tooltip, toast } from "@heroui/react";
import { useMemo, useState } from "react";
import { hoje } from "@/lib/datas";
import { dentroDoIntervalo, intervaloDoPeriodo, PERIODOS, type Periodo } from "@/lib/periodos";
import {
  atividadeAtrasada,
  etapasDaAtividade,
  prazoEfetivo,
  prazoSla,
  progressoAtividade,
  situacaoEtapa,
} from "@/lib/fluxo";
import { excluirAtividade, excluirEtapa, mudarStatusEtapa } from "@/lib/operacoes";
import { useDados } from "@/lib/store";
import { STATUS, type Atividade, type Etapa, type Status } from "@/lib/tipos";
import {
  CampoSelecao,
  CampoTexto,
  ChipPrioridade,
  ChipSituacao,
  ChipStatus,
  ConfirmarExclusao,
  DataTexto,
  nomePessoa,
  opcoesDe,
  opcoesPessoas,
  Paginacao,
  Vazio,
} from "./comum";
import { FormAtividade, FormEtapa } from "./formularios";

export function Atividades({
  selecionada,
  onSelecionar,
}: {
  selecionada: string | null;
  onSelecionar: (id: string | null) => void;
}) {
  const { dados } = useDados();
  const atividade = dados.atividades.find((a) => a.id === selecionada);
  if (selecionada && atividade) {
    return <DetalheAtividade atividade={atividade} onVoltar={() => onSelecionar(null)} />;
  }
  return <ListaAtividades onAbrir={onSelecionar} />;
}

// ---------- Lista ----------

const PESO_PRIORIDADE = { Urgente: 0, Alta: 1, Média: 2, Baixa: 3 };

const ROTINA = "__rotina__";
const FLUXO = "__fluxo__";

/** Origem: rotina, qualquer fluxo, ou um fluxo específico. */
function opcoesOrigem(fluxos: { id: string; nome: string; dataInicio: string }[]) {
  return [
    { id: ROTINA, rotulo: "Atividades de rotina" },
    { id: FLUXO, rotulo: "Atividades de fluxo" },
    ...[...fluxos]
      .sort((a, b) => b.dataInicio.localeCompare(a.dataInicio))
      .map((f) => ({ id: f.id, rotulo: `Fluxo: ${f.nome}` })),
  ];
}

function ListaAtividades({ onAbrir }: { onAbrir: (id: string) => void }) {
  const { dados } = useDados();
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState<string | null>("abertas");
  const [responsavel, setResponsavel] = useState<string | null>(null);
  const [origem, setOrigem] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState<Periodo>("Todo o período");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(25);
  const [criando, setCriando] = useState(false);
  const dataHoje = hoje();

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const intervalo = intervaloDoPeriodo(periodo, { de: de || null, ate: ate || null }, dataHoje);
    return dados.atividades
      .filter((a) => {
        if (status === "abertas" && a.status === "Concluída") return false;
        if (status && status !== "abertas" && a.status !== status) return false;
        if (responsavel && a.responsavelId !== responsavel) return false;
        if (origem === ROTINA && a.fluxoId) return false;
        if (origem === FLUXO && !a.fluxoId) return false;
        if (origem && origem !== ROTINA && origem !== FLUXO && a.fluxoId !== origem) return false;
        if (!dentroDoIntervalo(a.prazo, intervalo)) return false;
        return !termo || a.titulo.toLowerCase().includes(termo) || a.id.toLowerCase().includes(termo);
      })
      .sort(
        (a, b) =>
          PESO_PRIORIDADE[a.prioridade] - PESO_PRIORIDADE[b.prioridade] ||
          (a.prazo ?? "9999").localeCompare(b.prazo ?? "9999"),
      );
  }, [dados.atividades, busca, status, responsavel, origem, periodo, de, ate, dataHoje]);

  // Mudou o filtro, volta para a primeira página (ajuste durante a renderização,
  // que o React prefere a um efeito só para corrigir estado).
  const filtros = JSON.stringify([busca, status, responsavel, origem, periodo, de, ate, porPagina]);
  const [filtrosAnteriores, setFiltrosAnteriores] = useState(filtros);
  if (filtros !== filtrosAnteriores) {
    setFiltrosAnteriores(filtros);
    setPagina(1);
  }

  const paginas = Math.max(1, Math.ceil(lista.length / porPagina));
  const paginaAtual = Math.min(pagina, paginas);
  const visiveis = lista.slice((paginaAtual - 1) * porPagina, paginaAtual * porPagina);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <TextField className="w-full sm:w-64" value={busca} onChange={setBusca}>
          <Label>Buscar</Label>
          <div className="relative">
            <Magnifier className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
            <Input className="w-full pl-9" placeholder="Título ou ID" />
          </div>
        </TextField>
        <div className="w-full sm:w-48">
          <CampoSelecao
            label="Status"
            opcoes={[{ id: "abertas", rotulo: "Em aberto" }, ...opcoesDe(STATUS)]}
            permitirVazio="Todos"
            valor={status}
            onChange={setStatus}
          />
        </div>
        <div className="w-full sm:w-52">
          <CampoSelecao
            label="Responsável"
            opcoes={opcoesPessoas(dados.pessoas)}
            permitirVazio="Todos"
            valor={responsavel}
            onChange={setResponsavel}
          />
        </div>
        <div className="w-full sm:w-56">
          <CampoSelecao
            label="Origem"
            opcoes={opcoesOrigem(dados.fluxos)}
            permitirVazio="Todas"
            valor={origem}
            onChange={setOrigem}
          />
        </div>
        <div className="w-full sm:w-48">
          <CampoSelecao
            label="Prazo"
            opcoes={opcoesDe(PERIODOS)}
            valor={periodo}
            onChange={(v) => v && setPeriodo(v as Periodo)}
          />
        </div>
        {periodo === "Personalizado" && (
          <>
            <div className="w-full sm:w-40">
              <CampoTexto label="De" tipo="date" valor={de} onChange={setDe} />
            </div>
            <div className="w-full sm:w-40">
              <CampoTexto label="Até" tipo="date" valor={ate} onChange={setAte} />
            </div>
          </>
        )}
        <Button className="sm:ml-auto" onPress={() => setCriando(true)}>
          <Plus />
          Nova atividade
        </Button>
      </div>

      {dados.atividades.length === 0 ? (
        <Vazio
          acao={
            <Button onPress={() => setCriando(true)}>
              <Plus />
              Criar primeira atividade
            </Button>
          }
          icone={<ListUl />}
          texto="Crie uma atividade, como “Desenvolvimento de produtos”, e depois cadastre as etapas do fluxo."
          titulo="Nenhuma atividade ainda"
        />
      ) : (
        <Table>
          <Table.ScrollContainer>
            <Table.Content aria-label="Atividades" className="min-w-[860px]">
              <Table.Header>
                <Table.Column isRowHeader>Atividade</Table.Column>
                <Table.Column>Responsável</Table.Column>
                <Table.Column>Prioridade</Table.Column>
                <Table.Column>Status</Table.Column>
                <Table.Column>Prazo</Table.Column>
                <Table.Column>Etapas</Table.Column>
                <Table.Column className="text-end">Ações</Table.Column>
              </Table.Header>
              <Table.Body renderEmptyState={() => <p className="py-6 text-center text-muted">Nenhuma atividade com esses filtros.</p>}>
                {visiveis.map((a) => {
                  const etapas = etapasDaAtividade(a.id, dados.etapas);
                  const atrasadas = etapas.filter((e) => situacaoEtapa(e, dados.etapas, dataHoje).tipo === "atrasada").length;
                  return (
                    <Table.Row key={a.id} id={a.id}>
                      <Table.Cell>
                        <button className="text-left hover:underline" type="button" onClick={() => onAbrir(a.id)}>
                          <span className="block font-medium">{a.titulo}</span>
                          <span className="text-xs text-muted">
                            {a.id}
                            {a.fluxoId && ` · ${dados.fluxos.find((f) => f.id === a.fluxoId)?.nome ?? a.fluxoId}`}
                          </span>
                        </button>
                      </Table.Cell>
                      <Table.Cell>{nomePessoa(dados.pessoas, a.responsavelId)}</Table.Cell>
                      <Table.Cell>
                        <ChipPrioridade prioridade={a.prioridade} />
                      </Table.Cell>
                      <Table.Cell>
                        <ChipStatus status={a.status} />
                      </Table.Cell>
                      <Table.Cell>
                        <DataTexto data={a.prazo} destaque={atividadeAtrasada(a, dataHoje) ? "danger" : undefined} />
                      </Table.Cell>
                      <Table.Cell>
                        <div className="flex min-w-36 flex-col gap-1">
                          <ProgressBar aria-label="Progresso" size="sm" value={progressoAtividade(a.id, dados.etapas)}>
                            <ProgressBar.Track>
                              <ProgressBar.Fill />
                            </ProgressBar.Track>
                          </ProgressBar>
                          <span className="text-xs text-muted">
                            {etapas.filter((e) => e.status === "Concluída").length}/{etapas.length} concluídas
                            {atrasadas > 0 && <span className="text-danger"> · {atrasadas} atrasada(s)</span>}
                          </span>
                        </div>
                      </Table.Cell>
                      <Table.Cell className="text-end">
                        <Button size="sm" variant="secondary" onPress={() => onAbrir(a.id)}>
                          Abrir
                        </Button>
                      </Table.Cell>
                    </Table.Row>
                  );
                })}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      )}

      {dados.atividades.length > 0 && (
        <Paginacao
          pagina={paginaAtual}
          porPagina={porPagina}
          total={lista.length}
          onPagina={setPagina}
          onPorPagina={setPorPagina}
        />
      )}

      {criando && <FormAtividade atividade={null} onCriada={onAbrir} onFechar={() => setCriando(false)} />}
    </div>
  );
}

// ---------- Detalhe ----------

function DetalheAtividade({ atividade, onVoltar }: { atividade: Atividade; onVoltar: () => void }) {
  const { dados, alterar } = useDados();
  const [editando, setEditando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [etapaForm, setEtapaForm] = useState<Etapa | "nova" | null>(null);
  const [etapaExcluir, setEtapaExcluir] = useState<Etapa | null>(null);
  const dataHoje = hoje();
  const etapas = etapasDaAtividade(atividade.id, dados.etapas);
  const progresso = progressoAtividade(atividade.id, dados.etapas);

  function mudarStatus(etapa: Etapa, status: Status) {
    const r = mudarStatusEtapa(dados, etapa.id, status);
    if (!r.ok) {
      toast.warning("Etapa bloqueada", { description: r.erro });
      return;
    }
    alterar(() => r.dados);
    toast.success(status === "Concluída" ? `"${etapa.titulo}" concluída` : `"${etapa.titulo}" iniciada`);
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button size="sm" variant="ghost" onPress={onVoltar}>
          <ArrowLeft />
          Atividades
        </Button>
      </div>

      <Card>
        <Card.Header className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted">{atividade.id}</span>
            <Card.Title className="text-2xl">{atividade.titulo}</Card.Title>
            {atividade.descricao && <Card.Description className="whitespace-pre-line">{atividade.descricao}</Card.Description>}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onPress={() => setEditando(true)}>
              <Pencil />
              Editar
            </Button>
            <Button isIconOnly aria-label="Excluir atividade" size="sm" variant="danger-soft" onPress={() => setExcluindo(true)}>
              <TrashBin />
            </Button>
          </div>
        </Card.Header>
        <Card.Content className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <Info rotulo="Responsável">{nomePessoa(dados.pessoas, atividade.responsavelId)}</Info>
          <Info rotulo="Prioridade">
            <ChipPrioridade prioridade={atividade.prioridade} />
          </Info>
          <Info rotulo="Status">
            <ChipStatus status={atividade.status} />
          </Info>
          <Info rotulo="Início">
            <DataTexto data={atividade.dataInicio} />
          </Info>
          <Info rotulo="Prazo">
            <DataTexto data={atividade.prazo} destaque={atividadeAtrasada(atividade, dataHoje) ? "danger" : undefined} />
          </Info>
          <Info rotulo="Progresso">
            <ProgressBar aria-label="Progresso" size="sm" value={progresso}>
              <ProgressBar.Output />
              <ProgressBar.Track>
                <ProgressBar.Fill />
              </ProgressBar.Track>
            </ProgressBar>
          </Info>
        </Card.Content>
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Etapas do fluxo</h2>
        <Button onPress={() => setEtapaForm("nova")}>
          <Plus />
          Nova etapa
        </Button>
      </div>

      {etapas.length === 0 ? (
        <Vazio
          acao={
            <Button onPress={() => setEtapaForm("nova")}>
              <Plus />
              Adicionar etapa
            </Button>
          }
          icone={<ListUl />}
          texto="Cadastre os passos desta atividade com responsável, SLA e predecessoras."
          titulo="Nenhuma etapa cadastrada"
        />
      ) : (
        <Table>
          <Table.ScrollContainer>
            <Table.Content aria-label="Etapas" className="min-w-[1100px]">
              <Table.Header>
                <Table.Column className="w-12">#</Table.Column>
                <Table.Column isRowHeader>Etapa</Table.Column>
                <Table.Column>Responsável</Table.Column>
                <Table.Column>Status</Table.Column>
                <Table.Column>Início</Table.Column>
                <Table.Column>SLA</Table.Column>
                <Table.Column>Prazo</Table.Column>
                <Table.Column>Conclusão</Table.Column>
                <Table.Column>Situação</Table.Column>
                <Table.Column className="text-end">Ações</Table.Column>
              </Table.Header>
              <Table.Body>
                {etapas.map((e) => {
                  const situacao = situacaoEtapa(e, dados.etapas, dataHoje);
                  const prazo = prazoEfetivo(e);
                  return (
                    <Table.Row key={e.id} id={e.id}>
                      <Table.Cell className="text-muted">{e.ordem}</Table.Cell>
                      <Table.Cell>
                        <span className="block font-medium">{e.titulo}</span>
                        <span className="text-xs text-muted">
                          {e.id}
                          {e.predecessoras.length > 0 && ` · depois de ${e.predecessoras.join(", ")}`}
                        </span>
                      </Table.Cell>
                      <Table.Cell>{nomePessoa(dados.pessoas, e.responsavelId)}</Table.Cell>
                      <Table.Cell>
                        <ChipStatus status={e.status} />
                      </Table.Cell>
                      <Table.Cell>
                        <DataTexto data={e.dataInicio} />
                      </Table.Cell>
                      <Table.Cell className="whitespace-nowrap">
                        {e.slaDiasUteis == null ? "—" : `${e.slaDiasUteis} d.u.`}
                      </Table.Cell>
                      <Table.Cell>
                        <span className="flex flex-col">
                          <DataTexto data={prazo} destaque={situacao.tipo === "atrasada" ? "danger" : undefined} />
                          {e.prazo && prazoSla(e) && e.prazo !== prazoSla(e) && (
                            <span className="text-xs text-muted">manual</span>
                          )}
                        </span>
                      </Table.Cell>
                      <Table.Cell>
                        <DataTexto data={e.dataConclusao} />
                      </Table.Cell>
                      <Table.Cell>
                        <ChipSituacao situacao={situacao} />
                      </Table.Cell>
                      <Table.Cell>
                        <div className="flex justify-end gap-1">
                          {e.status !== "Concluída" && e.status !== "Em andamento" && (
                            <Tooltip delay={300}>
                              <Button isIconOnly aria-label="Iniciar" size="sm" variant="ghost" onPress={() => mudarStatus(e, "Em andamento")}>
                                <Play />
                              </Button>
                              <Tooltip.Content>Iniciar</Tooltip.Content>
                            </Tooltip>
                          )}
                          {e.status !== "Concluída" && (
                            <Tooltip delay={300}>
                              <Button isIconOnly aria-label="Concluir" size="sm" variant="ghost" onPress={() => mudarStatus(e, "Concluída")}>
                                <CircleCheck />
                              </Button>
                              <Tooltip.Content>Concluir hoje</Tooltip.Content>
                            </Tooltip>
                          )}
                          <Button isIconOnly aria-label="Editar etapa" size="sm" variant="ghost" onPress={() => setEtapaForm(e)}>
                            <Pencil />
                          </Button>
                          <Button isIconOnly aria-label="Excluir etapa" size="sm" variant="ghost" onPress={() => setEtapaExcluir(e)}>
                            <TrashBin />
                          </Button>
                        </div>
                      </Table.Cell>
                    </Table.Row>
                  );
                })}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      )}

      {editando && <FormAtividade atividade={atividade} onFechar={() => setEditando(false)} />}
      {etapaForm && (
        <FormEtapa
          atividadeId={atividade.id}
          etapa={etapaForm === "nova" ? null : etapaForm}
          onFechar={() => setEtapaForm(null)}
        />
      )}
      <ConfirmarExclusao
        aberta={excluindo}
        mensagem={`A atividade "${atividade.titulo}" e suas ${etapas.length} etapa(s) serão excluídas.`}
        titulo="Excluir atividade?"
        onConfirmar={() => {
          alterar((d) => excluirAtividade(d, atividade.id));
          toast.success("Atividade excluída");
          onVoltar();
        }}
        onFechar={() => setExcluindo(false)}
      />
      <ConfirmarExclusao
        aberta={!!etapaExcluir}
        mensagem={`A etapa "${etapaExcluir?.titulo}" será excluída e removida das predecessoras das outras etapas.`}
        titulo="Excluir etapa?"
        onConfirmar={() => {
          if (etapaExcluir) alterar((d) => excluirEtapa(d, etapaExcluir.id));
          toast.success("Etapa excluída");
        }}
        onFechar={() => setEtapaExcluir(null)}
      />
    </div>
  );
}

function Info({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted">{rotulo}</span>
      <div className="text-sm">{children}</div>
    </div>
  );
}
