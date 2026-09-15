"use client";

import { Card, Table } from "@heroui/react";
import { useState, type ReactNode } from "react";
import { diasUteisEntre, hoje } from "@/lib/datas";
import { prazoEfetivo, prazoSla, situacaoEtapa, type Situacao } from "@/lib/fluxo";
import { dentroDoIntervalo, intervaloDoPeriodo, PERIODOS, type Periodo } from "@/lib/periodos";
import { useDados } from "@/lib/store";
import type { Etapa } from "@/lib/tipos";
import { CampoSelecao, ChipSituacao, DataTexto, nomePessoa, opcoesDe, Vazio } from "./comum";
import { ChartColumn } from "@gravity-ui/icons";

const JANELA_PROXIMOS_DIAS = 5;

// No painel só fazem sentido os períodos que olham para trás: o futuro entra sempre.
const PERIODOS_PAINEL: Periodo[] = ["Últimos 3 meses", "Últimos 12 meses", "Este mês", "Todo o período"];

export function Painel({ onAbrirAtividade }: { onAbrirAtividade: (id: string) => void }) {
  const { dados } = useDados();
  const [periodo, setPeriodo] = useState<Periodo>("Últimos 3 meses");
  const dataHoje = hoje();
  const mesAtual = dataHoje.slice(0, 7);

  // O painel olha para o presente: o período só corta o passado ("de 3 meses
  // para cá"), senão o que vence à frente — o que mais importa aqui — sumiria.
  // A data que situa o item no tempo é o prazo, ou a conclusão quando não há prazo.
  const intervalo = { de: intervaloDoPeriodo(periodo, { de: null, ate: null }, dataHoje).de, ate: null };
  const noPeriodo = (e: Etapa) => dentroDoIntervalo(prazoEfetivo(e) ?? e.dataConclusao, intervalo);
  const etapas = dados.etapas.filter(noPeriodo);

  const comSituacao = etapas.map((e) => ({ etapa: e, situacao: situacaoEtapa(e, dados.etapas, dataHoje) }));
  const abertas = comSituacao.filter(({ etapa }) => etapa.status !== "Concluída");
  const atrasadas = abertas.filter(({ situacao }) => situacao.tipo === "atrasada");
  const vencendo = abertas.filter(({ etapa, situacao }) => {
    if (situacao.tipo === "vence-hoje") return true;
    const prazo = prazoEfetivo(etapa);
    return situacao.tipo === "no-prazo" && !!prazo && diasUteisEntre(dataHoje, prazo) <= JANELA_PROXIMOS_DIAS;
  });
  const concluidasMes = etapas.filter((e) => e.status === "Concluída" && e.dataConclusao?.startsWith(mesAtual));

  const comSla = etapas.filter((e) => e.status === "Concluída" && e.dataConclusao && prazoSla(e));
  const noSla = comSla.filter((e) => e.dataConclusao! <= prazoSla(e)!);
  const percentualSla = comSla.length > 0 ? Math.round((noSla.length / comSla.length) * 100) : null;

  const atividadesNoPeriodo = dados.atividades.filter((a) => dentroDoIntervalo(a.prazo, intervalo));
  const atividadesAbertas = atividadesNoPeriodo.filter((a) => a.status !== "Concluída").length;
  const fluxosEmAndamento = dados.fluxos.filter((f) =>
    dados.atividades.some((a) => a.fluxoId === f.id && a.status !== "Concluída"),
  ).length;

  const carga = dados.pessoas
    .map((p) => ({
      pessoa: p,
      abertas: abertas.filter(({ etapa }) => etapa.responsavelId === p.id).length,
      atrasadas: atrasadas.filter(({ etapa }) => etapa.responsavelId === p.id).length,
      concluidasMes: concluidasMes.filter((e) => e.responsavelId === p.id).length,
    }))
    .sort((a, b) => b.abertas - a.abertas || a.pessoa.nome.localeCompare(b.pessoa.nome));
  const semResponsavel = abertas.filter(({ etapa }) => !etapa.responsavelId).length;
  const maiorCarga = Math.max(1, ...carga.map((c) => c.abertas));

  const atencao = [...atrasadas, ...vencendo].sort((a, b) =>
    (prazoEfetivo(a.etapa) ?? "").localeCompare(prazoEfetivo(b.etapa) ?? ""),
  );

  if (dados.atividades.length === 0) {
    return (
      <Vazio
        icone={<ChartColumn />}
        texto="Os indicadores aparecem aqui assim que você cadastrar atividades e etapas."
        titulo="Ainda não há dados"
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-sm text-muted">
          Conta o que venceu ou foi concluído dentro do período, mais tudo que ainda está por vir.
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
        <Indicador rotulo="Etapas em aberto" valor={abertas.length} />
        <Indicador destaque={atrasadas.length > 0 ? "danger" : undefined} rotulo="Etapas atrasadas" valor={atrasadas.length} />
        <Indicador
          destaque={vencendo.length > 0 ? "warning" : undefined}
          detalhe={`Até ${JANELA_PROXIMOS_DIAS} dias úteis`}
          rotulo="Vencendo em breve"
          valor={vencendo.length}
        />
        <Indicador
          detalhe={comSla.length > 0 ? `${noSla.length} de ${comSla.length} etapas com SLA` : "Nenhuma etapa concluída com SLA"}
          rotulo="SLA cumprido"
          valor={percentualSla == null ? "—" : `${percentualSla}%`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <Card>
          <Card.Header>
            <Card.Title>Precisa de atenção</Card.Title>
            <Card.Description>Etapas atrasadas ou que vencem nos próximos {JANELA_PROXIMOS_DIAS} dias úteis.</Card.Description>
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
            <Card.Description>Etapas em aberto sob responsabilidade de cada um.</Card.Description>
          </Card.Header>
          <Card.Content className="flex flex-col gap-3">
            {carga.length === 0 && <p className="text-sm text-muted">Cadastre pessoas na aba Time.</p>}
            {carga.map(({ pessoa, abertas: n, atrasadas: a, concluidasMes: c }) => (
              <div key={pessoa.id} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="font-medium">{pessoa.nome}</span>
                  <span className="text-xs text-muted">
                    {n} em aberto
                    {a > 0 && <span className="text-danger"> · {a} atrasada(s)</span>} · {c} concluída(s) no mês
                  </span>
                </div>
                <div className="flex h-2 overflow-hidden rounded-full bg-default">
                  <div className="h-full bg-danger" style={{ width: `${(a / maiorCarga) * 100}%` }} />
                  <div className="h-full bg-accent" style={{ width: `${((n - a) / maiorCarga) * 100}%` }} />
                </div>
              </div>
            ))}
            {semResponsavel > 0 && (
              <p className="text-xs text-warning">{semResponsavel} etapa(s) em aberto sem responsável.</p>
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

function ListaAtencao({ itens, onAbrir }: { itens: { etapa: Etapa; situacao: Situacao }[]; onAbrir: (id: string) => void }) {
  const { dados } = useDados();
  return (
    <Table variant="secondary">
      <Table.ScrollContainer>
        <Table.Content aria-label="Etapas que precisam de atenção" className="min-w-[520px]">
          <Table.Header>
            <Table.Column isRowHeader>Etapa</Table.Column>
            <Table.Column>Responsável</Table.Column>
            <Table.Column>Prazo</Table.Column>
            <Table.Column>Situação</Table.Column>
          </Table.Header>
          <Table.Body>
            {itens.map(({ etapa, situacao }) => (
              <Table.Row key={etapa.id} id={etapa.id}>
                <Table.Cell>
                  <button className="text-left hover:underline" type="button" onClick={() => onAbrir(etapa.atividadeId)}>
                    <span className="block font-medium">{etapa.titulo}</span>
                    <span className="text-xs text-muted">
                      {dados.atividades.find((a) => a.id === etapa.atividadeId)?.titulo}
                    </span>
                  </button>
                </Table.Cell>
                <Table.Cell>{nomePessoa(dados.pessoas, etapa.responsavelId)}</Table.Cell>
                <Table.Cell>
                  <DataTexto data={prazoEfetivo(etapa)} />
                </Table.Cell>
                <Table.Cell>
                  <ChipSituacao situacao={situacao} />
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  );
}
