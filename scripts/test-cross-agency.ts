/**
 * SEC-3 cross-agency security validation.
 *
 * Verifies that route handlers correctly scope by agencyId — that is,
 * a session belonging to agency A cannot read, modify, or list resources
 * belonging to agency B.
 *
 * Pre-requisites:
 *   1. A Neon ephemeral branch (created by the controller via mcp__neon__create_branch).
 *      DO NOT run against the main branch — this script inserts test users + data.
 *   2. `bun run dev` running locally pointing at the same branch:
 *      $env:DATABASE_URL="<branch-connection-string>"; bun run dev
 *
 * Run:
 *   $env:TEST_DATABASE_URL="<branch-connection-string>"
 *   $env:APP_BASE="http://localhost:3000"
 *   bun run scripts/test-cross-agency.ts
 *
 * The script:
 *   - Connects to TEST_DATABASE_URL using node-postgres (independent of src/db).
 *   - Creates 2 test users via the live /api/auth/sign-up/email endpoint (so Better Auth
 *     handles password hashing, account/session rows, etc.) — these become user A and user B.
 *   - Manually verifies their email (Better Auth requires this to allow sign-in).
 *   - Signs in each user via /api/auth/sign-in/email — captures Set-Cookie headers.
 *   - Posts to /api/register-oauth for each user with a unique agencyName — that wires
 *     `user.agencyId` and `user.role = "account_admin"`.
 *   - Inserts test client + property + contract for each agency (via direct SQL).
 *   - Runs cross-agency HTTP assertions: with cookie A, hit agency B's resources → 404.
 *   - Reports pass/fail per assertion and exits with code 0 on full pass, 1 on any fail.
 *
 * Cleanup: the controller deletes the Neon branch after the script finishes.
 */

import { Pool } from "pg";
import { randomBytes } from "node:crypto";

const TEST_DB_URL = process.env.TEST_DATABASE_URL;
const APP_BASE = process.env.APP_BASE ?? "http://localhost:3000";

if (!TEST_DB_URL) {
  console.error("TEST_DATABASE_URL is required.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: TEST_DB_URL,
  ssl: { rejectUnauthorized: false },
});

interface TestAgency {
  email: string;
  password: string;
  cookie: string;
  userId: string;
  agencyId: string;
  agencyName: string;
  clientId: string;
  propertyId: string;
  contractId: string;
}

function rand(n = 8): string {
  return randomBytes(n).toString("hex");
}

async function signUp(email: string, password: string, name: string): Promise<void> {
  const res = await fetch(`${APP_BASE}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`sign-up failed for ${email}: ${res.status} ${text}`);
  }
}

async function verifyEmailDirectly(email: string): Promise<void> {
  await pool.query(
    `UPDATE "user" SET "emailVerified" = true WHERE email = $1`,
    [email]
  );
}

async function signIn(email: string, password: string): Promise<string> {
  const res = await fetch(`${APP_BASE}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`sign-in failed for ${email}: ${res.status} ${text}`);
  }
  const setCookie = res.headers.getSetCookie?.() ?? [];
  if (setCookie.length === 0) {
    // Fallback for older fetch impl
    const single = res.headers.get("set-cookie");
    if (!single) throw new Error(`No Set-Cookie returned for ${email}`);
    return single.split(";")[0]; // just the name=value pair
  }
  // Pick the better-auth.session_token cookie
  const sessionCookie = setCookie.find((c) =>
    c.startsWith("better-auth.session_token=")
  );
  if (!sessionCookie) {
    throw new Error(
      `Set-Cookie didn't include better-auth.session_token: ${setCookie.join(", ")}`
    );
  }
  return sessionCookie.split(";")[0];
}

async function getUserId(email: string): Promise<string> {
  const r = await pool.query(
    `SELECT id FROM "user" WHERE email = $1 LIMIT 1`,
    [email]
  );
  if (r.rows.length === 0) throw new Error(`user not found: ${email}`);
  return r.rows[0].id as string;
}

async function registerAgencyViaApi(
  cookie: string,
  agencyName: string
): Promise<string> {
  const res = await fetch(`${APP_BASE}/api/register-oauth`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ agencyName }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`register-oauth failed for ${agencyName}: ${res.status} ${text}`);
  }
  // Fetch the agency.id we just created
  const r = await pool.query(
    `SELECT id FROM agency WHERE name = $1 ORDER BY "createdAt" DESC LIMIT 1`,
    [agencyName]
  );
  if (r.rows.length === 0) {
    throw new Error(`agency not found after register: ${agencyName}`);
  }
  return r.rows[0].id as string;
}

async function insertClient(
  agencyId: string,
  userId: string,
  firstName: string,
  type: string
): Promise<string> {
  const id = rand(16);
  await pool.query(
    `INSERT INTO client (
      id, "userId", "agencyId", type, "firstName", "lastName", phone, email,
      "createdAt", "updatedAt"
    ) VALUES ($1, $2, $3, $4, $5, 'Test', '+5491100000000', $6, NOW(), NOW())`,
    [id, userId, agencyId, type, firstName, `${firstName.toLowerCase()}@example.com`]
  );
  return id;
}

async function insertProperty(
  agencyId: string,
  userId: string,
  ownerId: string,
  address: string
): Promise<string> {
  const id = rand(16);
  await pool.query(
    `INSERT INTO property (
      id, "agencyId", "createdBy", "ownerId", title, address, type,
      "rentalStatus", "rentalPriceCurrency", "salePriceCurrency", "isManaged",
      "ownerRole", "createdAt", "updatedAt"
    ) VALUES ($1, $2, $3, $4, 'Test Property', $5, 'apartment',
      'available', 'ARS', 'USD', false, 'ambos', NOW(), NOW())`,
    [id, agencyId, userId, ownerId, address]
  );
  return id;
}

async function insertContract(
  agencyId: string,
  userId: string,
  propertyId: string,
  ownerId: string
): Promise<string> {
  const id = rand(16);
  const contractNumber = `TST-${rand(4).toUpperCase()}`;
  await pool.query(
    `INSERT INTO contract (
      id, "agencyId", "contractNumber", "contractType", "propertyId", "ownerId", "createdBy",
      "startDate", "endDate", "monthlyAmount", "paymentDay",
      "adjustmentIndex", "adjustmentFrequency", status, "paymentModality",
      "createdAt", "updatedAt"
    ) VALUES ($1, $2, $3, 'residential', $4, $5, $6,
      '2026-01-01', '2027-12-31', '100000.00', 10,
      'ICL', 12, 'active', 'A',
      NOW(), NOW())`,
    [id, agencyId, contractNumber, propertyId, ownerId, userId]
  );
  return id;
}

async function setupAgency(suffix: string, label: string): Promise<TestAgency> {
  const runId = rand(4);
  const email = `sec3-test-${suffix}-${runId}@example.com`;
  const password = `Test${rand(4)}!Pass`;
  const name = `SEC3 Test User ${label}`;
  const agencyName = `SEC3 Test Agency ${label} ${runId}`;

  console.log(`[setup ${label}] sign-up`);
  await signUp(email, password, name);
  await verifyEmailDirectly(email);
  const userId = await getUserId(email);

  console.log(`[setup ${label}] sign-in`);
  const cookie = await signIn(email, password);

  console.log(`[setup ${label}] register-oauth (${agencyName})`);
  const agencyId = await registerAgencyViaApi(cookie, agencyName);

  // Re-sign-in so the new agencyId is in the session payload (Better Auth refreshes
  // additional fields on session create/refresh, not on update).
  const cookie2 = await signIn(email, password);

  console.log(`[setup ${label}] create test data`);
  const clientId = await insertClient(agencyId, userId, `Owner${label}`, "owner");
  const propertyId = await insertProperty(
    agencyId,
    userId,
    clientId,
    `${label} Test Address ${rand(4)}`
  );
  const contractId = await insertContract(agencyId, userId, propertyId, clientId);

  return {
    email,
    password,
    cookie: cookie2,
    userId,
    agencyId,
    agencyName,
    clientId,
    propertyId,
    contractId,
  };
}

interface CrossCheck {
  path: string;
  method: "GET" | "PATCH" | "DELETE" | "POST";
  resourceKey: keyof Pick<TestAgency, "propertyId" | "clientId" | "contractId">;
}

// Each entry must use a method actually exported by the target route handler.
// If the route doesn't export that method, Next.js returns 405 — not 404 — which
// is fine for security (no data leak) but useless for THIS validation.
const CROSS_CHECKS: CrossCheck[] = [
  // Detail endpoints — should 404 when crossing agencies
  { path: "/api/properties/:id", method: "GET", resourceKey: "propertyId" },
  { path: "/api/properties/:id", method: "PATCH", resourceKey: "propertyId" },
  { path: "/api/clients/:id", method: "GET", resourceKey: "clientId" },
  { path: "/api/contracts/:id", method: "GET", resourceKey: "contractId" },
  { path: "/api/contracts/:id", method: "PATCH", resourceKey: "contractId" },
  { path: "/api/contracts/:id/amendments", method: "GET", resourceKey: "contractId" },
  { path: "/api/contracts/:id/documents", method: "POST", resourceKey: "contractId" },
  { path: "/api/contracts/:id/participants", method: "POST", resourceKey: "contractId" },
  { path: "/api/owners/:id", method: "GET", resourceKey: "clientId" },
  { path: "/api/tenants/:id", method: "GET", resourceKey: "clientId" },
  { path: "/api/properties/:id/co-owners", method: "GET", resourceKey: "propertyId" },
  { path: "/api/properties/:id/features", method: "GET", resourceKey: "propertyId" },
  { path: "/api/properties/:id/rooms", method: "GET", resourceKey: "propertyId" },
];

interface ListCheck {
  path: string;
  expectAbsentKey: keyof Pick<TestAgency, "propertyId" | "clientId" | "contractId">;
}

const LIST_CHECKS: ListCheck[] = [
  { path: "/api/properties", expectAbsentKey: "propertyId" },
  { path: "/api/clients", expectAbsentKey: "clientId" },
  { path: "/api/contracts", expectAbsentKey: "contractId" },
];

async function runChecks(a: TestAgency, b: TestAgency) {
  let pass = 0;
  let fail = 0;
  const failures: string[] = [];

  // Cross-agency detail access — agency A cookie targeting agency B IDs → expect 404
  for (const check of CROSS_CHECKS) {
    const url = APP_BASE + check.path.replace(":id", b[check.resourceKey]);
    const res = await fetch(url, {
      method: check.method,
      headers: {
        Cookie: a.cookie,
        "Content-Type": "application/json",
      },
      body: check.method !== "GET" ? "{}" : undefined,
    });
    const ok = res.status === 404;
    const tag = `${check.method.padEnd(6)} ${check.path.padEnd(48)}`;
    if (ok) {
      console.log(`  OK   ${tag} → 404`);
      pass++;
    } else {
      console.log(`  FAIL ${tag} → ${res.status} (expected 404)`);
      failures.push(`${check.method} ${check.path} → ${res.status}`);
      fail++;
    }
  }

  // Listing endpoints — agency A's listing must NOT contain agency B's IDs
  for (const check of LIST_CHECKS) {
    const res = await fetch(APP_BASE + check.path, {
      headers: { Cookie: a.cookie },
    });
    const body = await res.text();
    const leakedId = b[check.expectAbsentKey];
    const leaked = body.includes(leakedId);
    const tag = `GET    ${check.path.padEnd(48)}`;
    if (!leaked && res.ok) {
      console.log(`  OK   ${tag} → no leak of ${check.expectAbsentKey}`);
      pass++;
    } else if (leaked) {
      console.log(`  FAIL ${tag} → leaked ${check.expectAbsentKey} (${leakedId})`);
      failures.push(`${check.path} leaked ${check.expectAbsentKey}`);
      fail++;
    } else {
      console.log(`  FAIL ${tag} → ${res.status}`);
      failures.push(`${check.path} → ${res.status}`);
      fail++;
    }
  }

  return { pass, fail, failures };
}

async function main() {
  console.log("=== SEC-3 cross-agency validation ===");
  console.log(`Target: ${APP_BASE}`);
  console.log(`Branch: ${TEST_DB_URL!.replace(/:[^@]*@/, ":***@")}`);
  console.log("");

  console.log("Setting up agency A...");
  const agencyA = await setupAgency("a", "A");
  console.log(`  agencyA = ${agencyA.agencyId}`);
  console.log(`  user A  = ${agencyA.email} (${agencyA.userId})`);
  console.log(`  data    = client ${agencyA.clientId}, property ${agencyA.propertyId}, contract ${agencyA.contractId}`);
  console.log("");

  console.log("Setting up agency B...");
  const agencyB = await setupAgency("b", "B");
  console.log(`  agencyB = ${agencyB.agencyId}`);
  console.log(`  user B  = ${agencyB.email} (${agencyB.userId})`);
  console.log(`  data    = client ${agencyB.clientId}, property ${agencyB.propertyId}, contract ${agencyB.contractId}`);
  console.log("");

  console.log("Running cross-agency checks (cookieA → agencyB resources):");
  const a2b = await runChecks(agencyA, agencyB);
  console.log("");

  console.log("Running cross-agency checks (cookieB → agencyA resources):");
  const b2a = await runChecks(agencyB, agencyA);
  console.log("");

  const totalPass = a2b.pass + b2a.pass;
  const totalFail = a2b.fail + b2a.fail;
  const allFailures = [...a2b.failures, ...b2a.failures];

  console.log("=".repeat(50));
  console.log(`Results: ${totalPass} passed, ${totalFail} failed`);
  if (totalFail > 0) {
    console.log("");
    console.log("Failures:");
    for (const f of allFailures) console.log(`  - ${f}`);
  }
  console.log("");

  await pool.end();
  process.exit(totalFail === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error("Script error:", err);
  await pool.end().catch(() => {});
  process.exit(2);
});
