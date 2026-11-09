/** All ways to choose `size` items, keeping their original order. */
export function combinations<T>(items: readonly T[], size: number): T[][] {
  if (size === 0) return [[]];

  const result: T[][] = [];
  const indices = Array.from({ length: size }, (_, i) => i);
  if (size > items.length) return result;

  while (true) {
    result.push(indices.map((i) => items[i]));

    let position = size - 1;
    while (position >= 0 && indices[position] === items.length - size + position) position--;
    if (position < 0) return result;

    indices[position]++;
    for (let next = position + 1; next < size; next++) {
      indices[next] = indices[next - 1] + 1;
    }
  }
}
