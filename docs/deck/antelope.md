---
marp: true
theme: antelope
paginate: true
html: true
footer: "Antelope"
---

<!-- _class: title -->
<!-- _paginate: false -->
<!-- _footer: "" -->

# Antelope

**Apply Concierge** — One-Click Apply with personal intelligence

<!--
15초. 이름과 한 줄만. 여기서 설명하지 않는다.
-->

---

<!-- _class: lead -->

# Opportunity still arrives<br>as a **PDF**

Scholarships. Competitions. Housing. Government programs.
Permits. Job postings. Forms nobody reads twice.

<!--
문제를 크게 던지고 넘어간다. 나열은 다음 장에서.
-->

---

## Before you can apply, you answer these alone

<br>

- **Am I eligible?**
- **What documents do I need?**
- **Which forms do I have to fill out?**
- **When and where do I submit?**
- **Are there exceptions or hidden requirements?**

<br>

Every answer is buried somewhere in the notice.

<!--
다섯 개를 읽지 말고, 「전부 사람이 문서를 뒤져서 찾는다」만 말한다.
-->

---

<!-- _class: lead -->

# Miss one requirement,<br>lose the whole opportunity

There is no partial credit in an application.

<!--
여기가 감정적으로 가장 센 지점이다. 잠깐 멈춘다.
-->

---

<!-- _class: section -->

# What we built

A universal interface for anything that can be submitted

---

## Hand it the document. Ask three questions.

<br>

> **Can I apply?**
> **What do I need?**
> **Can you submit it for me?**

<br>

No parsing PDFs. No cross-checking forms.
No learning one more government website.

<!--
제품의 약속을 사용자 언어로. 기능 나열이 아니다.
-->

---

## One path, end to end

<br>

**Document** → **Eligibility** → **Requirements** → **Preparation** → **Submission**

<br>

| Stage        | What happens                                        |
| ------------ | --------------------------------------------------- |
| Document     | A file, a link, or a sentence — we take any of them |
| Eligibility  | Requirements are extracted and matched against you  |
| Requirements | Missing items become a short list of questions      |
| Preparation  | Forms are filled, documents are drafted             |
| Submission   | The browser applies, with your authorization        |

<!--
이 표가 덱의 뼈대다. 이후 슬라이드는 각 칸의 확대다.
-->

---

<!-- _class: section -->

# Reading the document

Upstage Studio

---

## The notice is not one kind of document

<br>

A workflow classifies what it is, then branches — a grant notice,
a housing application, and a job posting need different questions asked.

- **Parse** — PDF, HWP, DOCX, XLSX, scans
- **Classify** — route to the right extractor
- **Extract** — eligibility, deadlines, required documents, form fields
- **Instruct** — what is still missing from this applicant

The workflow lives in our repository as code, not as clicks in a UI.
Every change is reviewable, and every version is kept.

<!--
Studio 를 「썼다」가 아니라 「어떻게 썼는가」. Config as code 가 차별점.
-->

---

## Every value points back to the page

<br>

Extraction returns coordinates, so an answer can show its source —
the exact block of the original notice it came from.

<br>

**And when we cannot find it, we say so.**
An unfounded highlight is decoration pretending to be evidence.
Trust is the product.

<!--
이 슬라이드가 심사에서 가장 오래 기억된다. 천천히.
-->

---

<!-- _class: section -->

# Personal intelligence

Answer once. Never again.

---

## The second application is easier than the first

<br>

What you type into one application is remembered and reused in the next —
even when the next one asks for it by a different name.

<br>

_"Number of full-time employees"_ finds what you saved as _"current headcount."_

<br>

The knowledge base is curated by an agent, not edited by hand.
You say what changed; it decides what to update.

<!--
해자. 신청이 쌓일수록 빨라진다는 것을 한 문장으로.
-->

---

## Preparation — and what we refuse to do

<br>

- Official templates the notice provides are **filled**, not replaced —
  agencies reject documents that are not on their own form
- Narrative documents are drafted from what we know about you
- **Issued certificates are never generated.** Producing one is forgery.
  We retrieve it from your vault, or we ask you for it

<!--
「안 하는 것」을 명시하는 게 신뢰를 만든다. 여기서 톤을 낮춘다.
-->

---

## Submission — and knowing when to stop

<br>

We check for a CAPTCHA before starting, and that decides everything.

|               | No CAPTCHA                        | CAPTCHA present          |
| ------------- | --------------------------------- | ------------------------ |
| How           | Reads the page structure directly | Real screen, real cursor |
| Speed         | Fast and precise                  | Slower                   |
| Who solves it | The agent                         | **You do**               |

The screen is live the whole time. When something needs a human —
a CAPTCHA, an identity check — control is handed over, then work resumes.

<!--
자율성을 자랑하지 않는다. 「언제 멈춰야 하는지 안다」가 요점.
-->

---

<!-- _class: section -->

# Demo

---

<!-- _class: lead -->

# From documents to done

Give it the opportunity. Get back a submission.

<!--
마무리. 표지의 한 줄로 되돌아온다.
-->
