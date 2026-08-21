# Upstage Studio 100% 활용 가이드

트랙 C(Document Agent Service) 용 정리. 출처는 Upstage 가 직접 배포한
[upstage-extensions-hub](https://github.com/UpstageAI/upstage-extensions-hub) 의
`skills/upstage-studio/` 레퍼런스다.

## 먼저 — 스킬부터 설치한다

```
/plugin marketplace add UpstageAI/upstage-extensions-hub
```

`upstage-studio` · `upstage-schema-generation` · `upstage-document-classification` ·
`upstage-builder` 가 들어온다.

## 리소스 계층

```
Agent (실행 단위, agt_xxx)
 └─ Config (워크플로 정의: Step DAG + 조건부 분기, cfg_xxx)
     └─ Job (실행 인스턴스, job_xxx)
         ├─ File (입력 문서, file_xxx)
         └─ Results (스텝별 출력)
```

기본 흐름: `POST /v2/files` → `POST /v2/agents` → `POST /v2/agents/{id}/configs`
→ `POST /v2/responses` → `GET /v2/responses/{id}`

## Level 1 — 다들 여기서 끝낸다

`Parse → Extract` 일자 파이프라인. **Studio 를 30% 쓰는 것이다.**

## Level 2 — Config 는 선형이 아니라 조건부 분기 DAG

`next_steps` 로 classify 결과에 따라 다른 extract 스키마로 라우팅한다.

```
document-classify ─┬─ "근로계약서"  → extract(계약 스키마)
                   ├─ "급여명세서"  → extract(명세 스키마)
                   └─ "영수증"      → extract(영수증 스키마)
                                        ↓
                                     instruct(대조·판정)
```

클래스 표가 그대로 `oneOf` 스키마가 된다. **`description` 에 경계 사례 판정 규칙을
넣는 게 포인트다** — 스펙이 명시적으로 권장한다.

| 필드                  | 필수 | 비고                         |
| --------------------- | ---- | ---------------------------- |
| `schema.type`         | ✅   | 반드시 `"string"`            |
| `schema.oneOf`        | ✅   | 비어있지 않은 카테고리 배열  |
| `oneOf[].const`       | ✅   | 라벨. 중복은 무시됨          |
| `oneOf[].description` | ✅   | 1–2문장. 경계 판정 규칙 포함 |

## Level 3 — `split: true` ⭐ 아는 팀 거의 없다

`document-classify` 에 `split: true` 를 주면 **한 파일 안의 페이지를 분류 결과별
그룹으로 쪼개, 각 그룹을 독립적으로 다음 스텝에 흘린다.**

영수증 30장 스캔 PDF 한 개, 서류 묶음 통째 업로드가 이걸로 풀린다.

## Level 4 — Preset Agent 로 자기개선 루프

| 이름              | 하는 일                                                |
| ----------------- | ------------------------------------------------------ |
| `class-generate`  | 문서를 보고 분류 클래스 자동 생성                      |
| `schema-generate` | 문서를 보고 추출 스키마 자동 생성                      |
| `schema-update`   | 추출 결과를 보고 스키마 개선 (`use_aso_updater: true`) |

`schema-update` 는 **여러 문서 결과를 집계해 한 번 실행**된다.

```
새 공고문 100건 → class-generate → schema-generate → extract → schema-update → 다음 배치
```

## Level 5 — `confidence` + `location`

- `confidence: high / medium / low` — 필드별
- `location` — 원문 좌표, `location_granularity: "all" | "element" | "word"`

**근거 하이라이트** UI 와 **low 필드만 사람에게 보내는 선택 검수** 가 여기서 나온다.

## Level 6 — 라이브러리 발행

```
PUT /v2/agents/{agent_id}/visibility
{ "visibility": "public", "published_config_id": "cfg_xxx" }
```

`copy_count` · `like_count` 가 집계되고 남이 clone 할 수 있다.

## 놓치기 쉬운 옵션

**`document-parse`** — `mode: "enhanced"` · `ocr: "force"`(도장·손글씨) ·
`merge_multipage_tables: true`(**여러 페이지 표 병합**) · `chart_recognition` ·
`coordinates` · `base64_encoding: ["table","figure","chart"]`

**`information-extract`** — `mode: "enhanced"` 는 비전 모드, **50페이지 제한**
(파일 자체는 1,000페이지까지)

## ⚠️ 스키마 제약 — 모르면 400

| 레벨              | 금지                                          |
| ----------------- | --------------------------------------------- |
| 1단계 properties  | **object 금지** → `array of object` 로 감싼다 |
| array items       | array 금지 (중첩 배열 불가)                   |
| object properties | object 금지                                   |

- property 이름 `_` 시작 금지 · **최대 깊이 3단계** (root → array → object → primitive)
- "공통 슬롯 + 클래스 고유 슬롯" 설계가 이 제약과 부딪힌다. 평평하게 펴거나 배열로 감싼다

## 실무 포인트

- **Config 는 immutable** — 버전 관리·감사 추적이 공짜
- **`include: ["all"]`** — 모든 중간 스텝 결과 (`["last"]` 는 최종만)
- **`expires_after`** — Job 만료(초). 민감 문서 자동 삭제
- `agt_` 에이전트는 **자동 `background: true`** → 폴링 필요
- base_url 은 반드시 **v2**

```python
import os, time
from openai import OpenAI

client = OpenAI(api_key=os.environ["UPSTAGE_API_KEY"], base_url="https://api.upstage.ai/v2")
file = client.files.create(file=open("document.pdf", "rb"), purpose="user_data")
job = client.responses.create(
    model="agt_xxx",
    input=[{"role": "user", "content": [{"type": "input_file", "file_id": file.id}]}],
    include=["all"],
)
while job.status in ("queued", "in_progress"):
    time.sleep(5)
    job = client.responses.retrieve(job.id, include=["all"])
client.files.delete(file.id)
```

| HTTP | type                      | 의미                                     |
| ---- | ------------------------- | ---------------------------------------- |
| 400  | `invalid_request_error`   | 필드 누락 · 타입 불일치 · 스텝 검증 실패 |
| 404  | `not_found_error`         | 없는 ID                                  |
| 409  | `file_status_error`       | 파일 처리 중인데 Job 생성                |
| 415  | `unsupported_file_format` | `.zip` 등                                |

## 적용 예 — 임금체불 산출기

```
1  files.create                    사진 3장 업로드
2  document-classify (split:true)  뭐가 뭔지 판별 + 섞여 있어도 분리
3  ├ 근로계약서 → extract(시급·소정근로시간·휴게)
   ├ 급여명세서 → extract(실지급액·공제·근무일수)
   └ 없는 종류  → instruct(뭐가 빠졌는지 안내)
4  코드에서 법정 계산               ← LLM 아님. 결정론적
5  instruct                        진정서 초안 생성
6  confidence low 필드만 사람 확인
7  location 좌표로 근거 하이라이트
```

**4번을 코드로 빼는 게 중요하다.** 최저임금·주휴수당은 계산이지 추론이 아니다.

## 관련 문서

데모 신청 사이트는 `src/app/demo/` 에 있다 — 공고를 읽고 신청까지 가는 흐름을
검증할 가상 사이트 5종. navbar 에 없고 `/demo` URL 로만 접근한다.
