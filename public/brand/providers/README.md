# 프로바이더 마크

`ProviderMark` 가 `/brand/providers/<provider>.svg` 를 찾는다.
파일이 없으면 중립 아이콘으로 떨어지므로 화면이 깨지지는 않는다.

필요한 파일:

| 파일 | 언제 |
| --- | --- |
| `upstage.svg` | `LLM_PROVIDER=upstage` (현재 기본값) |
| `azure.svg` | MS 트랙으로 전환할 때 |
| `openai.svg` | 폴백용 |

권장 규격 — 정사각 viewBox, 단색이면 `fill="currentColor"` 로 두면 테마를 따라간다.

로고를 기억으로 그리지 않는다. 공식 브랜드 자료에서 받은 파일만 넣는다.
