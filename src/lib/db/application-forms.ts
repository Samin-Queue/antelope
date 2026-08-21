import { desc, eq } from "drizzle-orm";

import { getDb } from "./index";
import { applicationForms, type ApplicationField } from "./schema";

export type ApplicationFormInput = {
  readonly documentId: string;
  readonly applicationType: string;
  readonly title: string;
  readonly fields: readonly ApplicationField[];
};

export async function saveApplicationForm(input: ApplicationFormInput) {
  const [form] = await getDb()
    .insert(applicationForms)
    .values({
      documentId: input.documentId,
      applicationType: input.applicationType,
      title: input.title,
      fields: input.fields,
    })
    .returning();

  if (!form) throw new Error("신청 양식을 저장하지 못했습니다.");
  return form;
}

export async function listApplicationForms(documentId: string) {
  return getDb()
    .select()
    .from(applicationForms)
    .where(eq(applicationForms.documentId, documentId))
    .orderBy(desc(applicationForms.createdAt));
}
