# WorshipDeck

> 예배 순서지를 즉시 프레젠테이션 슬라이드로 변환하는 로컬 우선 교회 예배 프레젠테이션 및 스테이징 스위트: 폰트가 임베딩된 오프라인 PowerPoint (.pptx), 듀얼스크린 회중용 화면 콘솔, 로컬 Wi-Fi 스마트폰 리모컨 완비.

[English](README.md) | [Bahasa Indonesia](README.id.md) | [简体中文](README.zh-CN.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md) | [Deutsch](README.de.md) | [Français](README.fr.md) | [Português (Brasil)](README.pt-BR.md) | [Русский](README.ru.md)  
[Website](https://wiradelta.com/worship-deck) | [Download for Windows](https://github.com/wiradeltaid/worship-deck/releases) | [Changelog](CHANGELOG.md) | [Contributing](CONTRIBUTING.md) | [License](LICENSE) | [Security](SECURITY.md) | [Privacy](PRIVACY.md) | [Attributions](ATTRIBUTIONS.md)

---

> **번역 안내:** 본 문서는 편의를 위해 [README.md](README.md)를 번역한 참고용 문서입니다. 내용상 상충이나 해석의 차이가 있을 경우 영문 공식 문서(`README.md`)가 우선합니다. 세부 기술 문서 및 법적 문서는 영어로 관리됩니다.

교회 예배 환경을 위해 설계되었으며, 슬라이드 레이아웃이 하드코딩이 아닌 데이터로 관리되므로 유사한 예배 순서를 운영하는 모든 교회에서 브라우저를 통해 손쉽게 맞춤 조정할 수 있습니다.

## 해결하는 과제

매주 예배 슬라이드를 수작업으로 준비하는 데는 2시간에서 4시간이 소요되며, 대부분의 시간은 이미 입력해 둔 찬송가 가사를 다시 타이핑하는 데 낭비됩니다. 예배 직전 찬양이 변경되면 슬라이드를 처음부터 다시 제작해야 하며, 프로그램 설정 노하우도 특정 봉사자 1인에게 의존하기 쉽습니다.

WorshipDeck은 예배 기획자가 작성한 순서지 텍스트를 메시지나 폼에서 입력받아 깔끔하고 정돈된 예배 슬라이드를 자동으로 생성합니다.

```text
순서지 텍스트  ->  예배 순서 자동 분석  ->  슬라이드 계획 생성  ->  +->  오프라인 PowerPoint (.pptx)
                                                                +->  전체화면 웹 슬라이드쇼
                                                                +->  운영자 콘솔 + 회중용 화면
```

찬송가 가사는 번호 조회를 통해 로컬 데이터베이스에서 즉시 인덱싱됩니다. 슬라이드 레이아웃은 관리자가 브라우저에서 SQLite 레지스트리를 통해 직접 편집할 수 있습니다. PowerPoint 파일이 다운로드된 후에는 인터넷 연결이 전혀 필요하지 않으므로 교회의 네트워크에 장애가 발생해도 예배가 원활하게 진행됩니다.

## 주요 기능

- **순서지 자동 파싱:** 웹 폼 붙여넣기를 지원합니다. 인식되지 않은 항목은 누락 없이 투명하게 안내합니다. (웹훅 연동 기능은 향후 릴리스에서 제공될 예정입니다.)
- **찬송가 자동 분할 및 후렴구 반복:** 찬송가 번호가 지정되면 제목, 각 절, 반복되는 후렴구로 최적 분할되어 회중이 편안하게 찬양할 수 있습니다.
- **편집 가능한 슬라이드 레이아웃:** 브라우저 캔버스 에디터로 SQLite 레지스트리의 레이아웃을 관리합니다. 요소를 이동하고 스타일을 지정하거나 PowerPoint에서 레이아웃을 가져올 수 있습니다. 데모 시드를 통해 38개의 예제 레이아웃을 체험할 수 있습니다.
- **하나의 레이아웃으로 4가지 출력:** 단일 슬라이드 데이터가 파워포인트, 웹 슬라이드쇼, 회중용 화면, 실시간 미리보기를 네이티브 16:9 와이드 화면으로 구동합니다.
- **듀얼스크린 발표자 모드:** 현재/다음 슬라이드 미리보기, 필름스트립, 전체 순서지 목록, 원하는 슬라이드로 즉시 이동 가능한 그리드, 회중용 화면 전용 독립 창을 지원합니다.
- **블랙아웃 화면 기능 (Blank Screen):** 슬라이드 진행 위치를 잃지 않고 회중용 화면을 즉시 검게 암전하거나 복원할 수 있습니다 (단축키 `B`).
- **다양한 화면 전환 효과:** 컷, 페이드, 디졸브, 푸시 효과가 웹과 파워포인트 양쪽에서 동일하게 적용됩니다.
- **성경 구절 즉시 검색:** 예배 진행 중에도 성경 구절(KJV)을 회중용 화면에 즉시 띄우고 지울 수 있습니다.
- **교회 공지 포스터 관리:** 주보 공지사항 포스터를 로컬 업로드 또는 허용된 URL을 통해 관리합니다.
- **오프라인 폰트 및 맞춤 서체:** 41개 패키지 번들 폰트를 내장하여 오프라인에서 즉시 사용 가능하며, ECMA-376 규격에 맞춘 커스텀 폰트 임베딩을 지원합니다.
- **관리자/운영자 역할 분리:** 계정 분리, 로그인 시도 제한, 즉시 폐기 가능한 보안 세션을 제공합니다.
- **동적 폼 레이아웃 및 파싱 구성:** 관리 패널에서 사전 정의 필드와 커스텀 정규식 규칙을 구성하여 코드 변경 없이 서비스 입력 폼을 편집할 수 있습니다.
- **미디어 라이브러리:** 특정 레이아웃에 종속되지 않는 재사용 가능한 배경 및 포스터 이미지 풀을 제공합니다.
- **수동 기기 간 동기화 (실험적 기능):** 같은 로컬 네트워크에 있는 두 WorshipDeck 인스턴스 간에 서비스, 찬양 세트, 배경, 공지사항을 수동 요청 시 직접 동기화합니다. 클라우드 없음, 백그라운드 동기화 없음. 단일 호스트에서 검증되었으며 다중 기기 동기화는 실험적 단계입니다.

## 시스템 요구사항

- **서버 설치 (권장):** Linux (Ubuntu 검증 완료), Windows 10/11 또는 POSIX 환경 (Go 1.24+, Node.js 22.12+, React 19). 내장 SQLite를 사용하므로 별도의 외부 데이터베이스 서버가 필요하지 않습니다.
- **Windows 데스크톱 앱 (실험적):** Windows 10/11 64비트.
- **macOS:** 공식 테스트 미실시.

## 설치 안내

### 자체 호스팅 서버 설치 (권장)

WorshipDeck을 로컬 서버로 직접 호스팅하여 사용하는 방식이 기본 권장 배포 모델입니다:

```bash
git clone https://github.com/wiradeltaid/worship-deck.git
cd worship-deck
npm install
npm run setup
npm run dev
```

`npm run setup`은 새로운 시크릿이 포함된 `.env` 파일을 생성하고, SQLite 데이터베이스를 초기화하며, 생성된 `admin` 비밀번호를 출력합니다. `npm run dev`는 Go API 서버를 <http://localhost:3000>에서, React SPA를 <http://localhost:5173>에서 실행합니다. 브라우저에서 `admin`으로 로그인하십시오. 단일 포트 프로덕션 서빙의 경우 `npm run spa:build && npm start`를 실행하고 3000번 포트를 엽니다.

실제 교회 데이터를 입력하기 전에 [`.constitution/project/private-data.md`](.constitution/project/private-data.md)를 확인하십시오.

### Windows 데스크톱 설치 프로그램 (실험적)

공식 [GitHub Releases 페이지](https://github.com/wiradeltaid/worship-deck/releases)에서 `WorshipDeck-0.1.0-x64-setup.exe`와 `SHA256SUMS`를 다운로드하여 설치 마법사를 실행하십시오.

실행 전 다운로드한 파일의 SHA-256 해시를 `SHA256SUMS` 파일과 비교하여 무결성을 확인하십시오.

> **Windows SmartScreen 안내:** 상용 인증서 서명이 아직 적용되지 않아 경고 창이 나타날 수 있습니다. **추가 정보**를 클릭한 후 **실행**을 누르면 정상 진행됩니다.

### 새 예배 만들기

**Services -> New** 메뉴로 이동합니다. 텍스트 상자에 순서지 내용을 붙여넣습니다:

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

**Baca susunan acara** (또는 영문 환경에서는 **Parse**) 버튼을 클릭합니다. 역할, 시간, 찬송가 번호가 폼에 자동 입력되고, 가사가 로컬 데이터베이스에서 조회됩니다.

설교 포스터와 사진을 등록한 뒤 예배를 저장합니다.

### 슬라이드 진행하기

예배 관리 페이지에서:

- **PPTX 다운로드:** 네트워크나 장비 장애 시 즉시 대체할 수 있는 오프라인 프레젠테이션 파일.
- **발표자 콘솔 열기:** 현재/다음 슬라이드 미리보기, 필름스트립, 전체 슬라이드 점프 기능 제공.
- **회중용 화면 열기:** 보조 모니터 또는 프로젝터 디스플레이로 이동시킬 독립 화면 창. `B` 키로 화면 암전 가능.

### 추가 옵션

**성경 검색:** KJV 성경 본문을 회중용 화면에 직접 표시할 수 있습니다. 성경 데이터는 `data/en/bible-translation/kjv.json`에 포함되어 있습니다.

**메신저 자동 입력:** 웹훅을 통한 순서지 자동 수신 기능은 향후 릴리스에서 제공될 예정입니다.

### 문제 해결

**`Missing song book corpus`:** `data/song-book/sdah.json` 파일이 없습니다. Git에서 복구하십시오: `git checkout -- data/song-book/sdah.json` 실행 후 `npm run corpus:verify`를 실행합니다.

**관리자 비밀번호 분실:** `npm run auth:set-password -- admin`을 실행하여 새 비밀번호를 설정하십시오. `npm run auth:unlock -- --list`로 잠긴 로그인을 해제할 수 있습니다.

**이미지가 표시되지 않음:** 외부 이미지는 URL 안전 규칙을 통과해야 합니다. 로컬 서버에 직접 이미지를 업로드하면 안전하게 표시됩니다.

## 교회 맞춤 설정

기본 설치 환경은 사용자가 자유롭게 디자인할 수 있도록 깨끗한 레지스트리로 시작합니다:

1. **슬라이드 레이아웃:** 관리자로 로그인하여 `/admin/artifacts`로 이동합니다. 캔버스 에디터에서 직접 제작하거나 PowerPoint에서 가져올 수 있습니다. `npm run seed:demo`를 실행하여 38개의 예제 레이아웃을 등록할 수 있습니다.
2. **비공개 레지스트리:** 교회 데이터를 Git 외부에서 안전하게 유지하려면 `data/local/default-registry.json`에 배치하십시오. 이 경로는 Git에서 무시됩니다. [`.constitution/project/private-data.md`](.constitution/project/private-data.md)를 확인하십시오.

## 기본 제공 텍스트 코퍼스

두 가지 공인 코퍼스가 기본 제공됩니다:

| 파일 | 내용 | 시작 시 동작 |
| --- | --- | --- |
| `data/song-book/sdah.json` | 제칠일안식일예수재림교 찬송가 695곡 | 제목 및 가사를 파일에서 로드 |
| `data/en/bible-translation/kjv.json` | 66권, 1189장, 31102절 KJV 성경 | 시작 시 로컬 동기화 (~130에서 150ms) |

`npm run corpus:verify`로 파일 무결성을 점검할 수 있습니다.

저작권 및 삭제 요청에 대한 사항은 [ATTRIBUTIONS.md](ATTRIBUTIONS.md)를 참조하십시오.

## 배포 가이드

Go API와 SPA를 빌드한 뒤, `PATH`에 Node 22가 등록된 호스트에서 `./api` (또는 `npm start`)를 실행하십시오. [`.constitution/project/deployment.md`](.constitution/project/deployment.md)를 확인하십시오.

## 프로젝트 역사 및 프라이버시

본 프로젝트는 개별 교회의 비공개 저장소에서 시작되었습니다. 성도들의 개인정보 보호를 위해 공개 저장소는 가상의 예제 데이터(*Harborlight Adventist Fellowship*)를 사용하여 새로 초기화되었습니다.

기여자는 커밋 전에 반드시 [`.constitution/project/private-data.md`](.constitution/project/private-data.md)를 검토해야 합니다.

## 라이선스 및 상표

- **코드 라이선스:** [MIT License](LICENSE)에 따라 배포됩니다.
- **찬송가 코퍼스 및 감사:** 찬송가, 성경 번역본 및 서드파티 크레딧은 [ATTRIBUTIONS.md](ATTRIBUTIONS.md)에 상세히 기재되어 있습니다.
- **서드파티 폰트 고지:** 41개 폰트 패밀리의 저작권 및 SIL OFL 1.1, Apache 2.0 라이선스 전문은 [THIRD-PARTY-NOTICES](THIRD-PARTY-NOTICES)에 수록되어 있습니다.
- **개인정보 및 보안:** 100% 오프라인 우선. 외부 분석 및 원격 측정 데이터 전송이 일체 없습니다 ([PRIVACY.md](PRIVACY.md) 및 [SECURITY.md](SECURITY.md) 참조).
- **상표권 고지:** MIT 라이선스는 소스코드에만 적용되며, **WorshipDeck**, **Wira Delta Indonesia** 명칭 및 제품 로고의 권리는 PT Wira Delta Indonesia에 독점적으로 귀속됩니다.
