# WorshipDeck

> Suíte local-first de apresentação e operação de culto para igrejas que transforma a ordem do culto em slides prontos para exibição — gera apresentações PowerPoint (.pptx) offline com fontes embutidas, console de operador para projetor de duas telas e controle remoto via smartphone por Wi-Fi local.

[English](README.md) | [Bahasa Indonesia](README.id.md) | [简体中文](README.zh-CN.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md) | [Deutsch](README.de.md) | [Français](README.fr.md) | [Português (Brasil)](README.pt-BR.md) | [Русский](README.ru.md)  
[Website](https://wiradelta.id/worship-deck) | [Download for Windows](https://github.com/wiradeltaid/worship-deck/releases) | [Changelog](CHANGELOG.md) | [Contributing](CONTRIBUTING.md) | [License](LICENSE) | [Security](SECURITY.md) | [Privacy](PRIVACY.md) | [Attributions](ATTRIBUTIONS.md)

---

> **Aviso de tradução:** Este arquivo é uma tradução de [README.md](README.md) fornecida apenas para fins de conveniência. Em caso de divergências ou conflitos de interpretação, a versão oficial em inglês (`README.md`) prevalece como fonte autoritativa. Toda a documentação técnica aprofundada e documentos jurídicos são mantidos em inglês.

Desenvolvido para congregações cristãs e cultos litúrgicos. Os modelos de slides são gerenciados como dados configuráveis em vez de código engessado, permitindo que qualquer igreja com uma liturgia semelhante faça adaptações diretamente pelo navegador.

## Problema que Resolve

Preparar manualmente os slides de cada culto consome de 2 a 4 horas por semana, grande parte gasta digitando novamente letras de hinos que já haviam sido cadastradas no passado. Mudanças de última hora nas músicas exigem refazer a apresentação do zero, e o conhecimento técnico frequentemente depende de um único voluntário.

O WorshipDeck lê o roteiro preparado pelos líderes (colado em formulário ou enviado via bot de mensagens) e monta automaticamente slides limpos e consistentes.

```text
roteiro do culto  →  análise da liturgia  →  plano de slides  →  ┬→  PowerPoint (.pptx) offline
                                                                 ├→  apresentação web em tela cheia
                                                                 └→  console do operador + projetor
```

As letras dos hinos são consultadas diretamente por número no banco de dados local. Os modelos visuais são editados no navegador por meio de um registro SQLite. Uma vez baixado o arquivo PowerPoint, a projeção não requer nenhuma conexão com a Internet, garantindo um culto sem imprevistos mesmo em caso de falha de rede no templo.

## Recursos Principais

- **Importação rápida de roteiros:** Cole o texto do culto ou envie via webhook com chave secreta. Linhas não reconhecidas são exibidas com total transparência.
- **Divisão automática de estrofes e repetição de refrão:** Hinos chamados pelo número são automaticamente divididos em título, estrofes e refrãos repetidos para facilitar o canto congregacional.
- **Editor visual de modelos (WYSIWYG):** 28 modelos nativos editáveis diretamente na tela: arraste, redimensione, personalize tipografias e adicione elementos gráficos.
- **Um único layout para quatro saídas (16:9 widescreen):** Uma estrutura única de dados abastece o arquivo PPTX, apresentação web, janela do projetor e pré-visualização em tempo real na proporção exata de 1:1.
- **Modo apresentador em duas telas:** Slide atual e próximo, miniaturas em película, lista do culto e janela independente para arrastar ao projetor da igreja.
- **Função tela preta (Blank Screen):** Escureça instantaneamente a projeção da igreja e retorne sem perder o ponto de avanço (`B`).
- **Transições suaves configuráveis:** Corte, esmaecimento, dissolução e empurrão aplicados de forma idêntica na web e no PowerPoint.
- **Consulta rápida de passagens bíblicas:** Projete versículos bíblicos (KJV) durante a mensagem e limpe a tela após a leitura.
- **Mural de avisos da igreja:** Gerencie cartazes e anúncios locais a partir de arquivos locais ou endereços autorizados.
- **Embutimento de fontes personalizadas:** Padrão ECMA-376 para renderização perfeita em qualquer computador com Microsoft PowerPoint.
- **Gestão de contas e permissões:** Perfis separados de administrador e operador, bloqueio por limite de tentativas contra força bruta.

## Requisitos de Sistema

- **Aplicativo Desktop:** Windows 10/11 de 64 bits.
- **Compilação do Código-Fonte:** Go 1.24+ e Node.js 22+. Utiliza SQLite integrado sem necessidade de configurar servidores de banco de dados externos.

## Instalação

### Instalador Desktop para Windows (Recomendado)

Baixe `WorshipDeckSetup.exe` na [página oficial de lançamentos](https://github.com/wiradeltaid/worship-deck/releases) e execute o assistente de instalação.

> **Nota sobre o Windows SmartScreen:** Como este binário ainda não possui um certificado de assinatura EV comercial de alto custo, o Windows SmartScreen pode exibir um aviso. Clique em **"Mais informações"** e depois em **"Executar assim mesmo"**.

### Execução a partir do Código-Fonte

```bash
git clone https://github.com/wiradeltaid/worship-deck.git
cd worship-deck
npm install
npm run setup
npm run dev
```

O comando `npm run setup` gera o arquivo `.env`, inicializa o banco SQLite, cadastra os modelos de slides padrão e imprime a senha inicial do administrador.

---

## Licença e Notificação de Marca

- **Licença do Código:** Distribuído sob a [Licença MIT](LICENSE).
- **Hinários e Direitos de Terceiros:** Hinários, traduções bíblicas e componentes de terceiros estão detalhados em [ATTRIBUTIONS.md](ATTRIBUTIONS.md).
- **Privacidade e Segurança:** 100% local-first. Os dados da igreja ficam armazenados exclusivamente no seu computador local; zero telemetria (consulte [PRIVACY.md](PRIVACY.md) e [SECURITY.md](SECURITY.md)).
- **Nome e Marca Registrada:** A licença MIT concede direitos sobre o código-fonte, não sobre nomes ou logotipos. Os nomes **WorshipDeck** e **Wira Delta Indonesia**, bem como o ícone do produto, permanecem como propriedade da PT Wira Delta Indonesia.
