# 발표자료

Marp 로 만든다. 소스는 마크다운 한 장이고 PDF·PPTX·HTML 이 같은 소스에서 나온다.

```bash
# PDF
CHROME_PATH=/usr/bin/chromium \
  npx -y @marp-team/marp-cli antelope.md --pdf --allow-local-files \
  --theme theme/antelope.css -o antelope.pdf

# 슬라이드별 PNG (검토용)
CHROME_PATH=/usr/bin/chromium \
  npx -y @marp-team/marp-cli antelope.md --images png --allow-local-files \
  --theme theme/antelope.css -o p.png

# PPTX 가 필요하면
CHROME_PATH=/usr/bin/chromium \
  npx -y @marp-team/marp-cli antelope.md --pptx --allow-local-files \
  --theme theme/antelope.css -o antelope.pptx
```

`CHROME_PATH` 는 컨테이너 안에서만 필요하다. macOS 는 설치된 Chrome 을 알아서 찾는다.

## 테마

`theme/antelope.css` 가 제품 화면과 같은 얼굴을 만든다 — `#713BFF`, 본문
Pretendard, 표지·섹션 제목만 Diphylleia.

지키는 것 두 가지가 파일 주석에도 적혀 있다.

- **세리프에 bold 를 주지 않는다.** Diphylleia 는 weight 400 하나뿐이라
  굵기를 올리면 가짜 볼드가 합성돼 획이 뭉개진다.
- **선택자는 전부 `section` 으로 시작한다.** `@import 'default'` 의 규칙이
  `section table` 형태라, 맨 선택자로 쓰면 특정도에서 밀려 조용히 무시된다.

## 슬라이드 클래스

| 클래스    | 쓰임                   |
| --------- | ---------------------- |
| `title`   | 표지. 검정 배경        |
| `section` | 장 구분. 브랜드색 배경 |
| `lead`    | 한 문장만 크게         |
| (없음)    | 일반 본문              |

```markdown
<!-- _class: section -->
```

## 발표자 노트

`<!-- ... -->` 주석이 발표자 노트가 된다(`_class` 같은 디렉티브는 제외).
PDF 에는 안 나오고, Marp 프리뷰·PPTX 로 낼 때 따라간다.
