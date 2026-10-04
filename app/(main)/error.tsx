"use client";

export default function Error({ error }: { error: Error }) {
  return <p style={{ padding: 28 }}>{error.message}</p>;
}
