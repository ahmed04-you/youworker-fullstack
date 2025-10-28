'use client';

import { lazy, Suspense } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const DocumentList = lazy(() => import('@/features/documents/components/DocumentList').then(mod => ({ default: mod.DocumentList })));
const IngestionHistory = lazy(() => import('@/features/documents/components/IngestionHistory').then(mod => ({ default: mod.IngestionHistory })));

function DocumentListSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(5)].map((_, i) => (
        <Skeleton key={i} className="h-24" />
      ))}
    </div>
  );
}

export default function DocumentsPage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Document Management</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="list" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="list">Documents</TabsTrigger>
              <TabsTrigger value="history">Ingestion History</TabsTrigger>
            </TabsList>
            <TabsContent value="list" className="mt-6">
              <Suspense fallback={<DocumentListSkeleton />}>
                <DocumentList />
              </Suspense>
            </TabsContent>
            <TabsContent value="history" className="mt-6">
              <Suspense fallback={<DocumentListSkeleton />}>
                <IngestionHistory limit={20} />
              </Suspense>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
