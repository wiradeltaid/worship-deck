# WorshipDeck

> 예배 순서지를 즉시 프레젠테이션 슬라이드로 변환하는 로컬 우선 교회 예배 프레젠테이션 및 스테이징 스위트: 폰트가 임베딩된 오프라인 PowerPoint (.pptx), 듀얼스크린 회중용 화면 콘솔, 로컬 Wi-Fi 스마트폰 리모컨 완비.

[English](README.md) | [Bahasa Indonesia](README.id.md) | [简体中文](README.zh-CN.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md) | [Deutsch](README.de.md) | [Français](README.fr.md) | [Português (Brasil)](README.pt-BR.md) | [Русский](README.ru.md)  
[Website](https://wiradelta.com/worship-deck) | [다운로드 v0.1.0](https://github.com/wiradeltaid/worship-deck/releases/download/v0.1.0/WorshipDeck-0.1.0-x64-setup.exe) | [SHA256SUMS](https://github.com/wiradeltaid/worship-deck/releases/download/v0.1.0/SHA256SUMS) | [전체 릴리스](https://github.com/wiradeltaid/worship-deck/releases) | [Changelog](CHANGELOG.md) | [Contributing](CONTRIBUTING.md) | [License](LICENSE) | [Security](SECURITY.md) | [Privacy](PRIVACY.md) | [Attributions](ATTRIBUTIONS.md)

---

교회 예배 환경을 위해 설계되었으며, 슬라이드 레이아웃이 하드코딩이 아닌 데이터로 관리되므로 유사한 예배 순서를 운영하는 모든 교회에서 브라우저를 통해 손쉽게 맞춤 조정할 수 있습니다.

## 해결하는 과제

매주 예배 슬라이드를 수작업으로 준비하는 데는 많은 시간이 소요되며, 대부분의 시간은 이미 입력해 둔 찬송가 가사를 다시 타이핑하는 데 낭비됩니다. 직전 찬양 변경 시 슬라이드를 처음부터 다시 제작해야 합니다.

WorshipDeck은 예배 기획자가 작성한 순서지 텍스트를 입력받아 깔끔하고 정돈된 예배 슬라이드를 자동으로 생성합니다:

```text
순서지 텍스트  ->  예배 순서 자동 분석  ->  슬라이드 계획 생성  ->  +->  오프라인 PowerPoint (.pptx)
                                                                +->  운영자 콘솔 + 회중용 화면
```

찬송가 가사는 번호 조회를 통해 로컬 데이터베이스에서 즉시 인덱싱됩니다. 슬라이드 레이아웃은 관리자가 브라우저에서 SQLite 레지스트리를 통해 직접 편집할 수 있습니다. 파일 다운로드 후에는 인터넷 연결이 전혀 필요하지 않습니다.

## 설치 안내

### 자체 호스팅 서버 설치 (권장)

WorshipDeck을 로컬 서버로 직접 호스팅하여 사용하는 방식이 기본 권장 배포 모델입니다:

```bash
git clone https://github.com/wiradeltaid/worship-deck.git
cd worship-deck && npm install && npm run setup && npm run dev
```

`npm run setup` 실행 시 신규 보안 키가 포함된 `.env`가 생성되고 SQLite 데이터베이스가 초기화됩니다. `npm run dev` 명령으로 Go API (`http://localhost:3000`) 및 Vite SPA (`http://localhost:5173`)가 구동됩니다. 프로덕션 배포는 [docs/deployment.md](docs/deployment.md)를 참조하십시오.

### Windows 데스크톱 앱 (실험적)

단일 예배 컴퓨터 구동을 위한 독립형 설치 마법사:

- **직접 다운로드:** [WorshipDeck-0.1.0-x64-setup.exe](https://github.com/wiradeltaid/worship-deck/releases/download/v0.1.0/WorshipDeck-0.1.0-x64-setup.exe)
- **무결성 체크섬:** [SHA256SUMS](https://github.com/wiradeltaid/worship-deck/releases/download/v0.1.0/SHA256SUMS) | [전체 릴리스](https://github.com/wiradeltaid/worship-deck/releases)

> **Windows SmartScreen 안내:** 본 릴리스는 상용 EV 인증서 코드 서명이 적용되지 않아 SmartScreen 경고가 표시될 수 있습니다. **추가 정보**(More info)를 클릭한 후 **실행**(Run anyway)을 누르면 정상 설치됩니다.

## 주요 기능

- **순서지 자동 파싱:** 웹 폼 붙여넣기를 지원하며 인식되지 않은 항목은 누락 없이 투명하게 안내합니다.
- **찬송가 자동 분할 및 후렴구 반복:** 찬송가 번호 입력 시 제목, 각 절, 반복 후렴구로 최적 분할됩니다.
- **편집 가능한 슬라이드 레이아웃:** 브라우저 캔버스 에디터로 SQLite 레지스트리 레이아웃을 관리하거나 PowerPoint에서 가져옵니다.
- **듀얼스크린 발표자 모드:** 운영자 콘솔, 회중용 화면 전용 독립 창, 블랙아웃 화면 (`B`), 스마트폰 리모컨 지원.
- **16:9 와이드 PowerPoint 내보내기:** 폰트가 임베딩된 오프라인 `.pptx` 파일로 완벽한 오프라인 투사가 가능합니다.
- **성경 구절 즉시 검색:** 예배 중 성경 구절(KJV)을 회중용 화면에 즉시 띄우고 지울 수 있습니다.
- **오프라인 서체 관리:** 41개 패키지 번들 폰트를 내장하여 오프라인에서 즉시 사용 가능합니다.
- **수동 기기 간 동기화 (실험적):** 로컬 네트워크 내 두 WorshipDeck 인스턴스 간 수동 요청 시 직접 동기화합니다.

## 문서 색인

- **[Getting Started](docs/getting-started.md):** 서버 환경 설정 및 데스크톱 앱 설치 가이드.
- **[Features and Workflows](docs/features.md):** 전체 기능 안내 및 운영자 가이드.
- **[Configuration and Administration](docs/configuration.md):** 폼 필드 구성 및 데이터베이스 관리.
- **[Customization and Slide Layouts](docs/customization.md):** 캔버스 레이아웃 편집, PPTX 가져오기, 데모 시드.
- **[Shipped Corpora](docs/corpora.md):** 번들 SDAH 및 KJV 코퍼스 사양 및 추가 찬송가 안내.
- **[Production Deployment](docs/deployment.md):** 상시 systemd 데몬 등록 및 역방향 프록시 설정.
- **[Project History](docs/history.md):** 개발 배경, 공개 저장소 경계 및 개인정보 보호 보증.

## 시스템 요구사항

- **서버 설치 (권장):** Linux (Ubuntu), Windows 10/11 또는 POSIX 환경 (Go 1.24+, Node.js 22.12+, React 19). 내장 SQLite 사용.
- **Windows 데스크톱 앱 (실험적):** Windows 10/11 64비트.

## 라이선스 및 상표

- **코드 라이선스:** [MIT License](LICENSE)에 따라 배포됩니다.
- **서체 및 코퍼스 출처:** 서체, 성경 및 찬송가 코퍼스 권리 정보는 [ATTRIBUTIONS.md](ATTRIBUTIONS.md)에 상술되어 있습니다.
