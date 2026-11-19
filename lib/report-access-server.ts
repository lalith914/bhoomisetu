import { NextRequest } from "next/server";
import { getViewerIdentity } from "@/lib/server-auth";
import { REPORT_ACCESS_COOKIE, verifyAccessToken } from "@/lib/report-access";

export async function hasReportAccess(request: NextRequest, reportId: string) {
  const viewer = await getViewerIdentity();
  if (viewer.isOwner) return true;
  if (!reportId) return false;
  try {
    return verifyAccessToken(
      request.cookies.get(REPORT_ACCESS_COOKIE)?.value,
      reportId,
      viewer.email,
    );
  } catch {
    return false;
  }
}
