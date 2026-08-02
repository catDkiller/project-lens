export type DemoReport = { title: string; summary: string; guide: string[]; areas: Array<{ title: string; detail: string; file: string }>; evidence: string[]; unknowns: string[] }

/** Public, manually reviewed extract of a preserved report; no runtime snapshot is shipped. */
export const demoReport: DemoReport = {
  title: 'Face Averaging',
  summary: 'A small OpenCV and MediaPipe pipeline that finds facial landmarks, aligns photos by the eyes, and averages the aligned faces into one composite image.',
  guide: [
    'The project is a three-step image-processing pipeline: inspect landmarks, normalize each face, then average matching pixels.',
    'Alignment is the key dependency. The pipeline uses eye landmarks as anchors so every face lands at a comparable angle and scale before blending.',
    'Start with landmark extraction, then read the alignment script, and finally inspect the averaging export step.'
  ],
  areas: [
    { title: 'Landmark extraction', detail: 'Inspects MediaPipe Face Mesh coordinates for each usable image.', file: 'Face Averaging/face_landmark_extractor.py' },
    { title: 'Alignment and normalization', detail: 'Uses eye landmarks to rotate, scale, and crop faces into a shared frame.', file: 'Face Averaging/align_faces.py' },
    { title: 'Averaging and export', detail: 'Combines normalized image pixels and writes the composite face.', file: 'Face Averaging/average_faces.py' }
  ],
  evidence: ['images/ → aligned_faces/ → average_face.jpg', 'Eye landmarks 33 and 263 anchor the alignment step.', 'The report separates confirmed file facts from inferred setup details.'],
  unknowns: ['The snapshot did not include a README or command-line interface, so the exact intended invocation needs local verification.']
}
