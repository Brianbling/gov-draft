import type { LegalDoc } from "../types"
import { normalizeText } from "./normalize-text"

/**
 * 对 LegalDoc 的所有文本字段应用 normalizeText，返回一个新的规范化对象。
 * 覆盖：title、recipient、issuer、date、printingOffice、printingDate、
 * 各正文段落的 text、附件名、抄送名单、出席/请假/列席名单。
 * 原对象不被修改（纯函数）。
 */
export function normalizeDoc(doc: LegalDoc): LegalDoc {
  return {
    ...doc,
    title: normalizeText(doc.title),
    recipient: doc.recipient ? normalizeText(doc.recipient) : undefined,
    issuer: doc.issuer ? normalizeText(doc.issuer) : undefined,
    date: doc.date ? normalizeText(doc.date) : undefined,
    printingOffice: doc.printingOffice
      ? normalizeText(doc.printingOffice)
      : undefined,
    printingDate: doc.printingDate
      ? normalizeText(doc.printingDate)
      : undefined,
    copyNumber: doc.copyNumber ? normalizeText(doc.copyNumber) : undefined,
    issuingOrg: doc.issuingOrg ? normalizeText(doc.issuingOrg) : undefined,
    annotation: doc.annotation ? normalizeText(doc.annotation) : undefined,
    body: doc.body.map((paragraph) => ({
      ...paragraph,
      text: normalizeText(paragraph.text),
    })),
    attachments: doc.attachments?.map(normalizeText),
    cc: doc.cc?.map(normalizeText),
    attendees: doc.attendees?.map(normalizeText),
    absentees: doc.absentees?.map(normalizeText),
    observers: doc.observers?.map(normalizeText),
  }
}
