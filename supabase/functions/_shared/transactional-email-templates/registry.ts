/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as clientIntakeInvite } from './client-intake-invite.tsx'
import { template as weeklyClientDigest } from './weekly-client-digest.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'client-intake-invite': clientIntakeInvite,
  'weekly-client-digest': weeklyClientDigest,
}
