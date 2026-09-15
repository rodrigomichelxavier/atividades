import { Button } from "@heroui/react";

export default function Home() {
  return (
    <main className="mx-auto flex max-w-3xl flex-1 flex-col gap-6 px-6 py-24">
      <h1 className="text-3xl font-semibold">Atividades RX</h1>
      <p className="text-lg">Gestão de atividades e fluxos.</p>
      <div>
        <Button>Nova atividade</Button>
      </div>
    </main>
  );
}
