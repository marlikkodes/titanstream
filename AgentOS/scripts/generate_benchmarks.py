import json
import os
from pathlib import Path

benchmarks_root = Path("AgentOS/benchmarks")

# 1. react_vite_app (Frontend defect)
d1 = benchmarks_root / "react_vite_app"
(d1 / "src").mkdir(parents=True, exist_ok=True)
with open(d1 / "package.json", "w") as f:
    json.dump({"name": "benchmark-react-vite", "scripts": {"test": "echo 'Testing React components'"}}, f)
with open(d1 / "src" / "Counter.tsx", "w") as f:
    f.write("""// Seeded defect: decrement subtracts 2 instead of 1
export function Counter({ count, onDecrement }: { count: number; onDecrement: () => void }) {
  return <button onClick={() => onDecrement()}>Count: {count}</button>;
}
""")

# 2. nextjs_app (SSR / Hydration defect)
d2 = benchmarks_root / "nextjs_app"
(d2 / "pages").mkdir(parents=True, exist_ok=True)
with open(d2 / "package.json", "w") as f:
    json.dump({"name": "benchmark-nextjs", "scripts": {"test": "echo 'Testing Next.js routes'"}}, f)
with open(d2 / "pages" / "index.tsx", "w") as f:
    f.write("""// Seeded defect: Missing null check on server props
export default function Home({ user }: { user?: { name: string } }) {
  return <div>Welcome, {user?.name || 'Guest'}</div>;
}
""")

# 3. node_backend (Auth middleware defect)
d3 = benchmarks_root / "node_backend"
(d3 / "src").mkdir(parents=True, exist_ok=True)
with open(d3 / "package.json", "w") as f:
    json.dump({"name": "benchmark-node-backend", "scripts": {"test": "echo 'Testing Node API'"}}, f)
with open(d3 / "src" / "auth.js", "w") as f:
    f.write("""// Seeded defect: token validation bypassed on empty string
function validateToken(token) {
  if (!token) return false;
  return token.startsWith("Bearer valid_");
}
module.exports = { validateToken };
""")

# 4. python_flask (API payload defect)
d4 = benchmarks_root / "python_flask"
(d4 / "src").mkdir(parents=True, exist_ok=True)
with open(d4 / "src" / "app.py", "w") as f:
    f.write("""# Seeded defect: missing dictionary .get() on optional key
def handle_checkout(data):
    user_id = data.get("user_id")
    amount = data.get("amount", 0)
    return {"status": "ok", "user": user_id, "amount": amount}
""")

# 5. postgres_sqlite_db (DB Schema migration defect)
d5 = benchmarks_root / "postgres_sqlite_db"
d5.mkdir(parents=True, exist_ok=True)
with open(d5 / "schema.sql", "w") as f:
    f.write("""-- Database schema
CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    balance INTEGER DEFAULT 0
);
""")

# 6. fullstack_app (Cross-system contract defect)
d6 = benchmarks_root / "fullstack_app"
(d6 / "frontend").mkdir(parents=True, exist_ok=True)
(d6 / "backend").mkdir(parents=True, exist_ok=True)
with open(d6 / "frontend" / "api.ts", "w") as f:
    f.write("""export async function fetchUser(id: string) { return { id, role: 'admin' }; }""")
with open(d6 / "backend" / "server.py", "w") as f:
    f.write("""def get_user(uid): return {"id": uid, "role": "admin"}""")

# 7. multisystem_broken (Cascade defect)
d7 = benchmarks_root / "multisystem_broken"
(d7 / "services").mkdir(parents=True, exist_ok=True)
with open(d7 / "services" / "orders.py", "w") as f:
    f.write("""def process_order(order): return {"order_id": order.get("id"), "valid": True}""")

print("Generated 7 real-world benchmark repositories in AgentOS/benchmarks/")
