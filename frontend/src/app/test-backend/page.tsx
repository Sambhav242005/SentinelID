"use client";
import { useState } from "react";

export default function TestBackendPage() {
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  // --- NEW ---
  // State for the customizable Base URL
  const [baseUrl, setBaseUrl] = useState<string>(
    process.env.NEXT_PUBLIC_API_BASE || ""
  );
  // -----------

  // State for the customizable path
  const [path, setPath] = useState<string>("/health");

  const checkBackend = async () => {
    setLoading(true);

    // --- MODIFIED ---
    // Build URL from both state variables
    const targetUrl = `${baseUrl}${path}`;
    setResult(`Loading ${targetUrl} ...`);
    // ----------------

    try {
      const res = await fetch(targetUrl);

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(
          `Backend Error: ${res.status} ${res.statusText}\n${errorText}`
        );
      }

      const text = await res.text();

      if (!text) {
        setResult(`✅ Status: ${res.status} (OK)\n\n(Empty Response Body)`);
        return;
      }

      try {
        const data = JSON.parse(text);
        setResult(
          `✅ Status: ${res.status} (OK)\n\n${JSON.stringify(data, null, 2)}`
        );
      } catch (e) {
        setResult(`✅ Status: ${res.status} (OK)\n\n${text}`);
      }
    } catch (err) {
      if (err instanceof Error) {
        setResult("❌ ERROR: " + err.message);
      } else {
        setResult("❌ An unknown error occurred.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 font-sans">
      <h1 className="mb-4 text-3xl font-bold">Backend Connectivity Test</h1>

      {/* --- NEW INPUT FIELD FOR BASE URL --- */}
      <div className="mb-4">
        <label
          htmlFor="baseUrlInput"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Base URL:
        </label>
        <input
          id="baseUrlInput"
          type="text"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          className="
            p-2 w-full max-w-md border border-gray-300 rounded-md 
            font-mono text-sm shadow-sm
            focus:border-blue-500 focus:ring-blue-500
          "
        />
      </div>
      {/* ---------------------------------- */}

      {/* --- INPUT FIELD FOR PATH --- */}
      <div className="mb-4">
        <label
          htmlFor="pathInput"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Endpoint Path:
        </label>
        <input
          id="pathInput"
          type="text"
          value={path}
          onChange={(e) => setPath(e.target.value)}
          className="
            p-2 w-full max-w-md border border-gray-300 rounded-md 
            font-mono text-sm shadow-sm
            focus:border-blue-500 focus:ring-blue-500
          "
        />
      </div>
      {/* -------------------------- */}

      <button
        onClick={checkBackend}
        disabled={loading}
        className="
          py-2 px-5 bg-blue-600 text-white font-medium rounded-md
          cursor-pointer transition-all
          hover:bg-blue-700
          disabled:opacity-60 disabled:cursor-not-allowed
        "
      >
        {loading ? "Checking..." : "Test Endpoint"}
      </button>

      <pre
        className={`
          mt-5 p-5 bg-gray-900 rounded-lg text-sm 
          whitespace-pre-wrap overflow-x-auto
          ${
            result?.startsWith("❌") ? "text-red-500" : "text-green-500"
          }
        `}
      >
        {result ?? "Click the button to test backend."}
      </pre>V
    </div>
  );
}