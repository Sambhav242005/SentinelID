"use client";
import { useState } from "react";
import api from "@/lib/api";

export default function IncidentCorrelationPage() {
  const [leakId, setLeakId] = useState("");
  const [data, setData] = useState<any[]>([]);

  async function fetchCorrelations() {
    const res = await api.get(`/incident-correlations?leak_id=${leakId}`);
    setData(res.data);
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <h1 className="text-2xl font-bold mb-4">Incident Correlations</h1>
      <div className="flex gap-2 mb-4">
        <input
          className="p-2 bg-gray-800 rounded"
          placeholder="Leak ID"
          value={leakId}
          onChange={e => setLeakId(e.target.value)}
        />
        <button onClick={fetchCorrelations} className="bg-blue-600 px-4 py-2 rounded">Fetch</button>
      </div>
      <div className="space-y-3">
        {data.map(c => (
          <div key={c.id} className="bg-gray-800 p-3 rounded">
            <p><b>Session:</b> {c.session_id}</p>
            <p><b>Confidence:</b> {c.correlation_confidence.toFixed(2)}</p>
            <p className="text-sm text-gray-400">{JSON.stringify(c.correlation_factors)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
