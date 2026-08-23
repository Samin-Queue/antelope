# Upstage Studio 에이전트 세팅 가이드

브라우저를 조작하는 에이전트를 위한 지시서다. 사람이 읽어도 그대로 따라 할 수 있다.

## 목표

Upstage Studio 에서 문서 처리 에이전트 하나를 구성하고 **저장**한다.
저장까지 끝나야 API 로 호출할 수 있다.

- Studio: https://studio.upstage.ai
- 대상 에이전트: `UPSTAGE_AGENT_ID` 가 가리키는 것 (`pnpm studio:provision` 이 만든다)
  - 직접 열기: `https://studio.upstage.ai/agents/<UPSTAGE_AGENT_ID>`
  - 이 에이전트를 못 찾으면 새로 만들고 **새 Agent ID 를 결과로 보고**한다.
- 계정: `UPSTAGE_STUDIO_API_KEY` 소유 계정 (로그인은 사람이 미리 해 둔다)

## 왜 필요한가

지금은 `404 No default config found for agent` 가 난다. 에이전트 껍데기만 있고
노드 구성이 저장되지 않았기 때문이다. 파일 업로드(`POST /v2/files`)까지는 통과한다.

---

## 구성할 파이프라인

```
Parse ──▶ Classify ──▶ Extract ──▶ Instruct
```

### 1. Parse

기본값 그대로 둔다. 별도 설정 없음.

### 2. Classify

아래 13개 클래스를 **영문 대문자 스네이크케이스**로 등록한다.
값이 코드의 분기 키가 되므로 한글이나 공백을 넣지 않는다.

| 클래스 값              | 무엇을 담는가                                |
| ---------------------- | -------------------------------------------- |
| `GOV_SUPPORT_PROGRAM`  | 창업지원·R&D·바우처 등 정부지원사업 공고     |
| `JOB_POSTING`          | 정규직·인턴·계약직 채용 공고                 |
| `HOUSING_SUBSCRIPTION` | 행복주택·공공임대·아파트 청약 공고           |
| `UNIVERSITY_ADMISSION` | 수시·편입·대학원 모집요강                    |
| `SCHOLARSHIP`          | 교내외 장학금·재단 장학 공고                 |
| `COMPETITION`          | 공모전·해커톤·논문대회 요강                  |
| `EVENT_ENTRY`          | 추첨·체험단·서포터즈 등 이벤트 응모 안내     |
| `EXAM_CERTIFICATION`   | 국가고시·어학·기술자격 시험 공고             |
| `PUBLIC_BENEFIT`       | 지원금·수당·감면 등 정부 혜택 신청 안내      |
| `MEMBERSHIP_PROGRAM`   | 액셀러레이터·코워킹·클라우드 크레딧 프로그램 |
| `PERMIT_FILING`        | 사업자등록·영업신고·특허 등 인허가 안내      |
| `CONTRACT_TERMS`       | 임대차·근로·용역 계약서 및 약관              |
| `OTHER`                | 위 어디에도 맞지 않음                        |

Split 기능은 **끄고** 둔다. 한 문서를 하나로 분류한다.

### 3. Extract

아래 필드를 스키마로 등록한다. 이름은 영문, 설명은 한국어로 적는다.

| 필드             | 설명(그대로 입력)                                       |
| ---------------- | ------------------------------------------------------- |
| `title`          | 공고 제목                                               |
| `organization`   | 주관 기관 또는 회사명                                   |
| `target`         | 지원 대상                                               |
| `requirements`   | 자격 요건. 항목마다 한 문장으로 나눈다                  |
| `documents`      | 제출 서류 목록. 지정 양식이 있으면 함께 적는다          |
| `deadline`       | 접수 마감일. YYYY-MM-DD 또는 YYYY-MM-DDTHH:mm           |
| `budget`         | 지원 규모·급여·혜택. 원문 표현 그대로                   |
| `scoring`        | 평가 항목과 배점                                        |
| `howToApply`     | 신청 방법과 접수처                                      |
| `actionRequired` | 신청자가 실제로 해야 하는 행동(댓글 작성, 서류 발급 등) |

### 4. Instruct

프롬프트에 아래를 그대로 넣는다.

```
추출 결과를 검토하고, 원문에서 확인되지 않아 신청자가 직접 확인해야 하는 항목만
나열하라. 추출된 값에 이미 담긴 내용은 넣지 않는다. 원문에 없는 내용을 지어내지
않는다. 한국어로, 항목당 한 줄로 쓴다.
```

---

## 절차

1. 에이전트 화면을 연다.
2. 노드를 위 순서대로 추가한다. 이미 있는 노드는 재사용한다.
3. 각 노드에 위 설정을 입력한다.
4. **저장한다.** 저장 후 Config ID 가 표시된다.
5. `에이전트 옵션 → Code` 를 열어 **Agent ID 와 Config ID 를 확인**한다.

## 완료 조건

셋 다 만족해야 끝난 것이다.

- [ ] Classify 클래스 13개가 등록됨
- [ ] Extract 필드 10개가 등록됨
- [ ] 저장 후 **Config ID 가 표시됨** (`설정을 저장하면...` 문구가 사라짐)

## 결과로 보고할 것

```
Agent ID:  agt_...
Config ID: cfg_...
```

## 막혔을 때

- 노드 추가 UI 가 안 보이면 파일을 하나 업로드해 본다. 업로드 후 편집 화면이 열린다.
- 사이드바 링크 클릭이 안 먹으면 URL 로 직접 이동한다:
  `https://studio.upstage.ai/agents/<agentId>`
- 로그인이 풀렸으면 **사람에게 요청한다.** 자격 증명을 입력하지 않는다.
- 클래스 13개가 UI 에서 너무 많으면, 아래 7개로 줄이고 **줄였다는 사실을 보고**한다.
  `GOV_SUPPORT_PROGRAM` `JOB_POSTING` `HOUSING_SUBSCRIPTION`
  `EDUCATION` `COMPETITION_EVENT` `ADMIN_CONTRACT` `OTHER`

## 하지 말 것

- 다른 에이전트를 지우지 않는다.
- 결제·구독 설정을 건드리지 않는다.
- API 키를 화면 밖으로 옮기거나 어딘가에 붙여넣지 않는다.
