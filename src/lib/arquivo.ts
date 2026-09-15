// Acesso ao arquivo .xlsx local via File System Access API (Chrome e Edge).
// O "handle" do arquivo fica guardado no IndexedDB para reabrir sem procurar o caminho de novo.

const TIPOS_XLSX = [
  {
    description: "Planilha Excel",
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx" as const],
    },
  },
];

// Tipos da API que ainda não estão na lib DOM padrão do TypeScript.
type Permissao = "granted" | "denied" | "prompt";
interface HandleComPermissao extends FileSystemFileHandle {
  queryPermission(opcoes: { mode: "readwrite" }): Promise<Permissao>;
  requestPermission(opcoes: { mode: "readwrite" }): Promise<Permissao>;
}
interface JanelaComArquivos {
  showOpenFilePicker(opcoes: object): Promise<FileSystemFileHandle[]>;
  showSaveFilePicker(opcoes: object): Promise<FileSystemFileHandle>;
}

export function navegadorSuportado(): boolean {
  return typeof window !== "undefined" && "showOpenFilePicker" in window && "showSaveFilePicker" in window;
}

function janela(): JanelaComArquivos {
  return window as unknown as JanelaComArquivos;
}

/** O usuário fechou a janela de escolha de arquivo. */
export function foiCancelado(erro: unknown): boolean {
  return erro instanceof DOMException && erro.name === "AbortError";
}

export async function escolherArquivo(): Promise<FileSystemFileHandle> {
  const [handle] = await janela().showOpenFilePicker({ types: TIPOS_XLSX, multiple: false });
  return handle;
}

export async function criarArquivo(): Promise<FileSystemFileHandle> {
  return janela().showSaveFilePicker({ suggestedName: "atividades.xlsx", types: TIPOS_XLSX });
}

/** Garante permissão de leitura e escrita. Precisa ser chamado a partir de um clique. */
export async function garantirPermissao(handle: FileSystemFileHandle): Promise<boolean> {
  const h = handle as HandleComPermissao;
  if ((await h.queryPermission({ mode: "readwrite" })) === "granted") return true;
  return (await h.requestPermission({ mode: "readwrite" })) === "granted";
}

export async function temPermissao(handle: FileSystemFileHandle): Promise<boolean> {
  return (await (handle as HandleComPermissao).queryPermission({ mode: "readwrite" })) === "granted";
}

export async function lerArquivo(handle: FileSystemFileHandle) {
  const arquivo = await handle.getFile();
  return { conteudo: await arquivo.arrayBuffer(), modificadoEm: arquivo.lastModified };
}

export async function modificadoEm(handle: FileSystemFileHandle): Promise<number> {
  return (await handle.getFile()).lastModified;
}

export async function gravarArquivo(handle: FileSystemFileHandle, conteudo: ArrayBuffer): Promise<number> {
  const escrita = await handle.createWritable();
  try {
    await escrita.write(conteudo);
    await escrita.close();
  } catch (erro) {
    await escrita.abort().catch(() => {});
    throw erro;
  }
  return modificadoEm(handle);
}

export function mensagemErroGravacao(erro: unknown): string {
  if (erro instanceof DOMException) {
    if (erro.name === "NoModificationAllowedError" || erro.name === "InvalidStateError") {
      return "O arquivo está bloqueado. Feche a planilha no Excel e tente de novo.";
    }
    if (erro.name === "NotAllowedError") return "O navegador não deu permissão para gravar no arquivo.";
    if (erro.name === "NotFoundError") return "O arquivo não foi encontrado. Ele foi movido ou apagado?";
  }
  return "Não foi possível salvar o arquivo.";
}

// ---------- Lembrar o último arquivo (IndexedDB) ----------

const BANCO = "atividades-rx";
const LOJA = "arquivos";
const CHAVE = "ultimo";

function abrirBanco(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(BANCO, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(LOJA);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function operar<T>(modo: IDBTransactionMode, fn: (loja: IDBObjectStore) => IDBRequest): Promise<T> {
  const banco = await abrirBanco();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = fn(banco.transaction(LOJA, modo).objectStore(LOJA));
      req.onsuccess = () => resolve(req.result as T);
      req.onerror = () => reject(req.error);
    });
  } finally {
    banco.close();
  }
}

export async function lembrarArquivo(handle: FileSystemFileHandle): Promise<void> {
  await operar("readwrite", (loja) => loja.put(handle, CHAVE));
}

export async function ultimoArquivo(): Promise<FileSystemFileHandle | null> {
  try {
    return (await operar<FileSystemFileHandle | undefined>("readonly", (loja) => loja.get(CHAVE))) ?? null;
  } catch {
    return null;
  }
}

export async function esquecerArquivo(): Promise<void> {
  await operar("readwrite", (loja) => loja.delete(CHAVE)).catch(() => {});
}
