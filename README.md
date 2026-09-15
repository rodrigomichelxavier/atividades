# Atividades RX

Gestão pessoal de atividades e fluxos de trabalho.

**Acesse:** https://rodrigomichelxavier.github.io/atividades/

## Como funciona

- Não existe servidor nem banco de dados. Os dados ficam numa planilha **.xlsx no seu computador**.
- A aplicação lê e grava direto nesse arquivo (File System Access API). Use **Google Chrome ou Microsoft Edge**.
- No primeiro acesso, clique em **Criar nova planilha** ou **Abrir planilha**. Depois, ela lembra do arquivo e só pede permissão.
- Cada alteração é salva automaticamente. Se o arquivo mudar por fora (por exemplo, no Excel), a aplicação avisa e pergunta qual versão manter.
- **Feche a planilha no Excel** enquanto usa a aplicação, senão o Windows bloqueia a gravação.

### Abas da planilha

| Aba | Conteúdo |
| --- | --- |
| Atividades | ID, título, descrição, responsável, prioridade, status, início, prazo, criada em, fluxo, ordem, SLA (dias úteis), predecessoras |
| Etapas | ID, atividade, ordem, etapa, responsável, status, início, prazo, SLA (dias úteis), predecessoras, conclusão, observações |
| Fluxos | ID, modelo, nome, data de início — um por fluxo de trabalho iniciado |
| Fluxos modelo | ID, nome, descrição — os fluxos padrão |
| Fluxos modelo itens | ID, modelo, ordem, atividade, responsável, prioridade, SLA (dias úteis), predecessoras |
| Pessoas | ID, nome, área, papel, e-mail |

As colunas de responsável, atividade, fluxo e modelo guardam o **ID** (ex.: `P-001`, `A-001`, `F-001`, `FM-001`). Predecessoras são IDs separados por vírgula (ex.: `E-001, E-002`).

Planilhas criadas antes dos fluxos continuam funcionando: as abas e colunas novas são opcionais na leitura e passam a ser gravadas no próximo salvamento.

### Fluxos de trabalho

- Um **fluxo padrão** é a receita de um processo recorrente: a lista de atividades na ordem, cada uma com responsável sugerido, SLA em dias úteis e de quais outras ela depende. Monte em **Fluxos → Configurar fluxo de trabalho**.
- **Iniciar fluxo de trabalho** cria as atividades de verdade a partir do padrão. Na tela de início você escolhe a data de início, desmarca o que não se aplica e ajusta responsável, SLA e datas.
- As datas sugeridas seguem as dependências: uma atividade sem predecessora começa no início do fluxo; com predecessora, começa no primeiro dia útil depois que a última delas vence. Desmarcar uma atividade no meio religa a cadeia em quem sobrou.
- Depois de iniciado, as datas ficam como estão: atrasos não empurram as seguintes automaticamente — edite a atividade quando precisar.
- Na lista e no Kanban, o filtro **Origem** separa atividades de rotina, de fluxo, ou de um fluxo específico.

### Regras das etapas

- **SLA** conta dias úteis (seg–sex) a partir da data de início: início na segunda com SLA 2 vence na quarta.
- O **prazo** da etapa é o prazo manual, se preenchido; senão, o calculado pelo SLA.
- Uma etapa só pode ser **iniciada ou concluída** depois que todas as predecessoras estiverem concluídas.
- Iniciar ou concluir uma etapa preenche as datas com o dia de hoje, se estiverem vazias.

> ⚠️ Este repositório é público. **Nunca faça commit de planilhas com dados reais** — o `.gitignore` já bloqueia `.xlsx` e `.csv`.

## Desenvolvimento

```bash
npm install
npm run dev     # http://localhost:3000
npm test        # testes da lógica (datas, SLA, planilha)
npm run lint
npm run build   # gera o site estático em out/
```

Stack: Next.js (export estático) · TypeScript · [HeroUI v3](https://heroui.com) · SheetJS. Publicado no GitHub Pages por GitHub Actions a cada push na `main`.
