import React from "react";

interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  emptyMessage?: string;
}

export function Table<T extends { _id?: string; id?: string }>({
  columns,
  data,
  emptyMessage = "No data found.",
}: TableProps<T>) {
  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400 text-sm">{emptyMessage}</div>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className="text-left px-4 py-3 text-xs uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-100 bg-slate-50"
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr
              key={(row._id ?? row.id ?? i) as string}
              className="hover:bg-slate-50/80 transition-colors border-b border-slate-50 last:border-0"
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`px-4 py-3.5 text-sm text-slate-700 ${col.className ?? ""}`}
                >
                  {col.render
                    ? col.render(row)
                    : String((row as Record<string, unknown>)[col.key] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
