/**
 * CollectionsDrawer - Right Sidebar for LocalDocs Collections
 *
 * Specifications:
 * - Collection list with checkboxes
 * - Each item shows checkbox, name, metadata (files, words)
 * - Loading indicator when updating
 * - Footer with "Add Docs" button and instructions
 * - Default state: Hidden
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Checkbox } from '@/components/ui/checkbox';
import { mockCollections, Collection } from '@/lib/utils/mock-data';

interface CollectionItemProps {
  collection: Collection;
  onToggle: (id: string, enabled: boolean) => void;
}

function CollectionItem({ collection, onToggle }: CollectionItemProps) {
  const handleToggle = () => {
    onToggle(collection.id, !collection.isEnabled);
  };

  return (
    <div
      onClick={handleToggle}
      className={cn(
        'flex items-start gap-[10px]',
        'rounded-[var(--radius-standard)]',
        'p-[15px]',
        'cursor-pointer',
        'transition-colors duration-[var(--duration-standard)]',
        collection.isEnabled
          ? 'bg-[var(--bg-collections-button)]'
          : 'bg-transparent hover:bg-[var(--bg-lighter-button)]'
      )}
    >
      {/* Checkbox */}
      <div className="pt-[2px]">
        <Checkbox
          checked={collection.isEnabled}
          onCheckedChange={() => {}} // Handled by parent onClick
          className="h-[20px] w-[20px]"
        />
      </div>

      {/* Content Column */}
      <div className="flex flex-1 flex-col gap-[5px]">
        {/* Collection Name */}
        <div
          className={cn(
            'overflow-hidden text-ellipsis whitespace-nowrap',
            'text-[var(--font-medium)] font-bold',
            'text-[var(--text-color)]'
          )}
        >
          {collection.name}
        </div>

        {/* Metadata */}
        <div
          className={cn(
            'text-[var(--font-small)]',
            'text-[var(--text-muted)]'
          )}
        >
          {collection.filesCount.toLocaleString()} files •{' '}
          {collection.wordsCount.toLocaleString()} words
        </div>
      </div>

      {/* Loading Indicator */}
      {collection.isUpdating && (
        <div className="pt-[2px]">
          <Loader2
            size={16}
            className="animate-spin text-[var(--accent-color)]"
          />
        </div>
      )}
    </div>
  );
}

export function CollectionsDrawer() {
  // In a real app, this would come from a collections store
  const [collections, setCollections] = useState<Collection[]>(mockCollections);

  const handleToggle = (id: string, enabled: boolean) => {
    setCollections(prev =>
      prev.map(col =>
        col.id === id ? { ...col, isEnabled: enabled } : col
      )
    );
  };

  const handleAddDocs = () => {
    // In a real app, this would open a dialog to add new collections
    console.log('Add Docs clicked');
  };

  return (
    <div className="flex h-full flex-col gap-[15px] p-[20px]">
      {/* Collection List */}
      <div className="flex flex-1 flex-col gap-[15px] overflow-y-auto">
        {collections.length > 0 ? (
          collections.map(collection => (
            <CollectionItem
              key={collection.id}
              collection={collection}
              onToggle={handleToggle}
            />
          ))
        ) : (
          <div
            className={cn(
              'flex flex-1 items-center justify-center',
              'text-[var(--font-medium)]',
              'text-[var(--text-muted)]',
              'text-center px-[20px]'
            )}
          >
            No collections available
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex flex-col gap-[15px] border-t border-[var(--border-divider)] pt-[15px]">
        {/* Add Docs Button */}
        <button
          onClick={handleAddDocs}
          className={cn(
            'flex items-center justify-center gap-[10px]',
            'px-[18px] py-[10px]',
            'rounded-[var(--radius-standard)]',
            'bg-[var(--bg-button)]',
            'text-[var(--text-opposite)]',
            'text-[var(--font-large)] font-bold',
            'text-center',
            'transition-colors duration-[var(--duration-standard)]',
            'hover:bg-[var(--bg-button-hover)]',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent-color)]',
            'focus-visible:outline-offset-2'
          )}
        >
          <Plus size={20} />
          Add Docs
        </button>

        {/* Instructions Text */}
        <p
          className={cn(
            'text-[var(--font-small)]',
            'text-[var(--text-muted)]',
            'text-center',
            'leading-[1.4]'
          )}
        >
          Select a collection to make it available to the chat model
        </p>
      </div>
    </div>
  );
}
