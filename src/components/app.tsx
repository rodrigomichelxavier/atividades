"use client";

import {
  ArrowRightFromSquare,
  Bars,
  ChartColumn,
  CircleCheck,
  FilePlus,
  FolderOpen,
  Gear,
  LayoutColumns3,
  ListCheck,
  ListUl,
  Persons,
  TriangleExclamation,
  Xmark,
} from "@gravity-ui/icons";
import { Alert, Button, Card, Chip, Spinner, Tabs, Toast } from "@heroui/react";
import { I18nProvider } from "react-aria-components/I18nProvider";
import { useState, type ReactNode } from "react";
import type { ErroPlanilha } from "@/lib/planilha";
import { DadosProvider, useDados, type Salvamento } from "@/lib/store";
import { Atividades } from "./atividades";
import { Fluxos } from "./fluxos";
import { Kanban } from "./kanban";
import { Painel } from "./painel";
import { Time } from "./time";

export function App() {
  // Fixa o idioma dos componentes (listas, datas, mensagens de campo) em
  // português, em vez de seguir o idioma do navegador.
  return (
    <I18nProvider locale="pt-BR">
      <DadosProvider>
        <Toast.Provider placement="bottom end" />
        <Conteudo />
      </DadosProvider>
    </I18nProvider>
  );
}

function Conteudo() {
  const { fase } = useDados();
  if (fase.tipo === "pronto") return <Shell />;
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <Card className="w-full max-w-lg">
        <Card.Header>
          <Card.Title className="text-2xl">Gestão de Atividades</Card.Title>
          <Card.Description>Gestão de atividades e fluxos. Seus dados ficam numa planilha no seu computador.</Card.Description>
        </Card.Header>
        <Card.Content>
          <TelaInicial />
        </Card.Content>
      </Card>
    </main>
  );
}

function TelaInicial() {
  const { fase, criarNovo, abrirOutro, reconectar, confirmarAvisos, nomeArquivo } = useDados();

  const botoesArquivo = (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Button className="flex-1" variant="secondary" onPress={abrirOutro}>
        <FolderOpen />
        Abrir planilha
      </Button>
      <Button className="flex-1" variant="secondary" onPress={criarNovo}>
        <FilePlus />
        Criar nova planilha
      </Button>
    </div>
  );

  switch (fase.tipo) {
    case "iniciando":
    case "carregando":
      return (
        <div className="flex items-center gap-3 py-6">
          <Spinner size="sm" />
          <span className="text-sm text-muted">Carregando…</span>
        </div>
      );

    case "sem-suporte":
      return (
        <Alert status="warning">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Navegador não suportado</Alert.Title>
            <Alert.Description>
              Para ler e gravar a planilha no seu computador, abra esta página no Google Chrome ou no Microsoft Edge.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      );

    case "sem-arquivo":
      return (
        <div className="flex flex-col gap-4">
          <p className="text-sm">
            Escolha a planilha <strong>.xlsx</strong> onde ficam suas atividades, ou crie uma nova. Da próxima vez, a
            aplicação lembra do arquivo.
          </p>
          {botoesArquivo}
        </div>
      );

    case "reconectar":
      return (
        <div className="flex flex-col gap-4">
          <Button fullWidth size="lg" onPress={reconectar}>
            <ArrowRightFromSquare />
            Continuar com {fase.nome}
          </Button>
          <p className="text-center text-xs text-muted">O navegador vai pedir permissão para acessar o arquivo.</p>
          <div className="border-t border-border pt-4">{botoesArquivo}</div>
        </div>
      );

    case "avisos":
      return (
        <div className="flex flex-col gap-4">
          <Alert status="warning">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>A planilha {nomeArquivo} tem valores inválidos</Alert.Title>
              <Alert.Description>
                Esses valores serão descartados na próxima vez que você salvar uma alteração. Se preferir, corrija no
                Excel antes.
              </Alert.Description>
            </Alert.Content>
          </Alert>
          <ListaErros erros={fase.avisos} />
          <Button onPress={confirmarAvisos}>Continuar mesmo assim</Button>
          {botoesArquivo}
        </div>
      );

    case "invalida":
      return (
        <div className="flex flex-col gap-4">
          <Alert status="danger">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>Não foi possível usar {nomeArquivo ?? "o arquivo"}</Alert.Title>
              <Alert.Description>Nada foi alterado na planilha.</Alert.Description>
            </Alert.Content>
          </Alert>
          <ListaErros erros={fase.erros} />
          {botoesArquivo}
        </div>
      );

    case "pronto":
      return null;
  }
}

function ListaErros({ erros }: { erros: ErroPlanilha[] }) {
  return (
    <ul className="max-h-60 list-disc overflow-auto rounded-xl bg-surface-secondary py-3 pr-3 pl-8 text-sm">
      {erros.map((e, i) => (
        <li key={i}>
          <span className="text-muted">
            {e.aba}
            {e.linha != null && `, linha ${e.linha}`}:
          </span>{" "}
          {e.mensagem}
        </li>
      ))}
    </ul>
  );
}

type Aba = "painel" | "atividades" | "kanban" | "time" | "fluxos";

const SECOES: { id: Aba; rotulo: string; icone: ReactNode }[] = [
  { id: "painel", rotulo: "Painel", icone: <ChartColumn className="size-4" /> },
  { id: "atividades", rotulo: "Atividades", icone: <ListUl className="size-4" /> },
  { id: "kanban", rotulo: "Kanban", icone: <LayoutColumns3 className="size-4" /> },
  { id: "time", rotulo: "Time", icone: <Persons className="size-4" /> },
  { id: "fluxos", rotulo: "Fluxos", icone: <Gear className="size-4" /> },
];

function Shell() {
  const { nomeArquivo, fecharArquivo } = useDados();
  const [aba, setAba] = useState<Aba>("atividades");
  const [atividadeAberta, setAtividadeAberta] = useState<string | null>(null);
  const [menuAberto, setMenuAberto] = useState(false);

  function abrirAtividade(id: string | null) {
    setAtividadeAberta(id);
    if (id) setAba("atividades");
  }

  return (
    <Tabs
      align="start"
      className="flex min-h-full flex-1 flex-col md:flex-row"
      orientation="vertical"
      variant="secondary"
      selectedKey={aba}
      onSelectionChange={(k) => {
        setAba(k as Aba);
        setMenuAberto(false);
        if (k === "atividades") setAtividadeAberta(null);
      }}
    >
      {/* Barra superior só no celular, onde a lateral vira gaveta. */}
      <header className="flex items-center gap-3 border-b border-border bg-surface px-4 py-3 md:hidden">
        <Button isIconOnly aria-label="Abrir menu" size="sm" variant="ghost" onPress={() => setMenuAberto(true)}>
          <Bars />
        </Button>
        <Marca />
        <div className="ml-auto">
          <IndicadorSalvamento />
        </div>
      </header>

      {menuAberto && (
        <div
          aria-hidden
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setMenuAberto(false)}
        />
      )}

      <aside
        className={`w-64 shrink-0 flex-col justify-between gap-6 border-border bg-surface p-4 md:sticky md:top-0 md:flex md:h-dvh md:w-60 md:border-r ${
          menuAberto ? "fixed inset-y-0 left-0 z-40 flex shadow-xl" : "hidden"
        }`}
      >
        <div className="flex min-h-0 flex-col gap-6">
          <div className="flex items-center justify-between gap-2">
            <Marca />
            <Button
              isIconOnly
              aria-label="Fechar menu"
              className="md:hidden"
              size="sm"
              variant="ghost"
              onPress={() => setMenuAberto(false)}
            >
              <Xmark />
            </Button>
          </div>

          {/* O indicador do HeroUI se desloca uma linha na orientação vertical, então
              o item ativo é marcado pelo estilo da própria aba. */}
          <Tabs.ListContainer className="min-h-0 overflow-y-auto rounded-none border-s-0 bg-transparent">
            <Tabs.List aria-label="Seções" className="w-full gap-1">
              {SECOES.map((secao) => (
                <Tabs.Tab
                  key={secao.id}
                  className="h-10 justify-start gap-2 rounded-lg px-3 hover:bg-default-hover data-[selected=true]:bg-default data-[selected=true]:font-semibold data-[selected=true]:text-foreground"
                  id={secao.id}
                >
                  {secao.icone}
                  {secao.rotulo}
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs.ListContainer>
        </div>

        {/* Rodapé da lateral: de qual planilha vêm os dados e como está o salvamento. */}
        <div className="flex flex-col gap-2 border-t border-border pt-4">
          <Chip className="max-w-full" size="sm" variant="secondary">
            <span className="block truncate" title={nomeArquivo ?? undefined}>
              {nomeArquivo}
            </span>
          </Chip>
          <IndicadorSalvamento />
          <Button className="justify-start" size="sm" variant="ghost" onPress={fecharArquivo}>
            <FolderOpen />
            Trocar arquivo
          </Button>
        </div>
      </aside>

      <main className="flex w-full min-w-0 flex-1 flex-col gap-4 px-4 py-6 md:px-8">
        <AlertaSalvamento />
        <Tabs.Panel id="painel">
          <Painel onAbrirAtividade={abrirAtividade} />
        </Tabs.Panel>
        <Tabs.Panel id="atividades">
          <Atividades selecionada={atividadeAberta} onSelecionar={abrirAtividade} />
        </Tabs.Panel>
        <Tabs.Panel id="kanban">
          <Kanban onAbrirAtividade={abrirAtividade} />
        </Tabs.Panel>
        <Tabs.Panel id="time">
          <Time />
        </Tabs.Panel>
        <Tabs.Panel id="fluxos">
          <Fluxos onAbrirAtividade={abrirAtividade} />
        </Tabs.Panel>
      </main>
    </Tabs>
  );
}

function Marca() {
  return (
    <span className="flex items-center gap-2">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-accent text-white">
        <ListCheck className="size-4" />
      </span>
      <span className="text-base font-semibold whitespace-nowrap">Gestão de Atividades</span>
    </span>
  );
}

function IndicadorSalvamento() {
  const { salvamento } = useDados();
  const conteudo: Record<Salvamento["tipo"], React.ReactNode> = {
    salvo: (
      <span className="flex items-center gap-1 text-success">
        <CircleCheck className="size-4" /> Salvo
      </span>
    ),
    salvando: (
      <span className="flex items-center gap-1 text-muted">
        <Spinner size="sm" /> Salvando…
      </span>
    ),
    erro: (
      <span className="flex items-center gap-1 text-danger">
        <TriangleExclamation className="size-4" /> Não salvo
      </span>
    ),
    conflito: (
      <span className="flex items-center gap-1 text-warning">
        <TriangleExclamation className="size-4" /> Conflito
      </span>
    ),
  };
  return <span className="text-sm whitespace-nowrap">{conteudo[salvamento.tipo]}</span>;
}

function AlertaSalvamento() {
  const { salvamento, tentarSalvar, recarregar, sobrescrever } = useDados();
  if (salvamento.tipo === "erro") {
    return (
      <Alert status="danger">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>Suas últimas alterações não foram salvas</Alert.Title>
          <Alert.Description>{salvamento.mensagem}</Alert.Description>
        </Alert.Content>
        <Button size="sm" variant="danger" onPress={tentarSalvar}>
          Tentar de novo
        </Button>
      </Alert>
    );
  }
  if (salvamento.tipo === "conflito") {
    return (
      <Alert status="warning">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>A planilha foi alterada fora da aplicação</Alert.Title>
          <Alert.Description>
            Alguém (talvez você, no Excel) mudou o arquivo depois que ele foi aberto aqui. Escolha qual versão manter.
          </Alert.Description>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onPress={recarregar}>
              Usar a versão do arquivo
            </Button>
            <Button size="sm" variant="danger-soft" onPress={sobrescrever}>
              Manter a minha e sobrescrever
            </Button>
          </div>
        </Alert.Content>
      </Alert>
    );
  }
  return null;
}
