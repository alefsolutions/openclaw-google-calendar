export type ClarificationField =
  | "summary"
  | "start"
  | "end"
  | "calendarId"
  | "eventReference"
  | "updatePayload"
  | "windowDays"
  | "limit";

export interface ClarificationItem {
  field: ClarificationField;
  question: string;
  reason: string;
}

export interface ClarificationNeededResult {
  status: "needs-clarification";
  items: ClarificationItem[];
}

export interface BlockedResult {
  status: "blocked";
  reason: string;
}

export interface ReadyResult<TValue> {
  status: "ready";
  value: TValue;
}

export interface NotImplementedResult {
  status: "not-implemented";
  reason: string;
}

export type UseCaseResult<TValue> =
  | ClarificationNeededResult
  | BlockedResult
  | ReadyResult<TValue>
  | NotImplementedResult;

export function needsClarification(items: ClarificationItem[]): ClarificationNeededResult {
  return {
    status: "needs-clarification",
    items,
  };
}

export function blocked(reason: string): BlockedResult {
  return {
    status: "blocked",
    reason,
  };
}

export function ready<TValue>(value: TValue): ReadyResult<TValue> {
  return {
    status: "ready",
    value,
  };
}

export function notImplemented(reason: string): NotImplementedResult {
  return {
    status: "not-implemented",
    reason,
  };
}
