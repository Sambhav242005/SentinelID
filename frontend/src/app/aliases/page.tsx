"use client";
import { useState, useEffect } from "react";
import api from "@/lib/api";
import AliasCard from "@/components/AliasCard";

export default function AliasesPage() {
  const [aliases, setAliases] = useState<any[]>([]);
  const [userId, setUserId] = useState("");
  const [domain, setDomain] = useState("");
  const [siteName, setSiteName] = useState("");

  async function fetchAliases() {
    if (!userId) return;
    const res = await api.get(`/aliases?user_id=${userId}`);
    setAliases(res.data);
  }

  async function createAlias() {
    if (!userId || !domain) return alert("Enter user_id and domain");
    const res = await api.post("/aliases", { user_id: userId, domain, site_name: siteName });
    alert(`Created alias: ${res.data.alias_email}`);
    fetchAliases();
  }

  useEffect(() => {
    if (userId) fetchAliases();
  }, [userId]);

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <h1 className="text-2xl font-bold mb-4">Manage Aliases</h1>
      <div className="flex gap-2 mb-6">
        <input className="p-2 bg-gray-800 rounded" placeholder="User ID" value={userId} onChange={e => setUserId(e.target.value)} />
        <input className="p-2 bg-gray-800 rounded" placeholder="Domain" value={domain} onChange={e => setDomain(e.target.value)} />
        <input className="p-2 bg-gray-800 rounded" placeholder="Site Name" value={siteName} onChange={e => setSiteName(e.target.value)} />
        <button onClick={createAlias} className="bg-green-600 px-4 py-2 rounded">Create</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {aliases.map(a => <AliasCard key={a.id} alias={a} />)}
      </div>
    </div>
  );
}
