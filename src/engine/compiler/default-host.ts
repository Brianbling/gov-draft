import type { HostSelectors } from './types'

export const DEFAULT_HOST: HostSelectors = {
  rootContent: ['.preview-content', '.export-document'],
  paperSheet: ['.paper-sheet'],
  exportDocument: ['.export-document'],
  appShell: ['#app', '.app-shell'],
  printContainer: ['.preview-content'],
  paperContent: ['.paper-sheet.preview-content', '.export-document'],
}
