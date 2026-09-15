"use client";

import { Card, Table } from "@heroui/react";
import { useState, type ReactNode } from "react";
import { diasUteisEntre, hoje } from "@/lib/datas";
import { itensDeTrabalho, type ItemTrabalho } from "@/lib/fluxo";
import { dentroDoIntervalo, intervaloDoPeriodo, PERIODOS, type Periodo } from "@/lib/periodos";
import { useDados } from "@/lib/store";
import { CampoSelecao, ChipSituacao, DataTexto, nomePessoa, opcoesDe, Vazio } from "./comum";
import { ChartColumn } from "@gravity-ui/icons";

const JANELA_PROXIMOS_DIAS = 5;

// No painel só fazem sentido os períodos que olham para trás: o futuro entra sempre.
const PERIODOS_PAINEL: Periodo[] = ["Últimos 3 meses", "Últimos 12 meses", "Este mês", "Todo o período"];

export function Painel({ onAbrirAtividade }: { onAbrirAtividade: (id: string) => void }) {
  const { dados } = useDados();
  const [periodo, setPeriodo] = useState<Periodo>("Últimos 3 meses");
  const dataHoje = hoje();

  // O painel olha para o presente: o período só corta o passado ("de 3 meses
  // para cá"), senão o que vence à frente — o que mais importa aqui — sumiria.
  const intervalo = { de: intervaloDoPeriodo(periodo, { de: null, ate: null }, dataHoje).de, ate: null };
  // A data que situa o item no tempo é o prazo, ou a conclusão quando não há prazo.
  const noPeriodo = (i: { prazo: string | null; dataConclusao: string | null }) =>
    dentroDoIntervalo(i.prazo ?? i.dataConclusao, intervalo);

  const itens = itensDeTrabalho(dados.atividades, dados.etapas, dataHoje).filter(noPeriodo);
  const abertos = itens.filter((i) => i.status !== "Concluída");
  const atrasados = abertos.filter((i) => i.situacao.tipo === "atrasada");
  const vencendo = abertos.filter(
    (i) =>
      i.situacao.tipo === "vence-hoje" ||
      (i.situacao.tipo === "no-prazo" && !!i.prazo && diasUteisEntre(dataHoje, i.prazo) <= JANELA_PROXIMOS_DIAS),
  );
  const concluidos = itens.filter((i) => i.status === "Concluída");

  // Cumpriu o prazo quem concluiu até a data combinada. Sem prazo ou sem data de
  // conclusão não dá para dizer, então esses ficam de fora da conta.
  const avaliaveis = concluidos.filter((i) => i.prazo && i.dataConclusao);
  const noPrazo = avaliaveis.filter((i) => i.dataConclusao! <= i.prazo!);
  const percentualPrazo = avaliaveis.length > 0 ? Math.round((noPrazo.length / avaliaveis.length) * 100) : null;

  const atividadesNoPeriodo = dados.atividades.filter(noPeriodo);
  const atividadesAbertas = atividadesNoPeriodo.filter((a) => a.status !== "Concluída").length;
  const fluxosEmAndamento = dados.fluxos.filter((f) =>
    dados.atividades.some((a) => a.fluxoId === f.id && a.status !== "Concluída"),
  ).length;

  const carga = dados.pessoas
    .map((p) => ({
      pessoa: p,
      abertos: abertos.filter((i) => i.responsavelId === p.id).length,
      atrasados: atrasados.filter((i) => i.responsavelId === p.id).length,
      concluidos: concluidos.filter((i) => i.responsavelId === p.id).length,
    }))
    .sort((a, b) => b.abertos - a.abertos || b.concluidos - a.concluidos || a.pessoa.nome.localeCompare(b.pessoa.nome));
  const semResponsavel = abertos.filter((i) => !i.responsavelId).length;
  const maiorCarga = Math.max(1, ...carga.map((c) => c.abertos));

  const atencao = [...atrasados, ...vencendo].sort((a, b) => (a.prazo ?? "").localeCompare(b.prazo ?? ""));

  if (dados.atividades.length === 0) {
    return (
      <Vazio
        icone={<ChartColumn />}
        texto="Os indicadores aparecem aqui assim que você cadastrar atividades."
        titulo="Ainda não há dados"
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted">
          Conta o que venceu ou foi concluído dentro do período, mais tudo que ainda está por vir. Cada atividade conta
          uma vez — pelas suas etapas, quando ela tem etapas.
        </p>
        <div className="w-full sm:w-52">
          <CampoSelecao
            label="Período"
            opcoes={opcoesDe(PERIODOS.filter((p) => PERIODOS_PAINEL.includes(p)))}
            valor={periodo}
            onChange={(v) => v && setPeriodo(v as Periodo)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        <Indicador rotulo="Atividades em aberto" valor={atividadesAbertas} />
        <Indicador detalhe="Com atividades em aberto" rotulo="Fluxos em andamento" valor={fluxosEmAndamento} />
        <Indicador detalhe="Atividades e etapas" rotulo="Em aberto" valor={abertos.length} />
        <Indicador destaque={atrasados.length > 0 ? "danger" : undefined} rotulo="Atrasados" valor={atrasados.length} />
        <Indicador
          destaque={vencendo.length > 0 ? "warning" : undefined}
          detalhe={`Até ${JANELA_PROXIMOS_DIAS} dias úteis`}
          rotulo="Vencendo em breve"
          valor={vencendo.length}
        />
        <Indicador
          detalhe={
            avaliaveis.length > 0
              ? `${noPrazo.length} de ${avaliaveis.length} com prazo e conclusão`
              : `${concluidos.length} concluído(s) no período`
          }
          rotulo="Concluídos no prazo"
          valor={percentualPrazo == null ? "—" : `${percentualPrazo}%`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <Card>
          <Card.Header>
            <Card.Title>Precisa de atenção</Card.Title>
            <Card.Description>
              Atrasados ou vencendo nos próximos {JANELA_PROXIMOS_DIAS} dias úteis.
            </Card.Description>
          </Card.Header>
          <Card.Content>
            {atencao.length === 0 ? (
              <p className="py-4 text-sm text-muted">Tudo em dia. 🎉</p>
            ) : (
              <ListaAtencao itens={atencao} onAbrir={onAbrirAtividade} />
            )}
          </Card.Content>
        </Card>

        <Card>
          <Card.Header>
            <Card.Title>Carga por pessoa</Card.Title>
            <Card.Description>O que está sob responsabilidade de cada um no período.</Card.Description>
          </Card.Header>
          <Card.Content className="flex flex-col gap-3">
            {carga.length === 0 && <p className="text-sm text-muted">Cadastre pessoas na aba Time.</p>}
            {carga.map(({ pessoa, abertos: n, atrasados: a, concluidos: c }) => (
              <div key={pessoa.id} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="font-medium">{pessoa.nome}</span>
                  <span className="text-xs text-muted">
                    {n} em aberto
                    {a > 0 && <span className="text-danger"> · {a} atrasado(s)</span>} · {c} concluído(s)
                  </span>
                </div>
                <div className="flex h-2 overflow-hidden rounded-full bg-default">
                  <div className="h-full bg-danger" style={{ width: `${(a / maiorCarga) * 100}%` }} />
                  <div className="h-full bg-accent" style={{ width: `${((n - a) / maiorCarga) * 100}%` }} />
                </div>
              </div>
            ))}
            {semResponsavel > 0 && (
              <p className="text-xs text-warning">{semResponsavel} item(ns) em aberto sem responsável.</p>
            )}
          </Card.Content>
        </Card>
      </div>
    </div>
  );
}

function Indicador({
  rotulo,
  valor,
  detalhe,
  destaque,
}: {
  rotulo: string;
  valor: ReactNode;
  detalhe?: string;
  destaque?: "danger" | "warning";
}) {
  const cor = destaque === "danger" ? "text-danger" : destaque === "warning" ? "text-warning" : "";
  return (
    <Card>
      <Card.Content className="flex flex-col gap-1">
        <span className="text-sm text-muted">{rotulo}</span>
        <span className={`text-3xl font-semibold tabular-nums ${cor}`}>{valor}</span>
        {detalhe && <span className="text-xs text-muted">{detalhe}</span>}
      </Card.Content>
    </Card>
  );
}

function ListaAtencao({ itens, onAbrir }: { itens: ItemTrabalho[]; onAbrir: (id: string) => void }) {
  const { dados } = useDados();
  return (
    <Table variant="secondary">
      <Table.ScrollContainer>
        <Table.Content aria-label="Itens que precisam de atenção" className="min-w-[520px]">
          <Table.Header>
            <Table.Column isRowHeader>Atividade</Table.Column>
            <Table.Column>Responsável</Table.Column>
            <Table.Column>Prazo</Table.Column>
            <Table.Column>Situação</Table.Column>
          </Table.Header>
          <Table.Body>
            {itens.map((item) => (
              <Table.Row key={item.id} id={item.id}>
                <Table.Cell>
                  <button className="text-left hover:underline" type="button" onClick={() => onAbrir(item.atividadeId)}>
                    <span className="block font-medium">{item.titulo}</span>
                    {item.contexto && <span className="text-xs text-muted">{item.contexto}</span>}
                  </button>
                </Table.Cell>
                <Table.Cell>{nomePessoa(dados.pessoas, item.responsavelId)}</Table.Cell>
                <Table.Cell>
                  <DataTexto data={item.prazo} />
                </Table.Cell>
                <Table.Cell>
                  <ChipSituacao situacao={item.situacao} />
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  );
}
