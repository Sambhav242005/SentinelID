interface AliasCardProps {
  alias: any;
}

export default function AliasCard({ alias }: AliasCardProps) {
  return (
    <div className="bg-gray-800 p-4 rounded-lg shadow">
      <h2 className="font-semibold text-lg">{alias.alias_email}</h2>
      <p className="text-sm text-gray-400">{alias.site_name || "Unknown Site"}</p>
      <p className="text-xs mt-2">Group: {alias.group_name || "N/A"}</p>
      <p className="text-xs text-gray-500 mt-2">Created: {alias.created_at || "—"}</p>
    </div>
  );
}
