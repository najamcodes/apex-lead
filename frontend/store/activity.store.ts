// src/store/activity.store.ts
import { create } from 'zustand'
import type { ActivityRecord } from '../../shared/types/activity.types'
import { api } from '../services/api'

interface ActivityState {
  activities: ActivityRecord[]
  isLoading: boolean
  fetchActivity: (leadId: number) => Promise<void>
}

export const useActivityStore = create<ActivityState>((set) => ({
  activities: [],
  isLoading: false,

  fetchActivity: async (leadId) => {
    set({ isLoading: true })
    const activities = await api.activity.get(leadId)
    set({ activities, isLoading: false })
  }
}))
