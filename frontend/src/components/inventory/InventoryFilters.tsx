'use client';

import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { InventoryCategory, InventoryLocation } from '@/types';

interface InventoryFiltersProps {
  search: string;
  onSearchChange: (v: string) => void;
  statusFilter: string;
  onStatusChange: (v: string) => void;
  categoryId: string;
  onCategoryChange: (v: string) => void;
  locationId: string;
  onLocationChange: (v: string) => void;
  categories: InventoryCategory[];
  locations: InventoryLocation[];
}

export function InventoryFilters({
  search,
  onSearchChange,
  statusFilter,
  onStatusChange,
  categoryId,
  onCategoryChange,
  locationId,
  onLocationChange,
  categories,
  locations,
}: InventoryFiltersProps) {
  return (
    <div className="flex flex-wrap gap-3">
      <div className="relative flex-1 min-w-48 max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <Input
          placeholder="Search items..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 h-9 bg-white text-sm"
        />
      </div>

      <Select value={statusFilter} onValueChange={(v) => onStatusChange(v ?? 'all')}>
        <SelectTrigger className="h-9 w-40 text-sm bg-white">
          <SelectValue placeholder="All statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="in_stock">In Stock</SelectItem>
          <SelectItem value="low_stock">Low Stock</SelectItem>
          <SelectItem value="out_of_stock">Out of Stock</SelectItem>
        </SelectContent>
      </Select>

      <Select value={categoryId} onValueChange={(v) => onCategoryChange(v ?? 'all')}>
        <SelectTrigger className="h-9 w-44 text-sm bg-white">
          <SelectValue placeholder="All categories" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All categories</SelectItem>
          {categories.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={locationId} onValueChange={(v) => onLocationChange(v ?? 'all')}>
        <SelectTrigger className="h-9 w-44 text-sm bg-white">
          <SelectValue placeholder="All locations" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All locations</SelectItem>
          {locations.map((l) => (
            <SelectItem key={l.id} value={l.id}>
              {l.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
