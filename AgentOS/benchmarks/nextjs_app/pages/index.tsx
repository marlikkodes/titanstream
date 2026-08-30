// Seeded defect: Missing null check on server props
export default function Home({ user }: { user?: { name: string } }) {
  return <div>Welcome, {user?.name || 'Guest'}</div>;
}
