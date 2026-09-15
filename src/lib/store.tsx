"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import * as arquivo from "./arquivo";
import { gerarPlanilha, lerPlanilha, PlanilhaInvalidaError, type ErroPlanilha } from "./planilha";
import { DADOS_VAZIOS, type Dados } from "./tipos";

export type Fase =
  | { tipo: "iniciando" }
  | { tipo: "sem-suporte" }
  | { tipo: "sem-arquivo" }
  | { tipo: "reconectar"; nome: string }
  | { tipo: "carregando" }
  | { tipo: "avisos"; avisos: ErroPlanilha[] }
  | { tipo: "invalida"; erros: ErroPlanilha[] }
  | { tipo: "pronto" };

export type Salvamento =
  | { tipo: "salvo" }
  | { tipo: "salvando" }
  | { tipo: "erro"; mensagem: string }
  | { tipo: "conflito" };

interface Contexto {
  fase: Fase;
  dados: Dados;
  nomeArquivo: string | null;
  salvamento: Salvamento;
  alterar: (fn: (dados: Dados) => Dados) => void;
  criarNovo: () => Promise<void>;
  abrirOutro: () => Promise<void>;
  reconectar: () => Promise<void>;
  confirmarAvisos: () => void;
  fecharArquivo: () => Promise<void>;
  tentarSalvar: () => void;
  recarregar: () => Promise<void>;
  sobrescrever: () => void;
}

const Ctx = createContext<Contexto | null>(null);

const ATRASO_SALVAR_MS = 400;

export function DadosProvider({ children }: { children: ReactNode }) {
  const [fase, setFase] = useState<Fase>({ tipo: "iniciando" });
  const [dados, setDados] = useState<Dados>(DADOS_VAZIOS);
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null);
  const [salvamento, setSalvamento] = useState<Salvamento>({ tipo: "salvo" });

  const handleRef = useRef<FileSystemFileHandle | null>(null);
  const modificadoRef = useRef<number>(0);
  const dadosRef = useRef<Dados>(DADOS_VAZIOS);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const salvandoRef = useRef<Promise<void>>(Promise.resolve());

  const gravar = useCallback(async (forcar: boolean) => {
    const handle = handleRef.current;
    if (!handle) return;
    setSalvamento({ tipo: "salvando" });
    try {
      if (!forcar && (await arquivo.modificadoEm(handle)) !== modificadoRef.current) {
        setSalvamento({ tipo: "conflito" });
        return;
      }
      modificadoRef.current = await arquivo.gravarArquivo(handle, gerarPlanilha(dadosRef.current));
      setSalvamento({ tipo: "salvo" });
    } catch (erro) {
      setSalvamento({ tipo: "erro", mensagem: arquivo.mensagemErroGravacao(erro) });
    }
  }, []);

  const agendarGravacao = useCallback(
    (forcar = false) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setSalvamento({ tipo: "salvando" });
      timerRef.current = setTimeout(() => {
        salvandoRef.current = salvandoRef.current.then(() => gravar(forcar));
      }, ATRASO_SALVAR_MS);
    },
    [gravar],
  );

  const aplicarDados = useCallback((novos: Dados) => {
    dadosRef.current = novos;
    setDados(novos);
  }, []);

  const carregar = useCallback(
    async (handle: FileSystemFileHandle) => {
      setFase({ tipo: "carregando" });
      handleRef.current = handle;
      setNomeArquivo(handle.name);
      setSalvamento({ tipo: "salvo" });
      try {
        const { conteudo, modificadoEm } = await arquivo.lerArquivo(handle);
        modificadoRef.current = modificadoEm;
        const resultado = lerPlanilha(conteudo);
        aplicarDados(resultado.dados);
        // Se não der para lembrar o arquivo, só perde o atalho de reabrir: segue normalmente.
        await arquivo.lembrarArquivo(handle).catch(() => {});
        if (resultado.vazia) {
          // Arquivo em branco: já grava as abas e cabeçalhos.
          modificadoRef.current = await arquivo.gravarArquivo(handle, gerarPlanilha(resultado.dados));
        }
        setFase(resultado.avisos.length > 0 ? { tipo: "avisos", avisos: resultado.avisos } : { tipo: "pronto" });
      } catch (erro) {
        if (erro instanceof PlanilhaInvalidaError) {
          setFase({ tipo: "invalida", erros: erro.erros });
        } else {
          setFase({
            tipo: "invalida",
            erros: [{ aba: "—", linha: null, mensagem: arquivo.mensagemErroGravacao(erro) }],
          });
        }
      }
    },
    [aplicarDados],
  );

  useEffect(() => {
    (async () => {
      if (!arquivo.navegadorSuportado()) return setFase({ tipo: "sem-suporte" });
      const handle = await arquivo.ultimoArquivo();
      if (!handle) return setFase({ tipo: "sem-arquivo" });
      if (await arquivo.temPermissao(handle).catch(() => false)) return carregar(handle);
      handleRef.current = handle;
      setFase({ tipo: "reconectar", nome: handle.name });
    })();
  }, [carregar]);

  // Avisa antes de fechar a aba com alterações ainda não gravadas.
  useEffect(() => {
    if (salvamento.tipo === "salvo") return;
    const aviso = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", aviso);
    return () => window.removeEventListener("beforeunload", aviso);
  }, [salvamento.tipo]);

  const alterar = useCallback(
    (fn: (d: Dados) => Dados) => {
      const novos = fn(dadosRef.current);
      if (novos === dadosRef.current) return;
      aplicarDados(novos);
      agendarGravacao();
    },
    [aplicarDados, agendarGravacao],
  );

  const tratarEscolha = useCallback(
    async (escolher: () => Promise<FileSystemFileHandle>, novo: boolean) => {
      try {
        const handle = await escolher();
        if (novo) await arquivo.gravarArquivo(handle, gerarPlanilha(DADOS_VAZIOS));
        await carregar(handle);
      } catch (erro) {
        if (!arquivo.foiCancelado(erro)) {
          setFase({
            tipo: "invalida",
            erros: [{ aba: "—", linha: null, mensagem: arquivo.mensagemErroGravacao(erro) }],
          });
        }
      }
    },
    [carregar],
  );

  const valor: Contexto = {
    fase,
    dados,
    nomeArquivo,
    salvamento,
    alterar,
    criarNovo: () => tratarEscolha(arquivo.criarArquivo, true),
    abrirOutro: () => tratarEscolha(arquivo.escolherArquivo, false),
    reconectar: async () => {
      const handle = handleRef.current;
      if (!handle) return setFase({ tipo: "sem-arquivo" });
      if (await arquivo.garantirPermissao(handle).catch(() => false)) await carregar(handle);
    },
    confirmarAvisos: () => setFase({ tipo: "pronto" }),
    fecharArquivo: async () => {
      await salvandoRef.current;
      await arquivo.esquecerArquivo();
      handleRef.current = null;
      setNomeArquivo(null);
      aplicarDados(DADOS_VAZIOS);
      setFase({ tipo: "sem-arquivo" });
    },
    tentarSalvar: () => agendarGravacao(),
    recarregar: async () => {
      if (handleRef.current) await carregar(handleRef.current);
    },
    sobrescrever: () => agendarGravacao(true),
  };

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useDados(): Contexto {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useDados precisa estar dentro de <DadosProvider>.");
  return ctx;
}
