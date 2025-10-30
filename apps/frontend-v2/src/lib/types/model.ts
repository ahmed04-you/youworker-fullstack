export type ModelSpeed = 'fast' | 'medium' | 'slow'

export interface Model {
  id: string
  name: string
  description: string
  contextLength: number
  speed: ModelSpeed
  capabilities: string[]
  icon?: string
  isAvailable?: boolean
}

export interface ModelCategory {
  name: string
  models: Model[]
}
