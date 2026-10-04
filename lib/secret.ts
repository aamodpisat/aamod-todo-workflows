export async function digest(value: string): Promise<Uint8Array> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return new Uint8Array(hash);
}

export async function secretsMatch(input: string, expected: string | undefined): Promise<boolean> {
  if (!expected) return false;
  const [left, right] = await Promise.all([digest(input), digest(expected)]);
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}
