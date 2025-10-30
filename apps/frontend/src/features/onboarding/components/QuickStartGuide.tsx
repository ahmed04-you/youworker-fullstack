"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  MessageSquare,
  FileText,
  Settings,
  Sparkles,
  Upload,
  Keyboard,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

interface QuickStartItem {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    href: string;
  };
}

const quickStartItems: QuickStartItem[] = [
  {
    icon: <MessageSquare className="h-6 w-6" />,
    title: "Start a Conversation",
    description: "Begin chatting with the AI assistant. Ask questions, request plans, or brainstorm ideas.",
    action: {
      label: "Go to Chat",
      href: "/",
    },
  },
  {
    icon: <Upload className="h-6 w-6" />,
    title: "Upload Documents",
    description: "Upload PDFs, text files, images, and audio to use in your conversations. Press Cmd+U anywhere.",
    action: {
      label: "Upload Files",
      href: "/documents",
    },
  },
  {
    icon: <Sparkles className="h-6 w-6" />,
    title: "Enable Tools",
    description: "Activate tools like web search and code execution to enhance your conversations.",
  },
  {
    icon: <Keyboard className="h-6 w-6" />,
    title: "Learn Keyboard Shortcuts",
    description: "Press ? or Cmd+/ to see all available keyboard shortcuts and boost your productivity.",
  },
  {
    icon: <Zap className="h-6 w-6" />,
    title: "Command Palette",
    description: "Press Cmd+K to quickly navigate, search sessions, or perform actions.",
  },
  {
    icon: <FileText className="h-6 w-6" />,
    title: "Manage Documents",
    description: "View, search, and manage all your uploaded documents in one place.",
    action: {
      label: "View Documents",
      href: "/documents",
    },
  },
  {
    icon: <Settings className="h-6 w-6" />,
    title: "Customize Settings",
    description: "Personalize your experience with theme, language, and other preferences.",
    action: {
      label: "Open Settings",
      href: "/settings",
    },
  },
];

export function QuickStartGuide() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
      },
    },
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="space-y-2"
      >
        <h2 className="text-3xl font-bold tracking-tight">Quick Start Guide</h2>
        <p className="text-muted-foreground">
          Get started with YouWorker.AI. Here are the key features and how to use them.
        </p>
      </motion.div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
      >
        {quickStartItems.map((item, index) => (
          <motion.div key={index} variants={itemVariants}>
            <Card className="hover:shadow-lg transition-shadow h-full">
              <CardHeader>
                <div className="flex items-start gap-4">
                  <div className="rounded-lg bg-primary/10 p-2 text-primary">
                    {item.icon}
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-lg">{item.title}</CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <CardDescription className="text-sm leading-relaxed">
                  {item.description}
                </CardDescription>
                {item.action && (
                  <Button variant="outline" size="sm" asChild className="w-full">
                    <Link href={item.action.href}>
                      {item.action.label}
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8, duration: 0.5 }}
      >
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Pro Tip
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Use the Command Palette (Cmd+K) to quickly access any feature without leaving your keyboard.
              It's the fastest way to navigate and perform actions in YouWorker.AI.
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
