"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  ComposerBox,
  type ComposerSubmit,
  type ModelOption,
} from "@/components/app/composer";
import { setPendingInput } from "@/components/app/pending-input";
import { SignInButtons } from "@/components/sign-in-buttons";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * 히어로 입력 상자.
 *
 * 랜딩에서 「무료로 시작하기」를 누르게 하지 않는다. 제품이 하는 일이 입력
 * 하나로 시작하는 것이므로, 그 입력창을 첫 화면에 그대로 둔다.
 *
 * ⚠ 여기서는 어떤 API 도 부르지 않는다. 입력은 맡겨두고 자리만 옮긴다 —
 * 로그인했으면 워크스페이스로, 아니면 로그인 창으로.
 */
export function HeroComposer({
  signedIn,
  providers,
  models,
}: {
  signedIn: boolean;
  providers: Array<"google" | "github">;
  models: ModelOption[];
}) {
  const router = useRouter();
  const [askSignIn, setAskSignIn] = useState(false);

  function handle(input: ComposerSubmit) {
    setPendingInput(input);
    if (!signedIn) {
      setAskSignIn(true);
      return;
    }
    router.push("/app");
  }

  return (
    <>
      <ComposerBox models={models} onSubmit={handle} className="mx-auto max-w-3xl" />

      <Dialog open={askSignIn} onOpenChange={setAskSignIn}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>로그인하면 이어서 진행합니다</DialogTitle>
            <DialogDescription>
              방금 넣은 내용은 그대로 들고 갑니다. 지식 베이스가 계정에 쌓여야 다음
              공고에서 다시 묻지 않습니다.
            </DialogDescription>
          </DialogHeader>
          <SignInButtons providers={providers} callbackURL="/app" />
        </DialogContent>
      </Dialog>
    </>
  );
}
