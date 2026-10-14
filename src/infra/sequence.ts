/** @file Sequential async iteration without loops: blocks are summarized oldest first. */

export const inOrder = async <T, R>(
  items: readonly T[],
  fn: (item: T) => Promise<R>,
): Promise<readonly R[]> => {
  const [head, ...rest] = items
  if (head === undefined) return []
  const first = await fn(head)
  return [first, ...(await inOrder(rest, fn))]
}
