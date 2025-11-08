"use client";
import { useState } from "react";
import api from "@/lib/api";

export default function LeakCheckPage() {
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function checkLeak() {
    setLoading(true);
    try {
      const res = await api.post("/leak-check", { email });
      setResult(res.data);
    } catch (err: any) {
      alert(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-950 text-white p-8">
      <h1 className="text-2xl font-bold mb-4">Leak Check</h1>
      <input
        className="p-2 bg-gray-800 rounded mb-3 w-80"
        placeholder="Enter email"
        value={email}
        onChange={e => setEmail(e.target.value)}
      />
      <button onClick={checkLeak} className="bg-blue-600 px-4 py-2 rounded mb-6">
        {loading ? "Checking..." : "Check Leak"}
      </button>

      {result && (
        <div className="bg-gray-800 p-4 rounded w-96">
          <h2 className="text-lg font-semibold mb-2">Result: {result.status}</h2>
          {result.breaches && (
            <ul className="text-sm text-gray-300 list-disc ml-5">
              {result.breaches.map((b: string) => <li key={b}>{b}</li>)}
            </ul>
          )}
          <p className="mt-2">{result.message}</p>
        </div>
      )}
    </div>
  );
}
