import { storeKnowledge } from "./knowledge/store.ts";
import { searchKnowledge } from "./knowledge/retrieve.ts";

async function test() {
  await storeKnowledge({
    id: "550e8400-e29b-41d4-a716-446655440000",
    type: "error",
    content: "Login API returned 401 unauthorized",
    run_id: "run-001",
    metadata: {
      endpoint: "/login",
      status: 401,
      env: "local",
      app_version: "1.0",
      timestamp: new Date().toISOString()
    }
  });

  const res = await searchKnowledge("login error");

  console.log("🔍 Search result:", res);
}

test();
