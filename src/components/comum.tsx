"use client";

import {
  Button,
  Checkbox,
  Chip,
  Description,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
  TextArea,
  TextField,
} from "@heroui/react";
import { ChevronLeft, ChevronRight, TrashBin } from "@gravity-ui/icons";
import type { ReactNode } from "react";
import { formatarData } from "@/lib/datas";
import type { Situacao } from "@/lib/fluxo";
import type { Pessoa, Prioridade, Status } from "@/lib/tipos";

type CorChip = "default" | "accent" | "success" | "warning" | "danger";

const COR_STATUS: Record<Status, CorChip> = {
  "A fazer": "default",
  "Em andamento": "accent",
  Aguardando: "warning",
  Concluída: "success",
};

const COR_PRIORIDADE: Record<Prioridade, CorChip> = {
  Baixa: "default",
  Média: "accent",
  Alta: "warning",
  Urgente: "danger",
};

export function ChipStatus({ status }: { status: Status }) {
  return (
    <Chip className="whitespace-nowrap" color={COR_STATUS[status]} size="sm" variant="soft">
      {status}
    </Chip>
  );
}

export function ChipPrioridade({ prioridade }: { prioridade: Prioridade }) {
  return (
    <Chip className="whitespace-nowrap" color={COR_PRIORIDADE[prioridade]} size="sm" variant="soft">
      {prioridade}
    </Chip>
  );
}

function plural(n: number, singular: string, pluralTexto: string) {
  return `${n} ${n === 1 ? singular : pluralTexto}`;
}

export function textoSituacao(s: Situacao): { texto: string; cor: CorChip } {
  switch (s.tipo) {
    case "concluida-no-prazo":
      return { texto: "Concluída no prazo", cor: "success" };
    case "concluida-com-atraso":
      return { texto: `Concluída com ${plural(s.dias, "dia útil", "dias úteis")} de atraso`, cor: "warning" };
    case "concluida":
      return { texto: "Concluída", cor: "success" };
    case "bloqueada":
      return { texto: `Aguardando ${s.por.map((e) => e.id).join(", ")}`, cor: "default" };
    case "atrasada":
      return { texto: `Atrasada ${plural(s.dias, "dia útil", "dias úteis")}`, cor: "danger" };
    case "vence-hoje":
      return { texto: "Vence hoje", cor: "warning" };
    case "no-prazo":
      return { texto: `${plural(s.dias, "dia útil restante", "dias úteis restantes")}`, cor: "accent" };
    case "sem-prazo":
      return { texto: "Sem prazo", cor: "default" };
  }
}

export function ChipSituacao({ situacao }: { situacao: Situacao }) {
  const { texto, cor } = textoSituacao(situacao);
  return (
    <Chip className="whitespace-nowrap" color={cor} size="sm" variant="soft">
      {texto}
    </Chip>
  );
}

export function nomePessoa(pessoas: Pessoa[], id: string | null): string {
  if (!id) return "—";
  return pessoas.find((p) => p.id === id)?.nome ?? id;
}

export function DataTexto({ data, destaque }: { data: string | null; destaque?: "danger" | "warning" }) {
  const cor = destaque === "danger" ? "text-danger" : destaque === "warning" ? "text-warning" : "";
  return <span className={`whitespace-nowrap ${cor}`}>{formatarData(data)}</span>;
}

// ---------- Campos de formulário ----------

export function CampoTexto(props: {
  label: string;
  valor: string;
  onChange: (v: string) => void;
  obrigatorio?: boolean;
  placeholder?: string;
  descricao?: string;
  multilinha?: boolean;
  tipo?: "text" | "email" | "number" | "date";
  autoFocus?: boolean;
  /** Mantém o rótulo para leitores de tela, mas fora da tela. */
  labelOculto?: boolean;
}) {
  return (
    <TextField
      className="w-full"
      isRequired={props.obrigatorio}
      type={props.tipo ?? "text"}
      value={props.valor}
      onChange={props.onChange}
    >
      <Label className={props.labelOculto ? "sr-only" : undefined}>{props.label}</Label>
      {props.multilinha ? (
        <TextArea className="w-full" placeholder={props.placeholder} rows={3} />
      ) : (
        <Input autoFocus={props.autoFocus} className="w-full" min={props.tipo === "number" ? 0 : undefined} placeholder={props.placeholder} />
      )}
      {props.descricao && <Description>{props.descricao}</Description>}
    </TextField>
  );
}

export interface Opcao {
  id: string;
  rotulo: string;
}

const NENHUM = "__nenhum__";

export function CampoSelecao(props: {
  label: string;
  valor: string | null;
  opcoes: Opcao[];
  onChange: (v: string | null) => void;
  permitirVazio?: string;
  descricao?: string;
  /** Mantém o rótulo para leitores de tela, mas fora da tela. */
  labelOculto?: boolean;
}) {
  const opcoes = props.permitirVazio ? [{ id: NENHUM, rotulo: props.permitirVazio }, ...props.opcoes] : props.opcoes;
  // O rótulo fica numa linha só; o title mostra por inteiro quando não couber.
  const selecionado = opcoes.find((o) => o.id === (props.valor ?? NENHUM))?.rotulo;
  return (
    <Select
      className="w-full"
      value={props.valor ?? (props.permitirVazio ? NENHUM : null)}
      onChange={(v) => props.onChange(v == null || v === NENHUM ? null : String(v))}
    >
      <Label className={props.labelOculto ? "sr-only" : undefined}>{props.label}</Label>
      <Select.Trigger className="items-center">
        <Select.Value className="min-w-0 truncate">
          {selecionado ? <span title={selecionado}>{selecionado}</span> : undefined}
        </Select.Value>
        <Select.Indicator />
      </Select.Trigger>
      {props.descricao && <Description>{props.descricao}</Description>}
      <Select.Popover>
        <ListBox>
          {opcoes.map((o) => (
            <ListBox.Item key={o.id} id={o.id} textValue={o.rotulo}>
              {o.rotulo}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

export function CampoMultiplo(props: {
  label: string;
  valores: string[];
  opcoes: Opcao[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  descricao?: string;
}) {
  return (
    <Select
      className="w-full"
      isDisabled={props.opcoes.length === 0}
      placeholder={props.placeholder}
      selectionMode="multiple"
      value={props.valores}
      onChange={(v) => props.onChange((v as (string | number)[]).map(String))}
    >
      <Label>{props.label}</Label>
      <Select.Trigger className="items-center">
        <Select.Value className="min-w-0 truncate" />
        <Select.Indicator />
      </Select.Trigger>
      {props.descricao && <Description>{props.descricao}</Description>}
      <Select.Popover>
        <ListBox selectionMode="multiple">
          {props.opcoes.map((o) => (
            <ListBox.Item key={o.id} id={o.id} textValue={o.rotulo}>
              {o.rotulo}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

export function CampoCheck(props: {
  /** Texto ao lado da caixa. Sem ele, use `aria` para nomear o campo. */
  rotulo?: string;
  aria?: string;
  marcado: boolean;
  onChange: (v: boolean) => void;
  descricao?: string;
}) {
  return (
    <Checkbox aria-label={props.rotulo ? undefined : props.aria} isSelected={props.marcado} onChange={props.onChange}>
      <Checkbox.Content>
        <Checkbox.Control>
          <Checkbox.Indicator />
        </Checkbox.Control>
        {props.rotulo && (
          <span className="flex flex-col">
            <span>{props.rotulo}</span>
            {props.descricao && <span className="text-xs text-muted">{props.descricao}</span>}
          </span>
        )}
      </Checkbox.Content>
    </Checkbox>
  );
}

export function opcoesDe<T extends string>(lista: readonly T[]): Opcao[] {
  return lista.map((v) => ({ id: v, rotulo: v }));
}

export function opcoesPessoas(pessoas: Pessoa[]): Opcao[] {
  return [...pessoas].sort((a, b) => a.nome.localeCompare(b.nome)).map((p) => ({ id: p.id, rotulo: p.nome }));
}

// ---------- Janelas ----------

export function JanelaFormulario(props: {
  aberta: boolean;
  onFechar: () => void;
  titulo: string;
  children: ReactNode;
  onSalvar: () => void;
  podeSalvar: boolean;
  tamanho?: "md" | "lg";
}) {
  return (
    <Modal.Backdrop isOpen={props.aberta} onOpenChange={(aberta) => !aberta && props.onFechar()}>
      <Modal.Container scroll="outside" size={props.tamanho ?? "md"}>
        <Modal.Dialog>
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>{props.titulo}</Modal.Heading>
          </Modal.Header>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (props.podeSalvar) props.onSalvar();
            }}
          >
            <Modal.Body className="flex flex-col gap-4">{props.children}</Modal.Body>
            <Modal.Footer>
              <Button slot="close" variant="secondary">
                Cancelar
              </Button>
              <Button isDisabled={!props.podeSalvar} type="submit">
                Salvar
              </Button>
            </Modal.Footer>
          </form>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

export function ConfirmarExclusao(props: {
  aberta: boolean;
  onFechar: () => void;
  titulo: string;
  mensagem: ReactNode;
  onConfirmar: () => void;
}) {
  return (
    <Modal.Backdrop isOpen={props.aberta} onOpenChange={(aberta) => !aberta && props.onFechar()}>
      <Modal.Container size="sm">
        <Modal.Dialog>
          <Modal.Header>
            <Modal.Icon className="bg-danger-soft text-danger-soft-foreground">
              <TrashBin className="size-5" />
            </Modal.Icon>
            <Modal.Heading>{props.titulo}</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <p>{props.mensagem}</p>
          </Modal.Body>
          <Modal.Footer>
            <Button slot="close" variant="secondary">
              Cancelar
            </Button>
            <Button
              variant="danger"
              onPress={() => {
                props.onConfirmar();
                props.onFechar();
              }}
            >
              Excluir
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

const TAMANHOS_PAGINA = [25, 50, 100];

/** Fatia a lista e devolve os controles de navegação. Nada aparece com uma página só. */
export function Paginacao({
  total,
  pagina,
  porPagina,
  onPagina,
  onPorPagina,
}: {
  total: number;
  pagina: number;
  porPagina: number;
  onPagina: (p: number) => void;
  onPorPagina: (n: number) => void;
}) {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  const primeiro = total === 0 ? 0 : (pagina - 1) * porPagina + 1;
  const ultimo = Math.min(total, pagina * porPagina);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <span className="text-muted">
        {total === 0 ? "Nenhum resultado" : `${primeiro}–${ultimo} de ${total}`}
      </span>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted whitespace-nowrap">Por página</span>
          <div className="w-24">
            <CampoSelecao
              labelOculto
              label="Itens por página"
              opcoes={TAMANHOS_PAGINA.map((n) => ({ id: String(n), rotulo: String(n) }))}
              valor={String(porPagina)}
              onChange={(v) => v && onPorPagina(Number(v))}
            />
          </div>
        </div>
        {paginas > 1 && (
          <div className="flex items-center gap-2">
            <Button isDisabled={pagina <= 1} size="sm" variant="secondary" onPress={() => onPagina(pagina - 1)}>
              <ChevronLeft />
              Anterior
            </Button>
            <span className="text-xs whitespace-nowrap text-muted">
              {pagina} de {paginas}
            </span>
            <Button isDisabled={pagina >= paginas} size="sm" variant="secondary" onPress={() => onPagina(pagina + 1)}>
              Próxima
              <ChevronRight />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export function Vazio({ icone, titulo, texto, acao }: { icone: ReactNode; titulo: string; texto: string; acao?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border px-6 py-12 text-center">
      <div className="text-muted [&_svg]:size-8">{icone}</div>
      <p className="font-medium">{titulo}</p>
      <p className="max-w-sm text-sm text-muted">{texto}</p>
      {acao}
    </div>
  );
}
