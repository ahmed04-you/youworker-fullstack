'use client'

import { useState } from 'react'
import { SettingsSection, SettingItem } from '@/src/components/settings/SettingsSection'
import { GlassButton } from '@/src/components/ui/glass/GlassButton'
import { useSettings } from '@/src/lib/hooks/useSettings'
import { availableModels } from '@/src/lib/data/models'
import { useTranslations } from '@/src/lib/i18n/provider'
import {
  Palette,
  MessageSquare,
  Shield,
  Info,
  Sun,
  Moon,
  Type,
  Trash2,
  Download,
  AlertTriangle
} from 'lucide-react'

export default function SettingsPage() {
  const { settings, updateSettings, clearChatHistory, exportData } = useSettings()
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const t = useTranslations()

  const handleClearHistory = () => {
    if (clearChatHistory()) {
      setShowClearConfirm(false)
      // Show success notification (you could add a toast here)
      alert(t('settings.clearSuccess'))
    } else {
      alert(t('settings.clearFailed'))
    }
  }

  const handleExportData = () => {
    if (exportData()) {
      alert(t('settings.exportSuccess'))
    } else {
      alert(t('settings.exportFailed'))
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">{t('settings.title')}</h1>
          <p className="text-white/60">{t('settings.subtitle')}</p>
        </div>

        {/* Appearance Section */}
        <SettingsSection
          title={t('settings.appearance')}
          description={t('settings.appearanceDescription')}
          icon={<Palette className="w-5 h-5 text-white" />}
        >
          <SettingItem
            label={t('settings.theme')}
            description={t('settings.themeDescription')}
          >
            <div className="flex gap-2">
              <GlassButton
                variant={settings.theme === 'light' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => updateSettings({ theme: 'light' })}
                icon={<Sun className="w-4 h-4" />}
              >
                {t('settings.light')}
              </GlassButton>
              <GlassButton
                variant={settings.theme === 'dark' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => updateSettings({ theme: 'dark' })}
                icon={<Moon className="w-4 h-4" />}
              >
                {t('settings.dark')}
              </GlassButton>
            </div>
          </SettingItem>

          <SettingItem
            label="Font Size"
            description="Adjust text size across the app"
          >
            <div className="flex gap-2">
              {(['small', 'medium', 'large'] as const).map((size) => (
                <GlassButton
                  key={size}
                  variant={settings.fontSize === size ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => updateSettings({ fontSize: size })}
                  icon={<Type className="w-4 h-4" />}
                >
                  {size.charAt(0).toUpperCase() + size.slice(1)}
                </GlassButton>
              ))}
            </div>
          </SettingItem>

          <SettingItem
            label="Language"
            description="Select your preferred language"
          >
            <select
              value={settings.language}
              onChange={(e) => updateSettings({ language: e.target.value })}
              className="px-3 py-2 rounded-lg bg-[#454055]/50 text-white border border-[var(--color-glass-dark)] focus:outline-none focus:ring-2 focus:ring-[#E32D21] text-sm"
            >
              <option value="en">English</option>
              <option value="es">Español</option>
              <option value="fr">Français</option>
              <option value="de">Deutsch</option>
              <option value="zh">中文</option>
              <option value="it">Italiano</option>
            </select>
          </SettingItem>
        </SettingsSection>

        {/* Chat Section */}
        <SettingsSection
          title="Chat"
          description="Configure chat behavior and preferences"
          icon={<MessageSquare className="w-5 h-5 text-white" />}
        >
          <SettingItem
            label="Default Model"
            description="Choose the AI model to use by default"
          >
            <select
              value={settings.defaultModelId}
              onChange={(e) => updateSettings({ defaultModelId: e.target.value })}
              className="px-3 py-2 rounded-lg bg-[#454055]/50 text-white border border-[var(--color-glass-dark)] focus:outline-none focus:ring-2 focus:ring-[#E32D21] text-sm min-w-[200px]"
            >
              {availableModels.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </select>
          </SettingItem>

          <SettingItem
            label="Message History Length"
            description="Number of messages to keep in history"
          >
            <select
              value={settings.messageHistoryLength}
              onChange={(e) => updateSettings({ messageHistoryLength: Number(e.target.value) })}
              className="px-3 py-2 rounded-lg bg-[#454055]/50 text-white border border-[var(--color-glass-dark)] focus:outline-none focus:ring-2 focus:ring-[#E32D21] text-sm"
            >
              <option value={25}>25 messages</option>
              <option value={50}>50 messages</option>
              <option value={100}>100 messages</option>
              <option value={200}>200 messages</option>
            </select>
          </SettingItem>

          <SettingItem
            label="Auto-scroll"
            description="Automatically scroll to new messages"
          >
            <button
              onClick={() => updateSettings({ autoScroll: !settings.autoScroll })}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                settings.autoScroll ? 'bg-[#E32D21]' : 'bg-[#454055]/50'
              }`}
            >
              <div
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                  settings.autoScroll ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </SettingItem>

          <SettingItem
            label="Sound Notifications"
            description="Play sound when receiving messages"
          >
            <button
              onClick={() => updateSettings({ soundNotifications: !settings.soundNotifications })}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                settings.soundNotifications ? 'bg-[#E32D21]' : 'bg-[#454055]/50'
              }`}
            >
              <div
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                  settings.soundNotifications ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </SettingItem>
        </SettingsSection>

        {/* Privacy Section */}
        <SettingsSection
          title="Privacy & Data"
          description="Manage your data and privacy settings"
          icon={<Shield className="w-5 h-5 text-white" />}
        >
          <SettingItem
            label="Export Data"
            description="Download your settings and data"
          >
            <GlassButton
              variant="secondary"
              size="sm"
              onClick={handleExportData}
              icon={<Download className="w-4 h-4" />}
            >
              Export
            </GlassButton>
          </SettingItem>

          <SettingItem
            label="Clear Chat History"
            description="Delete all chat conversations"
          >
            {showClearConfirm ? (
              <div className="flex gap-2">
                <GlassButton
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowClearConfirm(false)}
                >
                  Cancel
                </GlassButton>
                <GlassButton
                  variant="primary"
                  size="sm"
                  onClick={handleClearHistory}
                  className="bg-red-500 hover:bg-red-600"
                  icon={<Trash2 className="w-4 h-4" />}
                >
                  Confirm
                </GlassButton>
              </div>
            ) : (
              <GlassButton
                variant="secondary"
                size="sm"
                onClick={() => setShowClearConfirm(true)}
                icon={<Trash2 className="w-4 h-4" />}
              >
                Clear
              </GlassButton>
            )}
          </SettingItem>

          <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-yellow-200 font-medium mb-1">Warning</p>
              <p className="text-xs text-yellow-200/70">
                Clearing chat history is permanent and cannot be undone. Make sure to export your data first if needed.
              </p>
            </div>
          </div>
        </SettingsSection>

        {/* About Section */}
        <SettingsSection
          title="About"
          description="Information about YouWorker AI"
          icon={<Info className="w-5 h-5 text-white" />}
        >
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-white/70">Version</span>
              <span className="text-sm font-medium text-white">2.0.0</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-white/70">Build</span>
              <span className="text-sm font-mono text-white">2025.10.30</span>
            </div>
            <div className="pt-3 border-t border-[var(--color-glass-dark)]">
              <p className="text-xs text-white/50 mb-2">
                YouWorker AI - Your intelligent assistant for work and creativity
              </p>
              <div className="flex gap-2">
                <a
                  href="https://docs.youworker.ai"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[#E32D21] hover:text-[#E32D21]/80 transition-colors"
                >
                  Documentation
                </a>
                <span className="text-white/30">•</span>
                <a
                  href="https://github.com/youworker-ai"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[#E32D21] hover:text-[#E32D21]/80 transition-colors"
                >
                  GitHub
                </a>
                <span className="text-white/30">•</span>
                <a
                  href="mailto:support@youworker.ai"
                  className="text-xs text-[#E32D21] hover:text-[#E32D21]/80 transition-colors"
                >
                  Support
                </a>
              </div>
            </div>
          </div>
        </SettingsSection>
      </div>
    </div>
  )
}
