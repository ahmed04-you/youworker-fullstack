"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, ExternalLink, Video } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Tutorial {
  id: string;
  title: string;
  description: string;
  duration: string;
  thumbnail?: string;
  videoUrl?: string;
}

const tutorials: Tutorial[] = [
  {
    id: "getting-started",
    title: "Getting Started with YouWorker.AI",
    description: "Learn the basics of using YouWorker.AI, from starting conversations to uploading documents.",
    duration: "3:45",
    thumbnail: "/tutorials/getting-started.png",
  },
  {
    id: "advanced-features",
    title: "Advanced Features",
    description: "Discover tools and keyboard shortcuts to supercharge your productivity.",
    duration: "5:20",
    thumbnail: "/tutorials/advanced-features.png",
  },
  {
    id: "document-management",
    title: "Document Management",
    description: "Learn how to upload, organize, and use documents effectively in your conversations.",
    duration: "4:15",
    thumbnail: "/tutorials/document-management.png",
  },
];

export function TutorialVideo() {
  const [selectedTutorial, setSelectedTutorial] = useState<Tutorial | null>(null);

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
    hidden: { opacity: 0, scale: 0.9 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        duration: 0.4,
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
        <h2 className="text-3xl font-bold tracking-tight">Video Tutorials</h2>
        <p className="text-muted-foreground">
          Watch these short videos to learn how to make the most of YouWorker.AI.
        </p>
      </motion.div>

      <AnimatePresence mode="wait">
        {selectedTutorial ? (
          <motion.div
            key="selected"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{selectedTutorial.title}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedTutorial(null)}
                  >
                    Back to List
                  </Button>
                </CardTitle>
                <CardDescription>{selectedTutorial.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                  <div className="text-center space-y-4">
                    <Video className="h-16 w-16 mx-auto text-muted-foreground" />
                    <p className="text-muted-foreground">
                      Video tutorial placeholder
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Duration: {selectedTutorial.duration}
                    </p>
                    {selectedTutorial.videoUrl && (
                      <Button variant="outline" size="sm" asChild>
                        <a
                          href={selectedTutorial.videoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Watch on External Site
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <motion.div
            key="list"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit={{ opacity: 0 }}
            className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
          >
            {tutorials.map((tutorial) => (
              <motion.div key={tutorial.id} variants={itemVariants}>
                <Card
                  className="cursor-pointer hover:shadow-lg transition-shadow h-full"
                  onClick={() => setSelectedTutorial(tutorial)}
                >
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Play className="h-5 w-5 text-primary" />
                      {tutorial.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                      {tutorial.thumbnail ? (
                        <img
                          src={tutorial.thumbnail}
                          alt={tutorial.title}
                          className="w-full h-full object-cover rounded-lg"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                            e.currentTarget.parentElement!.innerHTML = `
                              <div class="flex flex-col items-center justify-center space-y-2">
                                <svg class="h-12 w-12 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <circle cx="12" cy="12" r="10" />
                                  <polygon points="10 8 16 12 10 16 10 8" />
                                </svg>
                              </div>
                            `;
                          }}
                        />
                      ) : (
                        <div className="flex flex-col items-center space-y-2">
                          <Play className="h-12 w-12 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {tutorial.duration}
                          </span>
                        </div>
                      )}
                    </div>
                    <CardDescription className="text-sm">
                      {tutorial.description}
                    </CardDescription>
                    <div className="flex items-center justify-between pt-2">
                      <span className="text-xs text-muted-foreground">
                        {tutorial.duration}
                      </span>
                      <Button variant="ghost" size="sm">
                        <Play className="mr-2 h-3 w-3" />
                        Watch
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.5 }}
      >
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ExternalLink className="h-5 w-5" />
              Need More Help?
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Visit our documentation or contact support for additional assistance.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" asChild>
                <a href="/docs" target="_blank" rel="noopener noreferrer">
                  View Documentation
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href="/support" target="_blank" rel="noopener noreferrer">
                  Contact Support
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
