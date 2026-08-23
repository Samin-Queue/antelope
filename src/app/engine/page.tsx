import Link from "next/link";

import { socialMetadata } from "@/lib/og";
import { noticeWorkflow } from "@/lib/studio-workflow";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { analysisWorkflow } from "@/app/(labs)/lab/analysis/_lib/workflow";
import { validationWorkflow } from "@/app/(labs)/lab/validation/_lib/workflow";
import { engine } from "@/content/engine";
import { site } from "@/content/site";

import { Dag, StepTally } from "./_lib/dag";
import {
  CallbackLoop,
  DualVector,
  Duo,
  GatewayLoop,
  LaneBars,
  PipelineRail,
  StudioSequence,
  WindowStrip,
} from "./_lib/diagrams";
import { Handoff } from "./_lib/handoff";
import {
  Card,
  DefGrid,
  Measured,
  Mono,
  Section,
  Source,
  Sub,
  T,
  Table,
} from "./_lib/parts";
import { SectionTabs } from "./_lib/tabs";

export const metadata = {
  title: "엔진",
  description: engine.sub,
  alternates: { canonical: "/engine" },
  ...socialMetadata({
    title: `${engine.headline} · ${site.name}`,
    description: engine.sub,
    path: "/engine",
    type: "article",
  }),
};

/**
 * 엔진 해부.
 *
 * 랜딩은 「무엇을 해 주는가」를 말한다. 여기는 **「그래서 무엇으로 도는가」**를
 * 말한다 — Upstage 트랙 심사가 「Studio 가 문서 처리의 중심인가」를 확인하러
 * 오는 자리다. 그래서 규칙이 하나 더 붙는다: 주장마다 파일 경로나 실측값을
 * 같이 낸다. 대조할 수 없는 문장은 넣지 않는다.
 *
 * Studio 구성도는 **실제 워크플로 정의 함수에서 그린다**(`Dag`). 손으로 그린
 * 그림은 워크플로를 고친 날 혼자 옛말을 하고, 검증하러 온 사람에게 그건 틀린
 * 문서보다 나쁘다.
 */
export default function EnginePage() {
  const workflows = [
    { agent: engine.studio.agents[0], steps: noticeWorkflow() },
    { agent: engine.studio.agents[1], steps: validationWorkflow() },
    { agent: engine.studio.agents[2], steps: analysisWorkflow() },
  ];

  return (
    <>
      <SiteHeader />
      <SectionTabs />
      <main className="flex-1">
        {/* ── 표지 ─────────────────────────────────────────────── */}
        <section className="mx-auto w-full max-w-6xl px-5 pt-16 pb-4">
          <p className="font-mono text-xs tracking-wide text-brand">
            <T>{engine.eyebrow}</T>
          </p>
          <h1 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            <T>{engine.headline}</T>
          </h1>
          <p className="mt-5 max-w-3xl text-sm leading-relaxed text-pretty text-muted-foreground">
            <T>{engine.sub}</T>
          </p>

          <ul className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-3">
            {engine.metrics.map((metric) => (
              <li key={metric.label} className="bg-background p-5">
                <p className="font-mono text-2xl text-brand">{metric.value}</p>
                <p className="mt-1 text-sm font-medium">
                  <T>{metric.label}</T>
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  <T>{metric.sub}</T>
                </p>
              </li>
            ))}
          </ul>

          <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
            <T>{engine.note}</T>
          </p>
        </section>

        {/* ── 0. 두 엔진의 분업 ─────────────────────────────────── */}
        <Section
          id="duo"
          eyebrow={engine.duo.eyebrow}
          headline={engine.duo.headline}
          sub={engine.duo.sub}
        >
          <Duo />

          <div className="mt-10">
            <Sub>
              <T>{engine.duo.sizes.headline}</T>
            </Sub>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              <T>{engine.duo.sizes.body}</T>
            </p>
            <div className="mt-5">
              <Table
                head={["모델", "어디에 쓰나", "왜 그 크기인가"]}
                rows={engine.duo.sizes.rows.map((row) => [
                  row.tier,
                  <span key="w" className="font-mono text-[11px]">
                    {row.where}
                  </span>,
                  row.why,
                ])}
              />
            </div>
          </div>
        </Section>

        {/* ── 0.5 왕복 ─────────────────────────────────────────── */}
        <Section
          id="handoff"
          eyebrow={engine.journey.eyebrow}
          headline={engine.journey.headline}
          sub={engine.journey.sub}
        >
          <Handoff />

          <p className="mt-8 rounded-xl border border-brand/25 bg-brand/5 px-4 py-3 text-sm leading-relaxed">
            <T>{engine.journey.close}</T>
          </p>

          <div className="mt-12">
            <Sub>
              <T>{engine.journey.loop.headline}</T>
            </Sub>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              <T>{engine.journey.loop.sub}</T>
            </p>
            <div className="mt-5">
              <CallbackLoop />
            </div>
            <div className="mt-3">
              <Card>
                <Sub>
                  <T>{engine.journey.loop.switchOver.headline}</T>
                </Sub>
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                  <T>{engine.journey.loop.switchOver.body}</T>
                </p>
              </Card>
            </div>
            <Source path={engine.journey.loop.file} />
          </div>

          <div className="mt-12">
            <Sub>
              <T>{engine.journey.detours.headline}</T>
            </Sub>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              <T>{engine.journey.detours.sub}</T>
            </p>
            <div className="mt-5">
              <Table
                head={["무엇이", "언제", "어떻게 되돌아가나", "어디에"]}
                rows={engine.journey.detours.rows.map((row) => [
                  row.what,
                  row.when,
                  <T key="how">{row.how}</T>,
                  <span key="w" className="font-mono text-[11px] break-all">
                    {row.where}
                  </span>,
                ])}
              />
            </div>
            <p className="mt-3 max-w-3xl text-xs leading-relaxed text-muted-foreground">
              <T>{engine.journey.detours.note}</T>
            </p>
          </div>

          <div className="mt-6">
            <Card>
              <Sub>
                <T>{engine.journey.synth.headline}</T>
              </Sub>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                <T>{engine.journey.synth.body}</T>
              </p>
              <Source path={engine.journey.synth.file} />
            </Card>
          </div>
        </Section>

        {/* ── 1. 준비 파이프라인 ───────────────────────────────── */}
        <Section
          id="flow"
          eyebrow={engine.flow.eyebrow}
          headline={engine.flow.headline}
          sub={engine.flow.sub}
        >
          <PipelineRail />

          <div className="mt-10 grid gap-3 md:grid-cols-3">
            {engine.flow.parallel.map((item) => (
              <Card key={item.title}>
                <p className="text-sm font-medium">
                  <T>{item.title}</T>
                </p>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  <T>{item.body}</T>
                </p>
              </Card>
            ))}
          </div>

          <ul className="mt-6 space-y-2">
            {engine.flow.resilience.map((line) => (
              <li
                key={line}
                className="flex gap-2.5 text-xs leading-relaxed text-muted-foreground"
              >
                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-brand" />
                <T>{line}</T>
              </li>
            ))}
          </ul>

          <Source path={engine.flow.file} />
        </Section>

        {/* ── 2. Upstage Studio ────────────────────────────────── */}
        <Section
          id="studio"
          eyebrow={engine.studio.eyebrow}
          headline={engine.studio.headline}
          sub={engine.studio.sub}
        >
          <Table
            head={["에이전트", "하는 일", "Agent ID", "Config ID", "스텝", "프로비저닝"]}
            rows={engine.studio.agents.map((agent) => [
              agent.name,
              agent.purpose,
              <span key="a" className="font-mono text-[11px] break-all">
                {agent.agentId}
              </span>,
              <span key="c" className="font-mono text-[11px] break-all">
                {agent.configId}
              </span>,
              agent.steps,
              <span key="p" className="font-mono text-[11px]">
                {agent.provision}
              </span>,
            ])}
          />

          <div className="mt-12 space-y-10">
            {workflows.map(({ agent, steps }) => (
              <div key={agent.name}>
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                  <Sub>
                    {agent.name}{" "}
                    <span className="ml-1 font-mono text-xs font-normal text-muted-foreground">
                      {agent.envKey}
                    </span>
                  </Sub>
                  <span className="font-mono text-[11px] break-all text-muted-foreground/70">
                    {agent.source}
                  </span>
                </div>
                <Dag steps={steps} title={agent.name} />
                <StepTally steps={steps} />
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            점선은 <Mono>document-classify</Mono> 결과로 갈라지는 조건부 경로입니다. 노드
            아래 대문자가 그 분기를 여는 클래스 값입니다 — 요청마다 에이전트를 새로 만들
            필요가 없는 이유가 이 갈래입니다.
          </p>

          <div className="mt-12">
            <Sub>
              <T>{engine.studio.coverage.headline}</T>
            </Sub>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              <T>{engine.studio.coverage.sub}</T>
            </p>
            <div className="mt-5">
              <Table
                head={engine.studio.coverage.head}
                rows={engine.studio.coverage.rows.map((row) => [
                  row[0],
                  row[1],
                  <span key="j" className="font-mono text-xs text-brand">
                    {row[2]}
                  </span>,
                  row[3],
                ])}
              />
            </div>
            <p className="mt-3 max-w-3xl text-xs leading-relaxed text-muted-foreground">
              <T>{engine.studio.coverage.note}</T>
            </p>
          </div>

          <div className="mt-12">
            <Sub>스텝 유형</Sub>
            <div className="mt-4">
              <DefGrid
                items={engine.studio.stepTypes.map((step) => ({
                  name: step.type,
                  body: step.body,
                  tag: step.opts,
                }))}
              />
            </div>
          </div>

          <div className="mt-10">
            <Card>
              <Sub>Config 스키마 제약</Sub>
              <ul className="mt-4 space-y-2">
                {engine.studio.schemaRules.map((rule) => (
                  <li
                    key={rule}
                    className="flex gap-2.5 text-xs leading-relaxed text-muted-foreground"
                  >
                    <span className="mt-1.5 size-1 shrink-0 rounded-full bg-border" />
                    <T>{rule}</T>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <div className="mt-10">
            <Sub>
              <T>{engine.studio.run.headline}</T>
            </Sub>
            <div className="mt-4">
              <StudioSequence />
            </div>
          </div>

          <div className="mt-12">
            <Sub>
              <T>{engine.studio.validate.headline}</T>
            </Sub>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              <T>{engine.studio.validate.sub}</T>
            </p>
            <div className="mt-5">
              <Table
                head={["검사", "등급", "조건식"]}
                rows={engine.studio.validate.checks.map((check) => [
                  check.name,
                  <span
                    key="s"
                    className={
                      check.severity === "error"
                        ? "font-mono text-[11px] text-brand"
                        : "font-mono text-[11px]"
                    }
                  >
                    {check.severity}
                  </span>,
                  <T key="c">{check.cond}</T>,
                ])}
              />
            </div>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <Card className="border-brand/25 bg-brand/5">
                <p className="text-xs leading-relaxed">
                  <T>{engine.studio.validate.key}</T>
                </p>
              </Card>
              <Card>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  <T>{engine.studio.validate.verdict}</T>
                </p>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  <T>{engine.studio.validate.reason}</T>
                </p>
              </Card>
            </div>
          </div>

          <div className="mt-12">
            <Sub>
              <T>{engine.studio.api.headline}</T>
            </Sub>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              <T>{engine.studio.api.sub}</T>
            </p>
            <div className="mt-5">
              <DefGrid
                items={engine.studio.api.rows.map((row) => ({
                  name: row.what,
                  body: row.body,
                }))}
              />
            </div>
            <p className="mt-3 max-w-3xl text-xs leading-relaxed text-muted-foreground">
              <span className="text-foreground">{engine.studio.api.used.headline}</span>{" "}
              <T>{engine.studio.api.used.body}</T>
            </p>
          </div>

          <div className="mt-12">
            <Sub>
              <T>{engine.studio.contracts.headline}</T>
            </Sub>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              <T>{engine.studio.contracts.sub}</T>
            </p>
            <div className="mt-5">
              <Table
                head={["자리", "계약", "안 맞추면"]}
                rows={engine.studio.contracts.items.map((item) => [
                  item.where,
                  <T key="r">{item.rule}</T>,
                  <T key="s">{item.symptom}</T>,
                ])}
              />
            </div>
          </div>

          <div className="mt-8 grid gap-3 md:grid-cols-3">
            {engine.studio.ops.map((rule) => (
              <Card key={rule.title} className="border-brand/25 bg-brand/5">
                <p className="text-sm font-medium">
                  <T>{rule.title}</T>
                </p>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  <T>{rule.body}</T>
                </p>
              </Card>
            ))}
          </div>
        </Section>

        {/* ── 3. 게이트웨이 ─────────────────────────────────────── */}
        <Section
          id="gateway"
          eyebrow={engine.gateway.eyebrow}
          headline={engine.gateway.headline}
          sub={engine.gateway.sub}
        >
          <GatewayLoop />

          <div className="mt-8 grid gap-3 md:grid-cols-2">
            <Card>
              <Sub>
                <T>{engine.gateway.contract.headline}</T>
              </Sub>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                <T>{engine.gateway.contract.body}</T>
              </p>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                <T>{engine.gateway.contract.extra}</T>
              </p>
              <Source path={engine.gateway.contract.file} />
            </Card>
            <Card>
              <Sub>
                <T>{engine.gateway.loose.headline}</T>
              </Sub>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                <T>{engine.gateway.loose.body}</T>
              </p>
              <div className="mt-5 border-t border-border pt-4">
                <Sub>
                  <T>{engine.gateway.repair.headline}</T>
                </Sub>
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                  <T>{engine.gateway.repair.body}</T>
                </p>
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                  <T>{engine.gateway.repair.severity}</T>
                </p>
              </div>
            </Card>
          </div>

          <div className="mt-12">
            <Sub>
              <T>{engine.gateway.verify.headline}</T>
            </Sub>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              <T>{engine.gateway.verify.sub}</T>
            </p>
            <div className="mt-5">
              <DefGrid
                columns={3}
                items={engine.gateway.verify.rules.map((rule) => ({
                  name: rule.name,
                  body: rule.body,
                  tag: rule.severity,
                }))}
              />
            </div>
            <Source path={engine.gateway.verify.file} />
          </div>

          <div className="mt-12">
            <Sub>
              <T>{engine.gateway.tiers.headline}</T>
            </Sub>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              <T>{engine.gateway.tiers.body}</T>
            </p>
            <div className="mt-5">
              <Table
                head={["LLM_PROVIDER", "base URL", "tier: large", "tier: small"]}
                rows={engine.gateway.tiers.rows.map((row) => [
                  row.provider,
                  <span key="b" className="font-mono text-[11px] break-all">
                    {row.base}
                  </span>,
                  <span key="l" className="font-mono text-[11px] text-brand">
                    {row.large}
                  </span>,
                  <span key="s" className="font-mono text-[11px]">
                    {row.small}
                  </span>,
                ])}
              />
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              <T>{engine.gateway.tiers.note}</T>
            </p>
          </div>

          <div className="mt-12">
            <Sub>
              <T>{engine.gateway.retries.headline}</T>
            </Sub>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              <T>{engine.gateway.retries.sub}</T>
            </p>
            <div className="mt-5">
              <Table
                head={["누가", "무엇을", "몇 번", "왜"]}
                rows={engine.gateway.retries.layers.map((layer) => [
                  layer.who,
                  layer.what,
                  <span key="h" className="font-mono text-[11px] text-brand">
                    {layer.how}
                  </span>,
                  layer.why,
                ])}
              />
            </div>
            <p className="mt-3 max-w-3xl text-xs leading-relaxed text-muted-foreground">
              <T>{engine.gateway.retries.note}</T>
            </p>
          </div>

          <div className="mt-12">
            <Sub>
              <T>{engine.gateway.narrator.headline}</T>
            </Sub>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              <T>{engine.gateway.narrator.body}</T>
            </p>
            <ul className="mt-4 space-y-2">
              {engine.gateway.narrator.points.map((point) => (
                <li
                  key={point}
                  className="flex gap-2.5 text-xs leading-relaxed text-muted-foreground"
                >
                  <span className="mt-1.5 size-1 shrink-0 rounded-full bg-brand" />
                  <T>{point}</T>
                </li>
              ))}
            </ul>
            <Source path={engine.gateway.narrator.file} />
          </div>

          <div className="mt-10">
            <Sub>
              <T>{engine.gateway.tasks.headline}</T>
            </Sub>
            <div className="mt-4">
              <DefGrid items={engine.gateway.tasks.rows} />
            </div>
          </div>

          <Source path={engine.gateway.file} />
        </Section>

        {/* ── 4. 자원 · 계측 ────────────────────────────────────── */}
        <Section
          id="runtime"
          eyebrow={engine.runtime.eyebrow}
          headline={engine.runtime.headline}
          sub={engine.runtime.sub}
        >
          <LaneBars />
          <Source path={engine.runtime.lanesFile} />

          <div className="mt-12 grid gap-3 lg:grid-cols-2">
            <Card>
              <Sub>
                <T>{engine.runtime.ledger.headline}</T>
              </Sub>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                <T>{engine.runtime.ledger.body}</T>
              </p>
              <ul className="mt-4 space-y-2">
                {engine.runtime.ledger.points.map((point) => (
                  <li
                    key={point}
                    className="flex gap-2.5 text-xs leading-relaxed text-muted-foreground"
                  >
                    <span className="mt-1.5 size-1 shrink-0 rounded-full bg-border" />
                    <T>{point}</T>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                <T>{engine.runtime.ledger.health}</T>
              </p>
            </Card>
            <div className="space-y-3">
              <Card>
                <Sub>
                  <T>{engine.runtime.killswitches.headline}</T>
                </Sub>
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                  <T>{engine.runtime.killswitches.sub}</T>
                </p>
                <ul className="mt-4 space-y-2">
                  {engine.runtime.killswitches.items.map((item) => (
                    <li key={item.key} className="flex flex-wrap items-baseline gap-x-3">
                      <Mono tone="brand">{item.key}</Mono>
                      <span className="text-xs text-muted-foreground">
                        <T>{item.body}</T>
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
              <Card>
                <Sub>
                  <T>{engine.runtime.evals.headline}</T>
                </Sub>
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                  <T>{engine.runtime.evals.body}</T>
                </p>
              </Card>
            </div>
          </div>
        </Section>

        {/* ── 5. 브라우저 하네스 ────────────────────────────────── */}
        <Section
          id="browser"
          eyebrow={engine.browser.eyebrow}
          headline={engine.browser.headline}
          sub={engine.browser.sub}
        >
          <div className="grid gap-3 md:grid-cols-2">
            {[engine.browser.modes.auto, engine.browser.modes.manual].map(
              (mode, index) => (
                <Card
                  key={mode.title}
                  className={index === 0 ? "border-brand/30 bg-brand/5" : undefined}
                >
                  <p className="text-sm font-medium">
                    <T>{mode.title}</T>
                  </p>
                  <dl className="mt-4 space-y-2">
                    {mode.rows.map(([key, value]) => (
                      <div key={key} className="flex gap-3 text-xs">
                        <dt className="w-20 shrink-0 text-muted-foreground">{key}</dt>
                        <dd className="font-mono text-[11px] break-all">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </Card>
              ),
            )}
          </div>
          <p className="mt-5 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            <T>{engine.browser.why}</T>
          </p>

          <div className="mt-12">
            <Sub>도구</Sub>
            <div className="mt-4">
              <DefGrid columns={3} items={engine.browser.tools} />
            </div>
            <p className="mt-4 max-w-3xl text-xs leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">
                <T>{engine.browser.serial.headline}</T>
              </span>{" "}
              <T>{engine.browser.serial.body}</T>
            </p>
          </div>

          <div className="mt-12 grid gap-3 lg:grid-cols-2">
            <Card>
              <Sub>
                <T>{engine.browser.validity.headline}</T>
              </Sub>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                <T>{engine.browser.validity.body}</T>
              </p>
              <ul className="mt-4 space-y-2">
                {engine.browser.validity.points.map((point) => (
                  <li
                    key={point}
                    className="flex gap-2.5 text-xs leading-relaxed text-muted-foreground"
                  >
                    <span className="mt-1.5 size-1 shrink-0 rounded-full bg-brand" />
                    <T>{point}</T>
                  </li>
                ))}
              </ul>
            </Card>
            <Card>
              <Sub>
                <T>{engine.browser.captcha.headline}</T>
              </Sub>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                <T>{engine.browser.captcha.body}</T>
              </p>
              <ul className="mt-4 space-y-2">
                {engine.browser.captcha.points.map((point) => (
                  <li
                    key={point}
                    className="flex gap-2.5 text-xs leading-relaxed text-muted-foreground"
                  >
                    <span className="mt-1.5 size-1 shrink-0 rounded-full bg-brand" />
                    <T>{point}</T>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                <T>{engine.browser.captcha.manualNote}</T>
              </p>
            </Card>
          </div>

          <div className="mt-12">
            <Sub>
              <T>{engine.browser.window.headline}</T>
            </Sub>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              <T>{engine.browser.window.body}</T>
            </p>
            <div className="mt-5">
              <WindowStrip />
            </div>
            <p className="mt-4 max-w-3xl text-xs leading-relaxed text-muted-foreground">
              <T>{engine.browser.window.cache}</T>
            </p>
            <Source path={engine.browser.window.file} />
          </div>

          <p className="mt-10 rounded-xl border border-brand/25 bg-brand/5 px-4 py-3 text-sm leading-relaxed">
            <T>{engine.browser.stop}</T>
          </p>
        </Section>

        {/* ── 6. 사람이 개입하는 지점 ───────────────────────────── */}
        <Section
          id="human"
          eyebrow={engine.human.eyebrow}
          headline={engine.human.headline}
          sub={engine.human.sub}
        >
          <Table
            head={["어디서", "누가", "어떻게"]}
            rows={engine.human.rows.map((row) => [
              row.where,
              <span key="w" className="text-foreground">
                {row.who}
              </span>,
              <T key="h">{row.how}</T>,
            ])}
          />
          <p className="mt-4 rounded-xl border border-brand/25 bg-brand/5 px-4 py-3 text-sm leading-relaxed">
            <T>{engine.human.note}</T>
          </p>
        </Section>

        {/* ── 6. 슬랙 릴레이 ───────────────────────────────────── */}
        <Section
          id="relay"
          eyebrow={engine.relay.eyebrow}
          headline={engine.relay.headline}
          sub={engine.relay.sub}
        >
          <Sub>
            <T>{engine.relay.gate.headline}</T>
          </Sub>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            <T>{engine.relay.gate.sub}</T>
          </p>
          <ol className="mt-5 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
            {engine.relay.gate.steps.map((step, index) => (
              <li key={step.name} className="bg-background p-4">
                <p className="font-mono text-[10px] text-muted-foreground">{index + 1}</p>
                <p className="mt-1 font-mono text-xs text-brand">{step.name}</p>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  <T>{step.body}</T>
                </p>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            <T>{engine.relay.gate.note}</T>
          </p>

          <div className="mt-10 grid gap-3 lg:grid-cols-2">
            <Card>
              <Sub>
                <T>{engine.relay.identity.headline}</T>
              </Sub>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                <T>{engine.relay.identity.body}</T>
              </p>
              <ul className="mt-4 space-y-2">
                {engine.relay.identity.points.map((point) => (
                  <li
                    key={point}
                    className="flex gap-2.5 text-xs leading-relaxed text-muted-foreground"
                  >
                    <span className="mt-1.5 size-1 shrink-0 rounded-full bg-brand" />
                    <T>{point}</T>
                  </li>
                ))}
              </ul>
            </Card>
            <Card>
              <Sub>
                <T>{engine.relay.stream.headline}</T>
              </Sub>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                <T>{engine.relay.stream.body}</T>
              </p>
              <dl className="mt-4 space-y-2 border-t border-border/60 pt-4 text-xs">
                <div className="flex gap-3">
                  <dt className="w-16 shrink-0 font-mono text-[11px] text-brand">
                    남긴다
                  </dt>
                  <dd className="text-muted-foreground">{engine.relay.stream.keep}</dd>
                </div>
                <div className="flex gap-3">
                  <dt className="w-16 shrink-0 font-mono text-[11px] text-muted-foreground">
                    버린다
                  </dt>
                  <dd className="text-muted-foreground">{engine.relay.stream.drop}</dd>
                </div>
              </dl>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                <T>{engine.relay.stream.throttle}</T>
              </p>
            </Card>
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <Card>
              <Sub>
                <T>{engine.relay.dialogue.headline}</T>
              </Sub>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                <T>{engine.relay.dialogue.body}</T>
              </p>
              <ul className="mt-4 space-y-2">
                {engine.relay.dialogue.points.map((point) => (
                  <li
                    key={point}
                    className="flex gap-2.5 text-xs leading-relaxed text-muted-foreground"
                  >
                    <span className="mt-1.5 size-1 shrink-0 rounded-full bg-brand" />
                    <T>{point}</T>
                  </li>
                ))}
              </ul>
            </Card>
            <Card>
              <Sub>
                <T>{engine.relay.queue.headline}</T>
              </Sub>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                <T>{engine.relay.queue.body}</T>
              </p>
              <p className="mt-4 rounded-lg border border-border bg-background px-3 py-2 font-mono text-[11px] text-muted-foreground">
                {engine.relay.queue.numbers}
              </p>
            </Card>
          </div>

          <Source path={engine.relay.file} />
        </Section>

        {/* ── 6. 지식베이스 · 근거 ──────────────────────────────── */}
        <Section
          id="memory"
          eyebrow={engine.memory.eyebrow}
          headline={engine.memory.headline}
          sub={engine.memory.sub}
        >
          <Sub>
            <T>{engine.memory.dual.headline}</T>
          </Sub>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            <T>{engine.memory.dual.body}</T>
          </p>
          <div className="mt-5">
            <Table
              head={engine.memory.dual.table.head}
              rows={engine.memory.dual.table.rows.map((row) => [
                row[0],
                row[1],
                <span key="a" className="font-mono text-xs font-medium text-brand">
                  {row[2]}
                </span>,
                <span key="b" className="font-mono text-xs">
                  {row[3]}
                </span>,
              ])}
            />
          </div>
          <Measured>
            <T>{engine.memory.dual.threshold}</T>
          </Measured>
          <div className="mt-6">
            <DualVector />
          </div>

          <div className="mt-12 grid gap-3 lg:grid-cols-2">
            <Card>
              <Sub>
                <T>{engine.memory.index.headline}</T>
              </Sub>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                <T>{engine.memory.index.body}</T>
              </p>
              <Measured>
                <T>{engine.memory.index.measured}</T>
              </Measured>
            </Card>
            <Card>
              <Sub>
                <T>{engine.memory.curator.headline}</T>
              </Sub>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                <T>{engine.memory.curator.body}</T>
              </p>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                <T>{engine.memory.curator.graph}</T>
              </p>
            </Card>
          </div>

          <div className="mt-12">
            <Sub>
              <T>{engine.memory.evidence.headline}</T>
            </Sub>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              <T>{engine.memory.evidence.sub}</T>
            </p>
            <div className="mt-5">
              <DefGrid columns={2} items={engine.memory.evidence.steps} />
            </div>
            <Measured>
              <T>{engine.memory.evidence.measured}</T>
            </Measured>
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              <Card>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  <T>{engine.memory.evidence.citations}</T>
                </p>
              </Card>
              <Card className="border-brand/25 bg-brand/5">
                <p className="text-xs leading-relaxed">
                  <T>{engine.memory.evidence.honesty}</T>
                </p>
              </Card>
            </div>
          </div>
        </Section>

        {/* ── 7. 산출물 ────────────────────────────────────────── */}
        <Section
          id="artifacts"
          eyebrow={engine.artifacts.eyebrow}
          headline={engine.artifacts.headline}
          sub={engine.artifacts.sub}
        >
          <DefGrid
            columns={2}
            items={engine.artifacts.formats.map((format) => ({
              name: format.ext,
              body: format.body,
            }))}
          />
          <div className="mt-6 grid gap-3 lg:grid-cols-2">
            <Card>
              <Sub>
                <T>{engine.artifacts.hwp.headline}</T>
              </Sub>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                <T>{engine.artifacts.hwp.body}</T>
              </p>
            </Card>
            <Card>
              <Sub>보관함</Sub>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                <T>{engine.artifacts.recall}</T>
              </p>
            </Card>
          </div>
        </Section>

        {/* ── 8. 폴백 ──────────────────────────────────────────── */}
        <Section
          id="fallback"
          eyebrow={engine.fallback.eyebrow}
          headline={engine.fallback.headline}
          sub={engine.fallback.sub}
        >
          <Table
            head={["실패하는 것", "대신 하는 것", "그때 잃는 것"]}
            rows={engine.fallback.rows.map((row) => [row.when, row.then, row.cost])}
          />
        </Section>

        {/* ── CTA ──────────────────────────────────────────────── */}
        <section className="mx-auto w-full max-w-6xl px-5 pt-8 pb-24">
          <div className="rounded-3xl border border-border bg-card/40 px-6 py-12 text-center sm:px-10">
            <h2 className="text-2xl font-semibold tracking-tight text-balance">
              <T>{engine.cta.headline}</T>
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-pretty text-muted-foreground">
              <T>{engine.cta.sub}</T>
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button render={<Link href={engine.cta.primary.href} />}>
                <T>{engine.cta.primary.label}</T>
              </Button>
              <Button
                render={<Link href={engine.cta.secondary.href} />}
                variant="outline"
              >
                <T>{engine.cta.secondary.label}</T>
              </Button>
              <Button render={<Link href={engine.cta.tertiary.href} />} variant="ghost">
                <T>{engine.cta.tertiary.label}</T>
              </Button>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
