import { preparedViteSample } from '../fixtures/preparedViteSample'
import type { ProjectSource } from './types'

export const bundledSampleProjectSource: ProjectSource = {
  id: 'prepared-vite-sample',
  kind: 'bundled-sample',
  label: 'Prepared React/Vite sample',
  load: async () => preparedViteSample,
}
