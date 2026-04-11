type RunClientMutationOptions<T> = {
  execute: () => Promise<T>
  onSuccess?: (result: T) => void | Promise<void>
  onError?: (message: string) => void | Promise<void>
  onSettled?: () => void | Promise<void>
  errorMessage: string
}

export async function runClientMutation<T>({
  execute,
  onSuccess,
  onError,
  onSettled,
  errorMessage,
}: RunClientMutationOptions<T>) {
  try {
    const result = await execute()
    await onSuccess?.(result)
    return result
  } catch {
    await onError?.(errorMessage)
    return null
  } finally {
    await onSettled?.()
  }
}

export async function expectOk(response: Response, errorMessage: string) {
  if (!response.ok) {
    throw new Error(errorMessage)
  }

  return response
}
