import type { AnalysisEventDto } from '../local-api/contracts'

export function mergeRunEvents(current: AnalysisEventDto[], incoming: AnalysisEventDto[]) {
  const bySequence = new Map<number, AnalysisEventDto>(); const withoutSequence: AnalysisEventDto[] = []
  for (const event of [...current, ...incoming]) { if (event.sequence === undefined) withoutSequence.push(event); else bySequence.set(event.sequence, event) }
  return [...bySequence.values(), ...withoutSequence.filter((event, index, all) => index === all.findIndex((candidate) => candidate.id === event.id))].sort((left, right) => (left.sequence ?? Number.MAX_SAFE_INTEGER) - (right.sequence ?? Number.MAX_SAFE_INTEGER))
}
