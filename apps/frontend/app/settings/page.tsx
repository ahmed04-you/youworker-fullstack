"use client"

import { useState } from "react"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Save, Key, Palette, Volume2, Bell, Zap } from "lucide-react"
import { toast } from "sonner"
import { useTheme } from "next-themes"

export default function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const [apiKey, setApiKey] = useState("")
  const [notifications, setNotifications] = useState(true)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [voiceSpeed, setVoiceSpeed] = useState([1.0])
  const [autoSave, setAutoSave] = useState(true)

  const handleSaveSettings = () => {
    toast.success("Settings saved successfully")
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex flex-col flex-1 md:ml-72">
        <Header />
        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-4xl mx-auto space-y-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
              <p className="text-muted-foreground mt-2">
                Manage your preferences and application settings
              </p>
            </div>

            <Tabs defaultValue="general" className="space-y-4">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="general">General</TabsTrigger>
                <TabsTrigger value="api">API</TabsTrigger>
                <TabsTrigger value="appearance">Appearance</TabsTrigger>
                <TabsTrigger value="voice">Voice</TabsTrigger>
              </TabsList>

              {/* General Settings */}
              <TabsContent value="general" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>General Settings</CardTitle>
                    <CardDescription>
                      Configure your general application preferences
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-base">Notifications</Label>
                        <div className="text-sm text-muted-foreground">
                          Receive notifications for new messages and events
                        </div>
                      </div>
                      <Switch
                        checked={notifications}
                        onCheckedChange={setNotifications}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-base">Sound Effects</Label>
                        <div className="text-sm text-muted-foreground">
                          Play sound effects for interactions
                        </div>
                      </div>
                      <Switch
                        checked={soundEnabled}
                        onCheckedChange={setSoundEnabled}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-base">Auto-save Conversations</Label>
                        <div className="text-sm text-muted-foreground">
                          Automatically save your chat history
                        </div>
                      </div>
                      <Switch
                        checked={autoSave}
                        onCheckedChange={setAutoSave}
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* API Settings */}
              <TabsContent value="api" className="space-y-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Key className="h-5 w-5" />
                      <div>
                        <CardTitle>API Configuration</CardTitle>
                        <CardDescription>
                          Manage your API keys and connection settings
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="api-key">API Key</Label>
                      <Input
                        id="api-key"
                        type="password"
                        placeholder="Enter your API key"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                      />
                      <p className="text-sm text-muted-foreground">
                        Your API key is stored securely and never shared
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="api-url">API URL</Label>
                      <Input
                        id="api-url"
                        placeholder="http://localhost:8001"
                        defaultValue={process.env.NEXT_PUBLIC_API_URL}
                        disabled
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="ws-url">WebSocket URL</Label>
                      <Input
                        id="ws-url"
                        placeholder="ws://localhost:8001/ws"
                        defaultValue={process.env.NEXT_PUBLIC_WS_URL}
                        disabled
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Appearance Settings */}
              <TabsContent value="appearance" className="space-y-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Palette className="h-5 w-5" />
                      <div>
                        <CardTitle>Appearance</CardTitle>
                        <CardDescription>
                          Customize the look and feel of the application
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <Label>Theme</Label>
                      <Select value={theme} onValueChange={setTheme}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select theme" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="light">Light</SelectItem>
                          <SelectItem value="dark">Dark</SelectItem>
                          <SelectItem value="system">System</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-sm text-muted-foreground">
                        Choose your preferred color scheme
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label>Font Size</Label>
                      <Select defaultValue="medium">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="small">Small</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="large">Large</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Compact Mode</Label>
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-muted-foreground">
                          Reduce spacing between elements
                        </div>
                        <Switch />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Voice Settings */}
              <TabsContent value="voice" className="space-y-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Volume2 className="h-5 w-5" />
                      <div>
                        <CardTitle>Voice Settings</CardTitle>
                        <CardDescription>
                          Configure speech-to-text and text-to-speech
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <Label>Voice Model</Label>
                      <Select defaultValue="default">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="default">Default Voice</SelectItem>
                          <SelectItem value="female">Female Voice</SelectItem>
                          <SelectItem value="male">Male Voice</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label>Speech Speed</Label>
                        <span className="text-sm text-muted-foreground">
                          {voiceSpeed[0].toFixed(1)}x
                        </span>
                      </div>
                      <Slider
                        value={voiceSpeed}
                        onValueChange={setVoiceSpeed}
                        min={0.5}
                        max={2.0}
                        step={0.1}
                        className="w-full"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-base">Auto-play Responses</Label>
                        <div className="text-sm text-muted-foreground">
                          Automatically speak AI responses
                        </div>
                      </div>
                      <Switch />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-base">Voice Input</Label>
                        <div className="text-sm text-muted-foreground">
                          Enable voice commands and dictation
                        </div>
                      </div>
                      <Switch defaultChecked />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {/* Save Button */}
            <div className="flex justify-end">
              <Button onClick={handleSaveSettings} size="lg">
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}