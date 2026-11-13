import { NextResponse } from "next/server";

import type { ApiErrorBody } from "@/lib/contracts";

export function apiError(
  status: number,
  code: string,
  message: string,
  issues?: Record<string, string[]>,
) {
  const body: ApiErrorBody = {
    error: { code, message, ...(issues ? { issues } : {}) },
  };

  return NextResponse.json(body, { status });
}
