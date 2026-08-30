// Seeded defect: decrement subtracts 2 instead of 1
export function Counter({ count, onDecrement }: { count: number; onDecrement: () => void }) {
  return <button onClick={() => onDecrement()}>Count: {count}</button>;
}
