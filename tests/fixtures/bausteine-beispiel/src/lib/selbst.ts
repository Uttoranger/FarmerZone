/** Bindet nur sich selbst ein. */
export const SELBST = 1

export async function ladeMich(): Promise<unknown> {
  return import('./selbst')
}
