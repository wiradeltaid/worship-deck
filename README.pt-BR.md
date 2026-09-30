# WorshipDeck

> Suíte local-first de apresentação e operação de culto para igrejas que transforma a ordem do culto em slides prontos para exibição: gera apresentações PowerPoint (.pptx) com fontes embutidas para uso offline, console de operador para a tela da congregação e controle remoto via smartphone por Wi-Fi local.

[English](README.md) | [Bahasa Indonesia](README.id.md) | [简体中文](README.zh-CN.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md) | [Deutsch](README.de.md) | [Français](README.fr.md) | [Português (Brasil)](README.pt-BR.md) | [Русский](README.ru.md)  
[Website](https://wiradelta.com/worship-deck) | [Baixar v0.1.0](https://github.com/wiradeltaid/worship-deck/releases/download/v0.1.0/WorshipDeck-0.1.0-x64-setup.exe) | [SHA256SUMS](https://github.com/wiradeltaid/worship-deck/releases/download/v0.1.0/SHA256SUMS) | [Todos os Lançamentos](https://github.com/wiradeltaid/worship-deck/releases) | [Changelog](CHANGELOG.md) | [Contributing](CONTRIBUTING.md) | [License](LICENSE) | [Security](SECURITY.md) | [Privacy](PRIVACY.md) | [Attributions](ATTRIBUTIONS.md)

---

Desenvolvido para congregações cristãs e cultos litúrgicos. Os layouts de slides são gerenciados como dados configuráveis em vez de código estático, permitindo adaptações diretamente pelo navegador.

## Problema que Resolve

Preparar manualmente os slides de cada culto consome horas semanais, grande parte gasta digitando novamente letras de hinos já cadastradas. Mudanças de última hora exigem refazer a apresentação do zero.

O WorshipDeck lê o roteiro do culto e monta automaticamente slides limpos e consistentes:

```text
roteiro do culto  ->  análise da liturgia  ->  plano de slides  ->  +->  PowerPoint (.pptx) offline
                                                                    +->  console do operador + tela da congregação
```

As letras dos hinos são consultadas por número no banco de dados local. Os layouts visuais são editados no navegador por meio do SQLite. Uma vez baixado o arquivo, a projeção não requer conexão com a Internet.

## Instalação

### Servidor Local Autônomo (Recomendado)

Executar o WorshipDeck como um servidor local autônomo é o modelo de implantação principal e recomendado:

```bash
git clone https://github.com/wiradeltaid/worship-deck.git
cd worship-deck && npm install && npm run setup && npm run dev
```

`npm run setup` gera o arquivo `.env` com chaves seguras e inicializa o SQLite. `npm run dev` inicia a API Go em `http://localhost:3000` e a SPA Vite em `http://localhost:5173`. Consulte [docs/deployment.md](docs/deployment.md) para implantação em produção.

### Aplicativo Desktop Windows (Experimental)

Baixe o assistente de instalação autônomo para computadores de igreja individuais:

- **Download Direto:** [WorshipDeck-0.1.0-x64-setup.exe](https://github.com/wiradeltaid/worship-deck/releases/download/v0.1.0/WorshipDeck-0.1.0-x64-setup.exe)
- **Hash de Verificação:** [SHA256SUMS](https://github.com/wiradeltaid/worship-deck/releases/download/v0.1.0/SHA256SUMS) | [Todos os Lançamentos](https://github.com/wiradeltaid/worship-deck/releases)

> **Nota sobre o Windows SmartScreen:** Como esta versão ainda não possui assinatura de código com certificado EV comercial, o Windows SmartScreen pode exibir um aviso. Clique em **Mais informações** (More info) e depois em **Executar assim mesmo** (Run anyway).

## Recursos Principais

- **Importação rápida de roteiros:** Cole o texto no formulário web; linhas não reconhecidas são exibidas com total transparência.
- **Divisão automática de estrofes e refrão:** Hinos chamados pelo número são automaticamente divididos em título, estrofes e refrãos.
- **Layouts de slides editáveis:** Gerencie layouts no SQLite com editor em tela no navegador ou importe do PowerPoint.
- **Modo apresentador em duas telas:** Console do operador, tela da congregação independente, tela preta (`B`) e controle por celular.
- **Exportação PowerPoint 16:9:** Apresentações `.pptx` independentes com fontes embutidas para projeção offline real.
- **Consulta bíblica imediata:** Projete versículos bíblicos (KJV) durante o culto e limpe a tela após a leitura.
- **Tipografia offline:** 41 famílias de fontes locais empacotadas e suporte para importar fontes personalizadas.
- **Sincronização manual (experimental):** Transfira dados entre duas instâncias na mesma rede local sob demanda.

## Documentação

- **[Getting Started](docs/getting-started.md):** Guia de instalação em servidor e aplicativo desktop.
- **[Features and Workflows](docs/features.md):** Manual completo de recursos e guia de uso.
- **[Configuration and Administration](docs/configuration.md):** Configuração de campos dinâmicos e banco de dados.
- **[Customization and Slide Layouts](docs/customization.md):** Edição em tela, importação PPTX e dados de exemplo.
- **[Shipped Corpora](docs/corpora.md):** Especificações dos acervos SDAH e KJV e hinários adicionais.
- **[Production Deployment](docs/deployment.md):** Serviço permanente com systemd e proxy reverso.
- **[Project History](docs/history.md):** Origem do projeto, linhagem pública e garantias de privacidade.

## Requisitos de Sistema

- **Servidor (Recomendado):** Linux (Ubuntu), Windows 10/11 ou POSIX com Go 1.24+ e Node.js 22.12+. Desenvolvido em React 19 e SQLite integrado.
- **Desktop Windows (Experimental):** Windows 10/11 de 64 bits.

## Licença e Marcas

- **Licença do Código:** Distribuído sob a [Licença MIT](LICENSE).
- **Atribuições:** Os avisos de direitos autorais de fontes, hinos e textos bíblicos estão detalhados em [ATTRIBUTIONS.md](ATTRIBUTIONS.md).
