const preferredModels = ['gpt-5.4-mini', 'gpt-5.4']

export function resolveCompatibleModel(discovered: string[], saved?: string) {
  if (saved && discovered.includes(saved)) return saved
  return preferredModels.find((candidate) => discovered.includes(candidate))
}
