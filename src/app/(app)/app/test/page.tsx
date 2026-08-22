import { Check, FlaskConical, Sparkles } from "lucide-react";

import { AppHeader } from "@/components/app/app-header";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = { title: "테스트" };

export default function TestPage() {
  return (
    <>
      <AppHeader trail={["개발자 도구", "테스트"]} />
      <div className="mx-auto w-full max-w-5xl px-6 py-10 sm:py-16">
        <div className="max-w-2xl">
          <Badge variant="secondary" className="gap-1.5">
            <Sparkles />
            Sandbox ready
          </Badge>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">
            테스트로 김시윤이 추가한 페이지
          </h1>
          <p className="mt-3 text-base leading-7 text-muted-foreground">
            새로운 흐름을 빠르게 확인하고, 아이디어를 안전하게 실험하는 공간입니다.
          </p>
        </div>

        <Card className="relative mt-10 overflow-hidden border-brand/20 bg-gradient-to-br from-brand/15 via-brand/5 to-transparent py-0 shadow-sm">
          <div className="absolute -top-16 -right-16 size-56 rounded-full bg-brand/15 blur-3xl" />
          <CardHeader className="relative px-6 pt-6 sm:px-8 sm:pt-8">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-brand text-brand-foreground shadow-lg shadow-brand/25">
              <FlaskConical className="size-6" />
            </div>
            <CardAction>
              <Badge className="gap-1.5">
                <Check />
                준비 완료
              </Badge>
            </CardAction>
            <CardTitle className="mt-5 text-xl">테스트 환경</CardTitle>
            <CardDescription className="leading-6">
              변경 사항을 눈으로 확인할 수 있는 데모용 화면입니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="relative px-6 pb-6 sm:px-8 sm:pb-8">
            <div className="flex items-center gap-3 rounded-xl border border-brand/15 bg-background/70 px-4 py-3 text-sm backdrop-blur-sm">
              <span className="flex size-6 items-center justify-center rounded-full bg-brand/10 text-brand">
                <Check className="size-3.5" />
              </span>
              <span className="font-medium">
                김시윤이 만든 테스트 페이지가 정상 작동합니다.
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
