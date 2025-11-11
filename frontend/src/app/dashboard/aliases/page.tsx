'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Copy, Eye, EyeOff, MoreHorizontal, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

interface Alias {
  id: number;
  alias_email: string;
  generated_password: string;
  site_name?: string;
  group_name?: string;
  created_at?: string;
}

const aliasApi = {
  async getAliases(userId: string) {
    const res = await fetch(`${API_BASE}/aliases?user_id=${userId}`);
    if (!res.ok) throw new Error("Failed to load aliases");
    return res.json();
  },
  async createAlias(payload: Record<string, any>) {
    const res = await fetch(`${API_BASE}/aliases`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to create alias");
    return data;
  },
  async updateAlias(id: number, payload: Record<string, any>) {
    const res = await fetch(`${API_BASE}/aliases/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to update alias");
    }
    return res.json();
  },
  async deleteAlias(id: number) {
    const res = await fetch(`${API_BASE}/aliases/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to delete alias");
    }
  },
};

export default function AliasesPage() {
  const [aliases, setAliases] = useState<Alias[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showPasswords, setShowPasswords] = useState<Record<number, boolean>>({});

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newAlias, setNewAlias] = useState({
    domain: '',
    site_name: '',
    group_name: '',
  });
  const [deterministic, setDeterministic] = useState(false);

  const [isUpdateOpen, setIsUpdateOpen] = useState(false);
  const [currentAlias, setCurrentAlias] = useState<Alias | null>(null);

  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const storedEmail = localStorage.getItem("user_email");
    if (storedEmail) setUserEmail(storedEmail);
    loadAliases();
  }, []);

  const loadAliases = async () => {
    setIsLoading(true);
    try {
      const userId = localStorage.getItem('user_id');
      if (!userId) throw new Error("No user_id in localStorage");
      const data = await aliasApi.getAliases(userId);
      setAliases(data);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load aliases');
    } finally {
      setIsLoading(false);
    }
  };

  // Helper: deterministic 8-char hex from SHA-256
  const deterministicHash = async (input: string): Promise<string> => {
    // use Web Crypto API
    const enc = new TextEncoder();
    const data = enc.encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hex.substring(0, 8); // 8 hex chars (deterministic)
  };

  // Generate random 8-character alphanumeric hash
  const randomHash = (): string => Math.random().toString(36).substring(2, 10);

  /**
   * Normalize input into alias.
   * - mail: domain / full email / tag
   * - tag: optional site_name
   * - deterministic: if true, derives a deterministic hash from (label + userEmail)
   */
  const normalizeInputToAlias = async (mail: string = "", tag: string = "", deterministicFlag: boolean = false): Promise<string> => {
    const rawMail = (mail || "").trim().toLowerCase();
    const rawTag = (tag || "").trim().toLowerCase();

    // Pull user email (from state or localStorage)
    const storedEmail =
      userEmail ||
      (typeof window !== "undefined" ? localStorage.getItem("user_email") : null);

    // Fallback parts if user email not available
    const [localPart, domainPart] = storedEmail
      ? storedEmail.split("@")
      : ["user", "example.com"];

    // Decide the hash (deterministic or random)
    const pickHash = async (seed: string) => {
      if (deterministicFlag) {
        // derive deterministic hash from seed + storedEmail (if present)
        const seedStr = `${seed}::${storedEmail ?? ''}`;
        return await deterministicHash(seedStr);
      }
      return randomHash();
    };

    // CASE 1: Full email provided (already contains @)
    if (rawMail.includes("@")) {
      const [local, domain] = rawMail.split("@");
      const seed = rawTag || `${local}@${domain}`;
      const h = await pickHash(seed);
      if (rawTag) return `${local}+${rawTag}-${h}@${domain}`.toLowerCase();
      return `${local}+${h}@${domain}`.toLowerCase();
    }

    // CASE 2: Domain provided (contains '.' but no '@')
    if (rawMail.includes(".") && !rawMail.includes("@")) {
      const seed = rawTag || rawMail;
      const h = await pickHash(seed);
      if (rawTag) return `${rawTag}-${h}@${rawMail}`.toLowerCase();
      return `${h}@${rawMail}`.toLowerCase();
    }

    // CASE 3: Tag / label / or empty -> use user email base
    const label = rawMail || rawTag;
    if (!label) {
      const h = await pickHash('fallback'); // fallback deterministic seed
      return `${localPart}+${h}@${domainPart}`.toLowerCase();
    }

    // Default: localPart + label - hash @ domainPart
    const h = await pickHash(label);
    return `${localPart}+${label}-${h}@${domainPart}`.toLowerCase();
  };

  const handleCreateAlias = async () => {
    try {
      const userId = localStorage.getItem('user_id');
      if (!userId) throw new Error("Missing user_id");

      // Automatically generate proper alias form (now async)
      const normalized = await normalizeInputToAlias(
        newAlias.domain || "",
        newAlias.site_name || "",
        deterministic
      );

      const createdAlias = await aliasApi.createAlias({
        user_id: userId,
        domain: normalized,
        site_name: newAlias.site_name || undefined,
        group_name: newAlias.group_name || undefined,
      });

      setAliases(prev => [
        {
          id: createdAlias.alias_id,
          alias_email: createdAlias.alias_email,
          generated_password: createdAlias.generated_password,
          site_name: newAlias.site_name,
          group_name: newAlias.group_name,
        },
        ...prev,
      ]);

      toast.success('Alias created successfully');
      setIsCreateOpen(false);
      setNewAlias({ domain: '', site_name: '', group_name: '' });
      setDeterministic(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to create alias');
    }
  };

  const handleUpdateAlias = async () => {
    if (!currentAlias) return;
    try {
      await aliasApi.updateAlias(currentAlias.id, {
        site_name: currentAlias.site_name,
        group_name: currentAlias.group_name,
      });
      setAliases(prev =>
        prev.map(a => (a.id === currentAlias.id ? currentAlias : a))
      );
      toast.success('Alias updated successfully');
      setIsUpdateOpen(false);
      setCurrentAlias(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to update alias');
    }
  };

  const handleDeleteAlias = async (aliasId: number) => {
    try {
      await aliasApi.deleteAlias(aliasId);
      setAliases(prev => prev.filter(a => a.id !== aliasId));
      toast.success('Alias deleted successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete alias');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const togglePasswordVisibility = (id: number) => {
    setShowPasswords(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Email Aliases</h1>
          <p className="text-muted-foreground">Manage your generated aliases for privacy</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Create Alias</Button>
          </DialogTrigger>
          <DialogContent className="bg-black">
            <DialogHeader>
              <DialogTitle>Create New Alias</DialogTitle>
              <DialogDescription>
                Type a domain (<code>example.com</code>), a full email (<code>custom@example.com</code>), or just a tag (<code>github</code>) — we’ll handle it automatically.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="domain">Domain / Tag / Email</Label>
                <Input
                  id="domain"
                  placeholder="example.com / github / custom@example.com"
                  value={newAlias.domain}
                  onChange={(e) => setNewAlias({ ...newAlias, domain: e.target.value })}
                />
                <p className="text-sm text-muted-foreground">
                  - Domain (<code>google.com</code>) → random/deterministic alias depending on checkbox<br />
                  - Tag (<code>github</code>) → name+github-<i>hash</i>@your-domain<br />
                  - Full Email → used as-is (but tag/hash will be appended if site name provided)
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="site_name">Site Name (Optional)</Label>
                <Input
                  id="site_name"
                  placeholder="Shopping Site"
                  value={newAlias.site_name}
                  onChange={(e) => setNewAlias({ ...newAlias, site_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="group_name">Group Name (Optional)</Label>
                <Input
                  id="group_name"
                  placeholder="Personal / Work"
                  value={newAlias.group_name}
                  onChange={(e) => setNewAlias({ ...newAlias, group_name: e.target.value })}
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  id="deterministic"
                  type="checkbox"
                  checked={deterministic}
                  onChange={(e) => setDeterministic(e.target.checked)}
                  className="h-4 w-4 rounded"
                />
                <Label htmlFor="deterministic" className="cursor-pointer">Deterministic (stable alias for same site)</Label>
                <Badge variant="secondary" className="ml-2">Optional</Badge>
              </div>

              <Button onClick={handleCreateAlias} className="w-full">Create Alias</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Aliases</CardTitle>
          <CardDescription>List of all generated aliases</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div>Loading aliases...</div>
          ) : aliases.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No aliases found</p>
              <Button className="mt-4" onClick={() => setIsCreateOpen(true)}>Create your first alias</Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Alias Email</TableHead>
                  <TableHead>Site</TableHead>
                  <TableHead>Group</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Password</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {aliases.map(alias => (
                  <TableRow key={alias.id}>
                    <TableCell className="font-medium">{alias.alias_email}</TableCell>
                    <TableCell>{alias.site_name || <span className="text-muted-foreground">-</span>}</TableCell>
                    <TableCell>{alias.group_name || <span className="text-muted-foreground">-</span>}</TableCell>
                    <TableCell>{alias.created_at ? new Date(alias.created_at).toLocaleDateString() : '-'}</TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-sm">
                          {showPasswords[alias.id] ? alias.generated_password : '••••••••'}
                        </span>
                        <Button variant="ghost" size="icon" onClick={() => togglePasswordVisibility(alias.id)}>
                          {showPasswords[alias.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
  <AlertDialog>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className='bg-black' align="end">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => copyToClipboard(alias.alias_email)}>
          <Copy className="mr-2 h-4 w-4" /> Copy Email
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => copyToClipboard(alias.generated_password)}>
          <Copy className="mr-2 h-4 w-4" /> Copy Password
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => { setCurrentAlias(alias); setIsUpdateOpen(true); }}>
          <Edit className="mr-2 h-4 w-4" /> Edit
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <AlertDialogTrigger asChild>
          <DropdownMenuItem className="text-red-600">
            <Trash2 className="mr-2 h-4 w-4" /> Delete
          </DropdownMenuItem>
        </AlertDialogTrigger>
      </DropdownMenuContent>
    </DropdownMenu>

    {/* ✅ FIX: keep this INSIDE the <AlertDialog> wrapper */}
    <AlertDialogContent className="bg-background">
      <AlertDialogHeader>
        <AlertDialogTitle>Delete Alias?</AlertDialogTitle>
        <AlertDialogDescription>
          Permanently delete <b>{alias.alias_email}</b>?
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction
          className="bg-red-600 hover:bg-red-700"
          onClick={() => handleDeleteAlias(alias.id)}
        >
          Yes, Delete
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</TableCell>

                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
