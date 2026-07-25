// src/lib/get-operator-scope.ts
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export interface OperatorScope {
  id: string;
  email: string;
  roleTier: string;
  isSuperuser: boolean;
  canIngestChrono: boolean;
  canModifyRoster: boolean;
  department: string | null;
  costCenter: string | null;
}

interface GofreshSessionCookie {
  id: string;
  email: string;
  role: string;
  isSuperuser: boolean;
  rights: {
    chrono: boolean;
    roster: boolean;
  };
}

/**
 * Resolves the authenticated operator's live access scope.
 *
 * Deliberately re-reads department / cost center / role / superuser status
 * from the database on every call rather than trusting the session cookie,
 * so that an admin reassigning an operator's department takes effect
 * immediately without requiring the operator to log out and back in.
 *
 * Returns null if there is no valid session or the account has since been
 * revoked/deleted.
 */
export async function getOperatorScope(): Promise<OperatorScope | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("gofresh_session");

  if (!sessionCookie?.value) return null;

  let session: GofreshSessionCookie;
  try {
    session = JSON.parse(sessionCookie.value);
  } catch {
    return null;
  }

  if (!session?.id) return null;

  try {
    const user = await prisma.systemUser.findUnique({
      where: { id: session.id },
      select: {
        id: true,
        email: true,
        roleTier: true,
        isSuperuser: true,
        canIngestChrono: true,
        canModifyRoster: true,
        department: true,
        costCenter: true,
      },
    });

    if (!user) return null;

    return user;
  } catch (err) {
    console.error("getOperatorScope lookup failure:", err);
    return null;
  }
}

/**
 * Builds a Supabase-friendly scope filter description.
 * - null => no restriction (superuser)
 * - { department: null, costCenter: null } shape is never returned when
 *   restricted; callers should check `unassigned` and short-circuit to an
 *   empty result set instead of querying.
 */
export function isUnassignedOperator(scope: OperatorScope): boolean {
  return !scope.isSuperuser && !scope.department && !scope.costCenter;
}