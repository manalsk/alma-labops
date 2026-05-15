'use client';

import { useState, useMemo } from 'react';
import { Plus, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { hasPermission } from '@/lib/rbac';
import { useInventory } from '@/hooks/useInventory';
import { InventoryFilters } from '@/components/inventory/InventoryFilters';
import { InventoryTable } from '@/components/inventory/InventoryTable';
import { InventoryDrawer } from '@/components/inventory/InventoryDrawer';
import { ItemFormDialog } from '@/components/inventory/ItemFormDialog';
import { QuantityDialog } from '@/components/inventory/QuantityDialog';
import type { InventoryItem } from '@/types';

export default function InventoryPage() {
  const profile = useUserProfile();
  const { items, locations, categories, loading, error, createItem, updateItem, updateQuantity, deleteItem, fetchActivity } = useInventory();

  // RBAC
  const canManage = hasPermission(profile.role, 'manage_inventory', profile.permissions);
  const canDelete = profile.role === 'pi';

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryId, setCategoryId] = useState('all');
  const [locationId, setLocationId] = useState('all');

  // UI state
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [quantityItem, setQuantityItem] = useState<InventoryItem | null>(null);

  // Filtered items (client-side)
  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (search && !item.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (categoryId !== 'all' && item.category_id !== categoryId) return false;
      if (locationId !== 'all' && item.location_id !== locationId) return false;
      return true;
    });
  }, [items, search, statusFilter, categoryId, locationId]);

  const lowStockCount = useMemo(
    () => items.filter((i) => i.status === 'low_stock' || i.status === 'out_of_stock').length,
    [items]
  );

  const handleRowClick = (item: InventoryItem) => {
    setSelectedItem(item);
    setDrawerOpen(true);
  };

  const handleFormSubmit = async (data: Parameters<typeof createItem>[0] | Parameters<typeof updateItem>[1]) => {
    try {
      if (editingItem) {
        const updated = await updateItem(editingItem.id, data as Parameters<typeof updateItem>[1]);
        toast.success('Item updated');
        if (selectedItem?.id === editingItem.id) {
          setSelectedItem(updated);
        }
      } else {
        await createItem(data as Parameters<typeof createItem>[0]);
        toast.success('Item added to inventory');
      }
    } catch {
      toast.error(editingItem ? 'Failed to update item' : 'Failed to add item');
      throw new Error('Submit failed');
    }
  };

  const handleQuantityUpdate = async (quantity: number, notes: string) => {
    if (!quantityItem) return;
    try {
      const updated = await updateQuantity(quantityItem.id, quantity, notes || undefined);
      toast.success('Quantity updated');
      if (selectedItem?.id === quantityItem.id) setSelectedItem(updated);
    } catch {
      toast.error('Failed to update quantity');
      throw new Error('Failed to update quantity');
    }
  };

  const handleDelete = async (item: InventoryItem) => {
    if (!confirm(`Delete "${item.name}"? This cannot be undone.`)) return;
    try {
      await deleteItem(item.id);
      toast.success('Item deleted');
      setDrawerOpen(false);
      setSelectedItem(null);
    } catch {
      toast.error('Failed to delete item');
    }
  };

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Inventory</h1>
          <p className="text-slate-500 text-sm mt-1">
            Track reagents, supplies, and equipment across all lab locations
          </p>
        </div>
        {canManage && (
          <Button
            onClick={() => { setEditingItem(null); setFormOpen(true); }}
            className="h-9 bg-teal-600 hover:bg-teal-700 text-white gap-2 shrink-0"
          >
            <Plus className="w-4 h-4" />
            Add Item
          </Button>
        )}
      </div>

      {/* Low-stock alert banner */}
      {!loading && lowStockCount > 0 && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800">
            <span className="font-semibold">{lowStockCount} item{lowStockCount !== 1 ? 's' : ''}</span>
            {' '}need{lowStockCount === 1 ? 's' : ''} attention — low stock or out of stock.
          </p>
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'all' ? 'low_stock' : 'all')}
            className="ml-auto text-xs font-medium text-amber-700 hover:text-amber-900 underline underline-offset-2"
          >
            {statusFilter === 'all' ? 'Show only' : 'Show all'}
          </button>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Filters */}
      <InventoryFilters
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        categoryId={categoryId}
        onCategoryChange={setCategoryId}
        locationId={locationId}
        onLocationChange={setLocationId}
        categories={categories}
        locations={locations}
      />

      {/* Summary counts */}
      {!loading && (
        <p className="text-xs text-slate-400">
          Showing {filtered.length} of {items.length} item{items.length !== 1 ? 's' : ''}
        </p>
      )}

      {/* Table */}
      <InventoryTable
        items={filtered}
        loading={loading}
        onRowClick={handleRowClick}
      />

      {/* Detail drawer */}
      <InventoryDrawer
        item={selectedItem}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onEdit={(item) => {
          setEditingItem(item);
          setFormOpen(true);
        }}
        onUpdateQuantity={(item) => setQuantityItem(item)}
        onDelete={handleDelete}
        canEdit={canManage}
        canDelete={canDelete}
        fetchActivity={fetchActivity}
      />

      {/* Create / edit dialog */}
      <ItemFormDialog
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditingItem(null); }}
        onSubmit={handleFormSubmit}
        categories={categories}
        locations={locations}
        item={editingItem}
      />

      {/* Quantity update dialog */}
      {quantityItem && (
        <QuantityDialog
          item={quantityItem}
          open={!!quantityItem}
          onClose={() => setQuantityItem(null)}
          onSubmit={handleQuantityUpdate}
        />
      )}
    </div>
  );
}
