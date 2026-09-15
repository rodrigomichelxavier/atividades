"use client";

import { Pencil, Persons, Plus, TrashBin } from "@gravity-ui/icons";
import { Button, Chip, Table, toast } from "@heroui/react";
import { useState } from "react";
import { excluirPessoa } from "@/lib/operacoes";
import { useDados } from "@/lib/store";
import type { Pessoa } from "@/lib/tipos";
import { ConfirmarExclusao, Vazio } from "./comum";
import { FormPessoa } from "./formularios";

export function Time() {
  const { dados, alterar } = useDados();
  const [form, setForm] = useState<Pessoa | "nova" | null>(null);
  const [excluir, setExcluir] = useState<Pessoa | null>(null);
  const pessoas = [...dados.pessoas].sort((a, b) => a.nome.localeCompare(b.nome));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">Pessoas que podem ser responsáveis por atividades e etapas.</p>
        <Button onPress={() => setForm("nova")}>
          <Plus />
          Nova pessoa
        </Button>
      </div>

      {pessoas.length === 0 ? (
        <Vazio
          acao={
            <Button onPress={() => setForm("nova")}>
              <Plus />
              Cadastrar pessoa
            </Button>
          }
          icone={<Persons />}
          texto="Cadastre você e as pessoas do time para atribuir responsáveis."
          titulo="Nenhuma pessoa cadastrada"
        />
      ) : (
        <Table>
          <Table.ScrollContainer>
            <Table.Content aria-label="Time" className="min-w-[700px]">
              <Table.Header>
                <Table.Column isRowHeader>Nome</Table.Column>
                <Table.Column>Área</Table.Column>
                <Table.Column>Papel</Table.Column>
                <Table.Column>E-mail</Table.Column>
                <Table.Column>Etapas em aberto</Table.Column>
                <Table.Column className="text-end">Ações</Table.Column>
              </Table.Header>
              <Table.Body>
                {pessoas.map((p) => (
                  <Table.Row key={p.id} id={p.id}>
                    <Table.Cell>
                      <span className="block font-medium">{p.nome}</span>
                      <span className="text-xs text-muted">{p.id}</span>
                    </Table.Cell>
                    <Table.Cell>{p.area || "—"}</Table.Cell>
                    <Table.Cell>
                      <Chip color={p.papel === "Gestor" ? "accent" : "default"} size="sm" variant="soft">
                        {p.papel}
                      </Chip>
                    </Table.Cell>
                    <Table.Cell>{p.email || "—"}</Table.Cell>
                    <Table.Cell>
                      {dados.etapas.filter((e) => e.responsavelId === p.id && e.status !== "Concluída").length}
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex justify-end gap-1">
                        <Button isIconOnly aria-label="Editar pessoa" size="sm" variant="ghost" onPress={() => setForm(p)}>
                          <Pencil />
                        </Button>
                        <Button isIconOnly aria-label="Excluir pessoa" size="sm" variant="ghost" onPress={() => setExcluir(p)}>
                          <TrashBin />
                        </Button>
                      </div>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      )}

      {form && <FormPessoa pessoa={form === "nova" ? null : form} onFechar={() => setForm(null)} />}
      <ConfirmarExclusao
        aberta={!!excluir}
        mensagem={`"${excluir?.nome}" será removida do time.`}
        titulo="Excluir pessoa?"
        onConfirmar={() => {
          if (!excluir) return;
          const r = excluirPessoa(dados, excluir.id);
          if (!r.ok) toast.danger("Não foi possível excluir", { description: r.erro });
          else {
            alterar(() => r.dados);
            toast.success("Pessoa excluída");
          }
        }}
        onFechar={() => setExcluir(null)}
      />
    </div>
  );
}
