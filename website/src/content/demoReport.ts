export type DemoReport = {
  overview: { title: string; copy: string; items: Array<{ title: string; detail: string }> }
  guide: { title: string; copy: string; items: string[] }
}

/** Conceptual public-demo content. It is not an analysed repository. */
export const demoReport: DemoReport = {
  overview: {
    title: 'A mental model, first',
    copy: 'Start with purpose, flow, major areas, and the files that support each explanation.',
    items: [
      { title: 'Purpose', detail: 'What the project is here to do.' },
      { title: 'Flow', detail: 'Where execution begins and how information moves.' },
      { title: 'Areas', detail: 'Which parts own which responsibilities.' },
      { title: 'Reading path', detail: 'What to inspect first and why.' }
    ]
  },
  guide: {
    title: 'Depth without losing the thread',
    copy: 'The Complete Guide keeps architecture, setup, dependencies, edge cases, and learning order in one structured place.',
    items: ['Architecture and entry points', 'A file-by-file walkthrough', 'Dependencies and setup context', 'Known gaps and edge cases', 'A practical learning order']
  }
}
