import Link from "next/link";

export default function NotFound() {
  return (
    <div className="page empty">
      <h1>Nothing on this page.</h1>
      <p>
        <Link href="/">Back to the start</Link>
      </p>
    </div>
  );
}
