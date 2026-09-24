# WorshipDeck

> Suíte local-first de apresentação e operação de culto para igrejas que transforma a ordem do culto em slides prontos para exibição: gera apresentações PowerPoint (.pptx) com fontes embutidas para uso offline, console de operador para a tela da congregação e controle remoto via smartphone por Wi-Fi local.

[English](README.md) | [Bahasa Indonesia](README.id.md) | [简体中文](README.zh-CN.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md) | [Deutsch](README.de.md) | [Français](README.fr.md) | [Português (Brasil)](README.pt-BR.md) | [Русский](README.ru.md)  
[Website](https://wiradelta.id/worship-deck) | [Download for Windows](https://github.com/wiradeltaid/worship-deck/releases) | [Changelog](CHANGELOG.md) | [Contributing](CONTRIBUTING.md) | [License](LICENSE) | [Security](SECURITY.md) | [Privacy](PRIVACY.md) | [Attributions](ATTRIBUTIONS.md)

---

> **Aviso de tradução:** Este arquivo é uma tradução de [README.md](README.md) fornecida apenas para fins de conveniência. Em caso de divergências ou conflitos de interpretação, a versão oficial em inglês (`README.md`) prevalece como fonte autoritativa. Toda a documentação técnica aprofundada e documentos jurídicos são mantidos em inglês.

Desenvolvido para congregações cristãs e cultos litúrgicos. Os layouts de slides são gerenciados como dados configuráveis em vez de código engessado, permitindo que qualquer igreja com uma liturgia semelhante faça adaptações diretamente pelo navegador.

## Problema que Resolve

Preparar manualmente os slides de cada culto consome de 2 a 4 horas por semana, grande parte gasta digitando novamente letras de hinos que já haviam sido cadastradas no passado. Mudanças de última hora nas músicas exigem refazer a apresentação do zero, e o conhecimento técnico frequentemente depende de um único voluntário.

O WorshipDeck lê o roteiro preparado pelos líderes em mensagens ou formulários e monta automaticamente slides limpos e consistentes.

```text
roteiro do culto  ->  análise da liturgia  ->  plano de slides  ->  +->  PowerPoint (.pptx) offline
                                                                    +->  apresentação web em tela cheia
                                                                    +->  console do operador + tela da congregação
```

As letras dos hinos são consultadas diretamente por número no banco de dados local. Os layouts visuais são editados no navegador por meio de um registro SQLite. Uma vez baixado o arquivo PowerPoint, a projeção não requer nenhuma conexão com a Internet, garantindo um culto sem imprevistos mesmo em caso de falha de rede no templo.

## Recursos Principais

- **Importação rápida de roteiros:** Cole o texto do culto no formulário web. Linhas não reconhecidas são exibidas com total transparência. (A recepção por webhook estará disponível em uma versão futura.)
- **Divisão automática de estrofes e repetição de refrão:** Hinos chamados pelo número são automaticamente divididos em título, estrofes e refrãos repetidos para facilitar o canto congregacional.
- **Layouts de slides editáveis:** Gerencie layouts em um registro SQLite com editor em tela no navegador. Mova e redimensione elementos, adicione caixas de texto ou importe layouts do PowerPoint. Um conjunto opcional de 38 layouts de demonstração está disponível para testes.
- **Um único layout para quatro saídas:** Uma estrutura única de dados abastece o arquivo PPTX, apresentação web, tela da congregação e pré-visualização em tempo real na proporção 16:9 widescreen nativa.
- **Modo apresentador em duas telas:** Slide atual e próximo, miniaturas em película, lista do culto, grade de salto rápido e janela independente para a tela da congregação.
- **Função tela preta (Blank Screen):** Escureça instantaneamente a tela da congregação e retorne sem perder o ponto de avanço (`B`).
- **Transições suaves configuráveis:** Corte, esmaecimento, dissolução e empurrão aplicados de forma idêntica na web e no PowerPoint.
- **Consulta rápida de passagens bíblicas:** Projete versículos bíblicos (KJV) durante a mensagem e limpe a tela após a leitura.
- **Mural de avisos da igreja:** Gerencie cartazes e anúncios locais a partir de arquivos locais ou endereços autorizados.
- **Tipografia offline:** 35 famílias de fontes locais empacotadas, com suporte ao padrão ECMA-376 para embutimento de fontes no PowerPoint.
- **Gestão de contas e permissões:** Perfis separados de administrador e operador, bloqueio por limite de tentativas e sessões revogáveis.
- **Layout de formulário e análise dinâmicos:** Configure campos predefinidos com regras regex personalizadas e organize agrupamentos de formulário diretamente no painel de administração.
- **Biblioteca de mídia:** Um conjunto reutilizável de imagens de fundo e cartazes, independente de qualquer layout específico.
- **Sincronização manual entre dispositivos (experimental):** Envie e receba Cultos, entradas do Song Set, fundos e avisos entre duas instâncias do WorshipDeck na mesma rede local, sob demanda. Sem nuvem, sem sincronização em segundo plano. Verificado em uma única máquina; a sincronização entre máquinas reais continua experimental.

## Requisitos de Sistema

- **Instalação em Servidor (Recomendado):** Linux (testado no Ubuntu), Windows 10/11 ou ambiente POSIX com Go 1.24+ e Node.js 22.12+. Desenvolvido com React 19. Utiliza SQLite integrado sem necessidade de configurar servidores de banco de dados externos.
- **Aplicativo Desktop Windows (Experimental):** Windows 10/11 de 64 bits.
- **macOS:** Não testado oficialmente.

## Instalação

### Servidor Local Autônomo (Recomendado)

Executar o WorshipDeck como um servidor local autônomo é o modelo de implantação principal e recomendado:

```bash
git clone https://github.com/wiradeltaid/worship-deck.git
cd worship-deck
npm install
npm run setup
npm run dev
```

`npm run setup` gera o arquivo `.env` com novas credenciais, inicializa o banco de dados SQLite e exibe a senha gerada para a conta `admin`. `npm run dev` inicia a API em Go em <http://localhost:3000> e o frontend React SPA em <http://localhost:5173>. Faça login como `admin`. Para implantação em produção em porta única, execute `npm run spa:build && npm start` e acerte a porta 3000.

Consulte [`.constitution/project/private-data.md`](.constitution/project/private-data.md) antes de inserir dados da sua congregação.

### Instalador Desktop para Windows (Experimental)

Baixe `WorshipDeck-0.1.0-x64-setup.exe` e `SHA256SUMS` na [página oficial de lançamentos](https://github.com/wiradeltaid/worship-deck/releases) e execute o assistente de instalação.

Verifique o arquivo antes de executar: compare o hash SHA-256 calculado com o registrado em `SHA256SUMS`.

> **Nota sobre o Windows SmartScreen:** Como esta versão ainda não possui um certificado comercial de assinatura, o Windows SmartScreen pode exibir um aviso. Clique em **Mais informações** e depois em **Executar assim mesmo**.

### Criar um Culto

Acesse **Services -> New**. Cole o roteiro na caixa de texto. O formato esperado é:

```text
SABBATH, MARCH 14, 2026

BIBLE TALK (09.30-10.50 / 80 min)
>> welcome remarks: Mrs. Lestari
Song Leader : Ms. Ayu
[  ] Opening song : SDAH #159 The Old Rugged Cross
Memory Verse & Opening Prayer : Mr. Bagas
Closing Prayer : Mr. Damar (1m)

DIVINE SERVICE (10.50-12.05 / 75 min)
Song Leader : Ms. Kirana
[  ] Opening Song : SDAH #83 O Worship the King
Intercessory Prayer: Mr. Farid (5m)
Sermon : Pr. Andi Hartono "Working Out" (45m)
[  ] Closing Song : SDAH #249 Praise Him! Praise Him!
```

Clique em **Baca susunan acara** (ou **Parse** em inglês). Papéis, horários e números dos hinos são preenchidos no formulário, e os hinos são identificados no banco local. Linhas não reconhecidas são listadas para conferência.

Adicione o cartaz do sermão e fotos, depois salve o culto.

### Apresentação

Na página do culto:

- **Baixar PPTX:** Apresentação PowerPoint para uso offline que garante o culto caso haja falha de rede ou equipamento.
- **Apresentar:** Console do operador com prévia do slide atual e próximo, miniaturas e salto rápido.
- **Abrir tela da congregação:** Janela independente para arrastar ao segundo monitor da igreja. Tecla `B` para tela preta.

### Recursos Adicionais

**Consulta bíblica:** Exiba versículos da Bíblia KJV na tela da congregação a partir de `data/en/bible-translation/kjv.json`.

**Entrada por mensagens:** A recepção de roteiros via webhook estará disponível em versão futura.

### Solução de Problemas

**`Missing song book corpus`:** O arquivo `data/song-book/sdah.json` está ausente. Restaure-o pelo Git: `git checkout -- data/song-book/sdah.json` e execute `npm run corpus:verify`.

**Bloqueio de acesso:** Execute `npm run auth:set-password -- admin` para redefinir a senha. Execute `npm run auth:unlock -- --list` para desbloquear tentativas de login.

**Imagens ausentes:** Imagens remotas devem respeitar as regras de segurança de URL. O envio direto para o servidor sempre funciona.

## Personalização

A instalação padrão começa com um registro limpo pronto para os seus próprios projetos:

1. **Layouts de slides:** Acesse `/admin/artifacts` como administrador. Os layouts podem ser criados no editor de tela ou importados do PowerPoint. É possível carregar 38 layouts de demonstração com `npm run seed:demo`.
2. **Registro privado:** Para manter os dados da sua igreja fora do Git, salve em `data/local/default-registry.json`. O caminho é ignorado pelo Git. Veja [`.constitution/project/private-data.md`](.constitution/project/private-data.md).

## Coleções de Textos Incluídas

Duas coleções de textos verificadas acompanham o projeto:

| Arquivo | Conteúdo | Ao Iniciar |
| --- | --- | --- |
| `data/song-book/sdah.json` | 695 hinos do Seventh-day Adventist Hymnal | títulos e letras lidos do arquivo |
| `data/en/bible-translation/kjv.json` | 66 livros, 1189 capítulos, 31102 versículos KJV | sincronizados do arquivo local (~130 a 150 ms) |

Execute `npm run corpus:verify` para validar a integridade dos dados.

Consulte [ATTRIBUTIONS.md](ATTRIBUTIONS.md) para detalhes de direitos autorais e contatos de remoção.

## Implantação em Servidor

Compile a API Go e o SPA, e execute `./api` (ou `npm start`) em um servidor com Node 22 configurado no `PATH`. Veja [`.constitution/project/deployment.md`](.constitution/project/deployment.md).

## Histórico do Projeto e Privacidade

Este projeto iniciou como repositório privado para uma igreja local. O histórico público foi recriado a partir de dados sintéticos de demonstração (*Harborlight Adventist Fellowship*) para proteger a privacidade dos membros.

Colaboradores devem ler [`.constitution/project/private-data.md`](.constitution/project/private-data.md) antes de enviar alterações.

## Licença e Marcas

- **Licença do Código:** Distribuído sob a [Licença MIT](LICENSE).
- **Atribuições e Coleções:** Hinários, traduções bíblicas e bibliotecas de terceiros estão listados em [ATTRIBUTIONS.md](ATTRIBUTIONS.md).
- **Fontes de Terceiros:** Avisos de direitos autorais e licenças completas SIL OFL 1.1 e Apache 2.0 para 35 famílias de fontes constam em [THIRD-PARTY-NOTICES](THIRD-PARTY-NOTICES).
- **Privacidade e Segurança:** 100% offline-first. Os dados permanecem no seu computador; zero telemetria e zero coleta analítica (veja [PRIVACY.md](PRIVACY.md) e [SECURITY.md](SECURITY.md)).
- **Nome e Logotipo:** A licença MIT abrange o código-fonte, mas não confere direitos de marca. Os nomes **WorshipDeck** e **Wira Delta Indonesia**, bem como o logotipo do produto, são de propriedade exclusiva da PT Wira Delta Indonesia.
