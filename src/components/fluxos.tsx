"use client";

import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  CopyPlus,
  ArrowRightFromSquare,
  Gear,
  Pencil,
  Play,
  Plus,
  TrashBin,
} from "@gravity-ui/icons";
import { Button, Card, ProgressBar, Table, Tooltip, toast } from "@heroui/react";
import { memo, useCallback, useMemo, useState } from "react";
import { hoje } from "@/lib/datas";
import { atividadesDoFluxo, datasDoFluxo, dependentesDoItem, itensDoModelo, progressoFluxo } from "@/lib/fluxo";
import {
  excluirFluxo,
  excluirModelo,
  excluirModeloItem,
  iniciarFluxo,
  moverModeloItem,
  salvarModeloItem,
  type AtividadePlanejada,
} from "@/lib/operacoes";
import { useDados } from "@/lib/store";
import {
  PRIORIDADES,
  type Fluxo,
  type FluxoModelo,
  type ModeloItem,
  type Pessoa,
  type Prioridade,
} from "@/lib/tipos";
import {
  BotaoCampo,
  CampoCheck,
  CampoMultiplo,
  CampoSelecao,
  CampoSelecaoLinha,
  CampoTexto,
  CampoTextoLinha,
  ChipStatus,
  ConfirmarExclusao,
  DataTexto,
  nomePessoa,
  opcoesDe,
  opcoesPessoas,
  Vazio,
} from "./comum";
import { FormModelo, FormModeloItem, FormModeloLote } from "./formularios";

type Vista =
  | { tipo: "lista" }
  | { tipo: "configurar"; modeloId: string }
  | { tipo: "iniciar"; modeloId: string }
  | { tipo: "fluxo"; fluxoId: string };

export function Fluxos({ onAbrirAtividade }: { onAbrirAtividade: (id: string) => void }) {
  const { dados } = useDados();
  const [vista, setVista] = useState<Vista>({ tipo: "lista" });

  const modelo = vista.tipo === "configurar" || vista.tipo === "iniciar"
    ? dados.modelos.find((m) => m.id === vista.modeloId)
    : undefined;
  const fluxo = vista.tipo === "fluxo" ? dados.fluxos.find((f) => f.id === vista.fluxoId) : undefined;

  if (modelo && vista.tipo === "configurar") {
    return <ConfigurarFluxo modelo={modelo} onVoltar={() => setVista({ tipo: "lista" })} />;
  }
  if (modelo && vista.tipo === "iniciar") {
    return (
      <IniciarFluxo
        modelo={modelo}
        onIniciado={(fluxoId) => setVista({ tipo: "fluxo", fluxoId })}
        onVoltar={() => setVista({ tipo: "lista" })}
      />
    );
  }
  if (fluxo) {
    return (
      <DetalheFluxo
        fluxo={fluxo}
        onAbrirAtividade={onAbrirAtividade}
        onVoltar={() => setVista({ tipo: "lista" })}
      />
    );
  }
  return <ListaFluxos onIr={setVista} />;
}

// ---------- Lista ----------

function ListaFluxos({ onIr }: { onIr: (v: Vista) => void }) {
  const { dados, alterar } = useDados();
  const [criandoModelo, setCriandoModelo] = useState(false);
  const [editando, setEditando] = useState<FluxoModelo | null>(null);
  const [excluindoModelo, setExcluindoModelo] = useState<FluxoModelo | null>(null);
  const [excluindoFluxo, setExcluindoFluxo] = useState<Fluxo | null>(null);

  const fluxosOrdenados = [...dados.fluxos].sort((a, b) => b.dataInicio.localeCompare(a.dataInicio));

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Fluxos padrão</h2>
            <p className="text-sm text-muted">
              A receita de um fluxo: as atividades na ordem, com responsável sugerido e SLA.
            </p>
          </div>
          <Button variant="secondary" onPress={() => setCriandoModelo(true)}>
            <Gear />
            Configurar fluxo de trabalho
          </Button>
        </div>

        {dados.modelos.length === 0 ? (
          <Vazio
            acao={
              <Button onPress={() => setCriandoModelo(true)}>
                <Plus />
                Configurar primeiro fluxo
              </Button>
            }
            icone={<Gear />}
            texto="Monte um fluxo padrão uma vez — como o de desenvolvimento de produto — e depois inicie quantas vezes precisar."
            titulo="Nenhum fluxo padrão ainda"
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {dados.modelos.map((m) => {
              const itens = itensDoModelo(m.id, dados.modeloItens);
              const iniciados = dados.fluxos.filter((f) => f.modeloId === m.id).length;
              return (
                <Card key={m.id}>
                  <Card.Header>
                    <Card.Title>{m.nome}</Card.Title>
                    <Card.Description>
                      {m.descricao || `${itens.length} atividade(s)`}
                      {iniciados > 0 && ` · ${iniciados} fluxo(s) iniciado(s)`}
                    </Card.Description>
                  </Card.Header>
                  <Card.Content className="flex flex-wrap gap-2">
                    <Button
                      isDisabled={itens.length === 0}
                      size="sm"
                      onPress={() => onIr({ tipo: "iniciar", modeloId: m.id })}
                    >
                      <Play />
                      Iniciar fluxo
                    </Button>
                    <Button size="sm" variant="secondary" onPress={() => onIr({ tipo: "configurar", modeloId: m.id })}>
                      <Gear />
                      {itens.length === 0 ? "Adicionar atividades" : "Configurar"}
                    </Button>
                    <Button
                      isIconOnly
                      aria-label="Renomear fluxo padrão"
                      size="sm"
                      variant="ghost"
                      onPress={() => setEditando(m)}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      isIconOnly
                      aria-label="Excluir fluxo padrão"
                      size="sm"
                      variant="ghost"
                      onPress={() => setExcluindoModelo(m)}
                    >
                      <TrashBin />
                    </Button>
                  </Card.Content>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold">Fluxos iniciados</h2>
          <p className="text-sm text-muted">Cada fluxo iniciado gerou as atividades que aparecem na lista e no Kanban.</p>
        </div>

        {fluxosOrdenados.length === 0 ? (
          <Vazio
            icone={<Play />}
            texto="Escolha um fluxo padrão acima e clique em “Iniciar fluxo” para gerar as atividades com datas."
            titulo="Nenhum fluxo iniciado"
          />
        ) : (
          <Table>
            <Table.ScrollContainer>
              <Table.Content aria-label="Fluxos iniciados" className="min-w-[720px]">
                <Table.Header>
                  <Table.Column isRowHeader>Fluxo</Table.Column>
                  <Table.Column>Início</Table.Column>
                  <Table.Column>Atividades</Table.Column>
                  <Table.Column>Progresso</Table.Column>
                  <Table.Column className="text-end">Ações</Table.Column>
                </Table.Header>
                <Table.Body>
                  {fluxosOrdenados.map((f) => {
                    const atividades = atividadesDoFluxo(f.id, dados.atividades);
                    const concluidas = atividades.filter((a) => a.status === "Concluída").length;
                    return (
                      <Table.Row key={f.id} id={f.id}>
                        <Table.Cell>
                          <button
                            className="text-left hover:underline"
                            type="button"
                            onClick={() => onIr({ tipo: "fluxo", fluxoId: f.id })}
                          >
                            <span className="block font-medium">{f.nome}</span>
                            <span className="text-xs text-muted">
                              {f.id}
                              {f.modeloId && ` · ${dados.modelos.find((m) => m.id === f.modeloId)?.nome ?? ""}`}
                            </span>
                          </button>
                        </Table.Cell>
                        <Table.Cell>
                          <DataTexto data={f.dataInicio} />
                        </Table.Cell>
                        <Table.Cell className="whitespace-nowrap">
                          {concluidas}/{atividades.length}
                        </Table.Cell>
                        <Table.Cell>
                          <div className="min-w-32">
                            <ProgressBar aria-label="Progresso" size="sm" value={progressoFluxo(f.id, dados.atividades)}>
                              <ProgressBar.Track>
                                <ProgressBar.Fill />
                              </ProgressBar.Track>
                            </ProgressBar>
                          </div>
                        </Table.Cell>
                        <Table.Cell className="text-end">
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="secondary" onPress={() => onIr({ tipo: "fluxo", fluxoId: f.id })}>
                              Abrir
                            </Button>
                            <Button
                              isIconOnly
                              aria-label="Excluir fluxo"
                              size="sm"
                              variant="ghost"
                              onPress={() => setExcluindoFluxo(f)}
                            >
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
      </section>

      {criandoModelo && (
        <FormModelo
          modelo={null}
          onCriado={(id) => onIr({ tipo: "configurar", modeloId: id })}
          onFechar={() => setCriandoModelo(false)}
        />
      )}
      {editando && <FormModelo modelo={editando} onFechar={() => setEditando(null)} />}
      <ConfirmarExclusao
        aberta={!!excluindoModelo}
        mensagem={`O fluxo padrão "${excluindoModelo?.nome}" e suas atividades previstas serão excluídos. Os fluxos já iniciados continuam como estão.`}
        titulo="Excluir fluxo padrão?"
        onConfirmar={() => {
          if (excluindoModelo) alterar((d) => excluirModelo(d, excluindoModelo.id));
          toast.success("Fluxo padrão excluído");
        }}
        onFechar={() => setExcluindoModelo(null)}
      />
      <ConfirmarExclusao
        aberta={!!excluindoFluxo}
        mensagem={
          <>
            As {excluindoFluxo ? atividadesDoFluxo(excluindoFluxo.id, dados.atividades).length : 0} atividade(s) deste
            fluxo <strong>não serão excluídas</strong>: elas passam a valer como atividades de rotina.
          </>
        }
        titulo={`Excluir o fluxo "${excluindoFluxo?.nome}"?`}
        onConfirmar={() => {
          if (excluindoFluxo) alterar((d) => excluirFluxo(d, excluindoFluxo.id, false));
          toast.success("Fluxo excluído");
        }}
        onFechar={() => setExcluindoFluxo(null)}
      />
    </div>
  );
}

// ---------- Configurar (modelo) ----------

function ConfigurarFluxo({ modelo, onVoltar }: { modelo: FluxoModelo; onVoltar: () => void }) {
  const { dados, alterar } = useDados();
  const [form, setForm] = useState<ModeloItem | "novo" | null>(null);
  const [colando, setColando] = useState(false);
  const [excluindo, setExcluindo] = useState<ModeloItem | null>(null);
  const itens = useMemo(() => itensDoModelo(modelo.id, dados.modeloItens), [modelo.id, dados.modeloItens]);
  // Cada campo grava direto: a edição acontece na própria linha, sem modal.
  const salvar = useCallback((item: ModeloItem) => alterar((d) => salvarModeloItem(d, item)), [alterar]);
  const mover = useCallback((id: string, direcao: -1 | 1) => alterar((d) => moverModeloItem(d, id, direcao)), [alterar]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button size="sm" variant="ghost" onPress={onVoltar}>
          <ArrowLeft />
          Fluxos
        </Button>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{modelo.nome}</h2>
          <p className="text-sm text-muted">
            {modelo.descricao || "As atividades abaixo viram atividades de verdade quando o fluxo é iniciado."}
          </p>
          <p className="text-xs text-muted">Edite direto na linha: o campo salva ao sair dele ou no Enter.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onPress={() => setColando(true)}>
            <CopyPlus />
            Colar lista
          </Button>
          <Button onPress={() => setForm("novo")}>
            <Plus />
            Adicionar atividade
          </Button>
        </div>
      </div>

      {itens.length === 0 ? (
        <Vazio
          acao={
            <div className="flex flex-wrap justify-center gap-2">
              <Button onPress={() => setForm("novo")}>
                <Plus />
                Adicionar primeira atividade
              </Button>
              <Button variant="secondary" onPress={() => setColando(true)}>
                <CopyPlus />
                Colar lista pronta
              </Button>
            </div>
          }
          icone={<Gear />}
          texto="Liste as atividades na ordem em que acontecem, com o SLA em dias úteis e de quem elas dependem."
          titulo="Fluxo padrão vazio"
        />
      ) : (
        // Grid em vez de tabela: são 35 linhas de campos editáveis, e o componente
        // de tabela refaz a coleção inteira a cada tecla confirmada.
        <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
          <div className="min-w-[1180px]">
            <div className={`${COLUNAS_MODELO} border-b border-border px-3 py-2 text-xs font-medium text-muted`}>
              <span>#</span>
              <span>Atividade</span>
              <span>Responsável padrão</span>
              <span>Prioridade</span>
              <span>SLA (d.u.)</span>
              <span>Depende de</span>
              <span className="text-end">Ações</span>
            </div>
            {itens.map((item, indice) => (
              <LinhaModelo
                key={item.id}
                indice={indice}
                item={item}
                itens={itens}
                pessoas={dados.pessoas}
                todosItens={dados.modeloItens}
                onExcluir={setExcluindo}
                onMover={mover}
                onSalvar={salvar}
              />
            ))}
          </div>
        </div>
      )}

      {form && (
        <FormModeloItem item={form === "novo" ? null : form} modeloId={modelo.id} onFechar={() => setForm(null)} />
      )}
      {colando && <FormModeloLote modeloId={modelo.id} onFechar={() => setColando(false)} />}
      <ConfirmarExclusao
        aberta={!!excluindo}
        mensagem={`"${excluindo?.titulo}" sai do fluxo padrão e das dependências das outras atividades. Fluxos já iniciados não mudam.`}
        titulo="Excluir atividade do fluxo?"
        onConfirmar={() => {
          if (excluindo) alterar((d) => excluirModeloItem(d, excluindo.id));
          toast.success("Atividade removida do fluxo");
        }}
        onFechar={() => setExcluindo(null)}
      />
    </div>
  );
}

const COLUNAS_MODELO =
  "grid grid-cols-[2.5rem_minmax(0,1.7fr)_minmax(0,1.1fr)_8.5rem_6rem_minmax(0,1.2fr)_6.5rem] items-center gap-3";

/**
 * Uma atividade do fluxo padrão, editável na própria linha. Memorizada para que
 * salvar um campo não redesenhe as outras linhas — um fluxo tem dezenas delas.
 */
const LinhaModelo = memo(function LinhaModelo({
  item,
  indice,
  itens,
  todosItens,
  pessoas,
  onSalvar,
  onMover,
  onExcluir,
}: {
  item: ModeloItem;
  indice: number;
  itens: ModeloItem[];
  todosItens: ModeloItem[];
  pessoas: Pessoa[];
  onSalvar: (item: ModeloItem) => void;
  onMover: (id: string, direcao: -1 | 1) => void;
  onExcluir: (item: ModeloItem) => void;
}) {
  const [editandoDependencia, setEditandoDependencia] = useState(false);

  // Não pode depender de si mesma nem de quem já depende dela (evita ciclos).
  const bloqueadas = dependentesDoItem(item.id, todosItens);
  const opcoesPredecessoras = itens
    .filter((i) => i.id !== item.id && !bloqueadas.has(i.id))
    .map((i) => ({ id: i.id, rotulo: i.titulo }));
  const predecessorasValidas = item.predecessoras.filter((id) => opcoesPredecessoras.some((o) => o.id === id));

  return (
    <div className={`${COLUNAS_MODELO} border-b border-border px-3 py-2 last:border-b-0`}>
      <span className="text-sm text-muted tabular-nums">{indice + 1}</span>
      <CampoTextoLinha
        exigeValor
        label={`Nome da atividade ${indice + 1}`}
        valor={item.titulo}
        onConfirmar={(v) => onSalvar({ ...item, titulo: v })}
      />
      <CampoSelecaoLinha
        label={`Responsável padrão de ${item.titulo}`}
        opcoes={opcoesPessoas(pessoas)}
        permitirVazio="Sem responsável"
        valor={item.responsavelId}
        onChange={(v) => onSalvar({ ...item, responsavelId: v })}
      />
      <CampoSelecaoLinha
        label={`Prioridade de ${item.titulo}`}
        opcoes={opcoesDe(PRIORIDADES)}
        valor={item.prioridade}
        onChange={(v) => v && onSalvar({ ...item, prioridade: v as Prioridade })}
      />
      <CampoTextoLinha
        label={`SLA em dias úteis de ${item.titulo}`}
        placeholder="1"
        tipo="number"
        valor={item.slaDiasUteis == null ? "" : String(item.slaDiasUteis)}
        onConfirmar={(v) =>
          onSalvar({ ...item, slaDiasUteis: v === "" ? null : Math.max(0, Math.floor(Number(v) || 0)) })
        }
      />
      {/* O campo rico só é montado na linha em que se clica: dezenas deles na
          mesma tela deixam a digitação lenta. */}
      {editandoDependencia ? (
        <CampoMultiplo
          autoAbrir
          labelOculto
          label={`Depende de, para ${item.titulo}`}
          opcoes={opcoesPredecessoras}
          placeholder="Início do fluxo"
          valores={item.predecessoras.filter((id) => opcoesPredecessoras.some((o) => o.id === id))}
          onChange={(v) => onSalvar({ ...item, predecessoras: v })}
        />
      ) : (
        <BotaoCampo
          desabilitado={opcoesPredecessoras.length === 0}
          rotulo={
            predecessorasValidas.length === 0
              ? "Início do fluxo"
              : predecessorasValidas.map((id) => itens.find((i) => i.id === id)?.titulo ?? id).join(", ")
          }
          titulo={
            opcoesPredecessoras.length === 0
              ? "Não há de quem depender: as outras atividades do fluxo já dependem desta."
              : undefined
          }
          vazio={predecessorasValidas.length === 0}
          onPress={() => setEditandoDependencia(true)}
        />
      )}
      <div className="flex justify-end gap-1">
        <Button
          isIconOnly
          aria-label={`Mover ${item.titulo} para cima`}
          isDisabled={indice === 0}
          size="sm"
          variant="ghost"
          onPress={() => onMover(item.id, -1)}
        >
          <ArrowUp />
        </Button>
        <Button
          isIconOnly
          aria-label={`Mover ${item.titulo} para baixo`}
          isDisabled={indice === itens.length - 1}
          size="sm"
          variant="ghost"
          onPress={() => onMover(item.id, 1)}
        >
          <ArrowDown />
        </Button>
        <Button
          isIconOnly
          aria-label={`Excluir ${item.titulo}`}
          size="sm"
          variant="ghost"
          onPress={() => onExcluir(item)}
        >
          <TrashBin />
        </Button>
      </div>
    </div>
  );
});

// ---------- Iniciar ----------

interface LinhaPlano {
  incluir: boolean;
  responsavelId: string | null;
  prioridade: Prioridade;
  slaDiasUteis: number | null;
  dataInicio: string | null;
  prazo: string | null;
  /** Datas editadas à mão não são sobrescritas pelo recálculo. */
  manual: boolean;
}

function IniciarFluxo({
  modelo,
  onVoltar,
  onIniciado,
}: {
  modelo: FluxoModelo;
  onVoltar: () => void;
  onIniciado: (fluxoId: string) => void;
}) {
  const { dados, alterar } = useDados();
  const itens = useMemo(() => itensDoModelo(modelo.id, dados.modeloItens), [modelo.id, dados.modeloItens]);
  const [nome, setNome] = useState(modelo.nome);
  const [dataInicio, setDataInicio] = useState(hoje());
  const [linhas, setLinhas] = useState<Record<string, LinhaPlano>>(() =>
    Object.fromEntries(
      itens.map((i) => [
        i.id,
        {
          incluir: true,
          responsavelId: i.responsavelId,
          prioridade: i.prioridade,
          slaDiasUteis: i.slaDiasUteis,
          dataInicio: null,
          prazo: null,
          manual: false,
        } satisfies LinhaPlano,
      ]),
    ),
  );

  const linha = (id: string): LinhaPlano =>
    linhas[id] ?? { incluir: true, responsavelId: null, prioridade: "Média", slaDiasUteis: null, dataInicio: null, prazo: null, manual: false };
  const mudar = (id: string, parcial: Partial<LinhaPlano>) =>
    setLinhas((atual) => ({ ...atual, [id]: { ...linha(id), ...parcial } }));
  const marcarTodas = (incluir: boolean) =>
    setLinhas((atual) => Object.fromEntries(itens.map((i) => [i.id, { ...(atual[i.id] ?? linha(i.id)), incluir }])));

  // Datas sugeridas: recalculadas a cada mudança de SLA, seleção ou data de início.
  const sugeridas = useMemo(() => {
    const selecionados = new Set(itens.filter((i) => linhas[i.id]?.incluir).map((i) => i.id));
    const comSla = itens.map((i) => ({ ...i, slaDiasUteis: linhas[i.id]?.slaDiasUteis ?? i.slaDiasUteis }));
    return datasDoFluxo(comSla, dataInicio, selecionados);
  }, [itens, linhas, dataInicio]);

  const incluidos = itens.filter((i) => linha(i.id).incluir);
  const podeIniciar = nome.trim() !== "" && incluidos.length > 0;

  function datasDaLinha(id: string): { dataInicio: string | null; prazo: string | null } {
    const atual = linha(id);
    if (atual.manual) return { dataInicio: atual.dataInicio, prazo: atual.prazo };
    const sugerida = sugeridas.get(id);
    return { dataInicio: sugerida?.dataInicio ?? null, prazo: sugerida?.prazo ?? null };
  }

  function iniciar() {
    const planejadas: AtividadePlanejada[] = incluidos.map((item) => {
      const atual = linha(item.id);
      const datas = datasDaLinha(item.id);
      return {
        itemId: item.id,
        titulo: item.titulo,
        responsavelId: atual.responsavelId,
        prioridade: atual.prioridade,
        slaDiasUteis: atual.slaDiasUteis,
        dataInicio: datas.dataInicio,
        prazo: datas.prazo,
      };
    });
    let novoId = "";
    alterar((d) => {
      const r = iniciarFluxo(d, { nome, modeloId: modelo.id, dataInicio }, planejadas);
      novoId = r.fluxoId;
      return r.dados;
    });
    toast.success(`Fluxo iniciado com ${planejadas.length} atividade(s)`);
    onIniciado(novoId);
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button size="sm" variant="ghost" onPress={onVoltar}>
          <ArrowLeft />
          Fluxos
        </Button>
      </div>

      <Card>
        <Card.Header>
          <Card.Title>Iniciar fluxo de trabalho</Card.Title>
          <Card.Description>
            A partir de <strong>{modelo.nome}</strong>. Desmarque o que não se aplica; as datas são sugestões e podem
            ser editadas.
          </Card.Description>
        </Card.Header>
        <Card.Content className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <CampoTexto
            obrigatorio
            label="Nome do fluxo"
            placeholder="Ex.: Produto Unimed 2026"
            valor={nome}
            onChange={setNome}
          />
          <CampoTexto
            descricao="A primeira atividade começa nesta data."
            label="Início do fluxo"
            tipo="date"
            valor={dataInicio}
            onChange={(v) => v && setDataInicio(v)}
          />
        </Card.Content>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {incluidos.length} de {itens.length} atividade(s) neste fluxo.
        </p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            onPress={() => marcarTodas(true)}
          >
            Marcar todas
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onPress={() => marcarTodas(false)}
          >
            Desmarcar todas
          </Button>
        </div>
      </div>

      <Table>
        <Table.ScrollContainer>
          <Table.Content aria-label="Atividades do fluxo" className="min-w-[1000px]">
            <Table.Header>
              <Table.Column className="w-12">Entra</Table.Column>
              <Table.Column isRowHeader>Atividade</Table.Column>
              <Table.Column>Responsável</Table.Column>
              <Table.Column className="w-24">SLA</Table.Column>
              <Table.Column className="w-44">Início</Table.Column>
              <Table.Column className="w-44">Prazo</Table.Column>
            </Table.Header>
            <Table.Body>
              {itens.map((item, indice) => {
                const atual = linha(item.id);
                const datas = datasDaLinha(item.id);
                return (
                  <Table.Row key={item.id} className={atual.incluir ? undefined : "opacity-50"} id={item.id}>
                    <Table.Cell>
                      <CampoCheck
                        aria={`Incluir ${item.titulo}`}
                        marcado={atual.incluir}
                        onChange={(v) => mudar(item.id, { incluir: v })}
                      />
                    </Table.Cell>
                    <Table.Cell>
                      <span className="block font-medium">
                        {indice + 1}. {item.titulo}
                      </span>
                      {item.predecessoras.length > 0 && (
                        <span className="text-xs text-muted">
                          depois de {item.predecessoras.map((id) => itens.find((i) => i.id === id)?.titulo ?? id).join(", ")}
                        </span>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      <CampoSelecao
                        labelOculto
                        label={`Responsável por ${item.titulo}`}
                        opcoes={opcoesPessoas(dados.pessoas)}
                        permitirVazio="Sem responsável"
                        valor={atual.responsavelId}
                        onChange={(v) => mudar(item.id, { responsavelId: v })}
                      />
                    </Table.Cell>
                    <Table.Cell>
                      <CampoTexto
                        labelOculto
                        label={`SLA de ${item.titulo}`}
                        tipo="number"
                        valor={atual.slaDiasUteis == null ? "" : String(atual.slaDiasUteis)}
                        onChange={(v) =>
                          mudar(item.id, {
                            slaDiasUteis: v === "" ? null : Math.max(0, Math.floor(Number(v) || 0)),
                          })
                        }
                      />
                    </Table.Cell>
                    <Table.Cell>
                      <CampoTexto
                        labelOculto
                        label={`Início de ${item.titulo}`}
                        tipo="date"
                        valor={datas.dataInicio ?? ""}
                        onChange={(v) => mudar(item.id, { dataInicio: v || null, prazo: datas.prazo, manual: true })}
                      />
                    </Table.Cell>
                    <Table.Cell>
                      <CampoTexto
                        labelOculto
                        label={`Prazo de ${item.titulo}`}
                        tipo="date"
                        valor={datas.prazo ?? ""}
                        onChange={(v) => mudar(item.id, { prazo: v || null, dataInicio: datas.dataInicio, manual: true })}
                      />
                    </Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" onPress={onVoltar}>
          Cancelar
        </Button>
        <Button isDisabled={!podeIniciar} onPress={iniciar}>
          <Play />
          Iniciar fluxo com {incluidos.length} atividade(s)
        </Button>
      </div>
    </div>
  );
}

// ---------- Fluxo iniciado ----------

function DetalheFluxo({
  fluxo,
  onVoltar,
  onAbrirAtividade,
}: {
  fluxo: Fluxo;
  onVoltar: () => void;
  onAbrirAtividade: (id: string) => void;
}) {
  const { dados } = useDados();
  const atividades = atividadesDoFluxo(fluxo.id, dados.atividades);
  const titulos = new Map(atividades.map((a) => [a.id, a.titulo]));
  const concluidas = atividades.filter((a) => a.status === "Concluída").length;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button size="sm" variant="ghost" onPress={onVoltar}>
          <ArrowLeft />
          Fluxos
        </Button>
      </div>

      <Card>
        <Card.Header>
          <span className="text-xs text-muted">{fluxo.id}</span>
          <Card.Title className="text-2xl">{fluxo.nome}</Card.Title>
          <Card.Description>
            Início em {fluxo.dataInicio.split("-").reverse().join("/")} · {concluidas} de {atividades.length}{" "}
            concluída(s)
          </Card.Description>
        </Card.Header>
        <Card.Content>
          <ProgressBar aria-label="Progresso do fluxo" value={progressoFluxo(fluxo.id, dados.atividades)}>
            <ProgressBar.Output />
            <ProgressBar.Track>
              <ProgressBar.Fill />
            </ProgressBar.Track>
          </ProgressBar>
        </Card.Content>
      </Card>

      <Table>
        <Table.ScrollContainer>
          <Table.Content aria-label="Atividades do fluxo" className="min-w-[900px]">
            <Table.Header>
              <Table.Column className="w-12">#</Table.Column>
              <Table.Column isRowHeader>Atividade</Table.Column>
              <Table.Column>Responsável</Table.Column>
              <Table.Column>Status</Table.Column>
              <Table.Column>Início</Table.Column>
              <Table.Column>Prazo</Table.Column>
              <Table.Column className="text-end">Ações</Table.Column>
            </Table.Header>
            <Table.Body>
              {atividades.map((a, indice) => (
                <Table.Row key={a.id} id={a.id}>
                  <Table.Cell className="text-muted tabular-nums">{indice + 1}</Table.Cell>
                  <Table.Cell>
                    <button className="text-left hover:underline" type="button" onClick={() => onAbrirAtividade(a.id)}>
                      <span className="block font-medium">{a.titulo}</span>
                      <span className="text-xs text-muted">
                        {a.id}
                        {a.predecessoras.length > 0 &&
                          ` · depois de ${a.predecessoras.map((id) => titulos.get(id) ?? id).join(", ")}`}
                      </span>
                    </button>
                  </Table.Cell>
                  <Table.Cell>{nomePessoa(dados.pessoas, a.responsavelId)}</Table.Cell>
                  <Table.Cell>
                    <ChipStatus status={a.status} />
                  </Table.Cell>
                  <Table.Cell>
                    <DataTexto data={a.dataInicio} />
                  </Table.Cell>
                  <Table.Cell>
                    <DataTexto
                      data={a.prazo}
                      destaque={a.status !== "Concluída" && !!a.prazo && a.prazo < hoje() ? "danger" : undefined}
                    />
                  </Table.Cell>
                  <Table.Cell className="text-end">
                    <Tooltip delay={300}>
                      <Button
                        isIconOnly
                        aria-label="Abrir atividade"
                        size="sm"
                        variant="ghost"
                        onPress={() => onAbrirAtividade(a.id)}
                      >
                        <ArrowRightFromSquare />
                      </Button>
                      <Tooltip.Content>Abrir atividade</Tooltip.Content>
                    </Tooltip>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>
    </div>
  );
}
