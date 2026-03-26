import { Receipt } from "lucide-react";
import { useState } from "react";
import type { Transaction } from "../types";

function SalesRecordTab({
  transactions,
  activeBusinessId,
}: {
  transactions: Transaction[];
  activeBusinessId: string;
}) {
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const salesTxns = transactions.filter((t) => {
    if (!(!t.businessId || t.businessId === activeBusinessId)) return false;
    if (t.type !== "SALE") return false;
    if (dateFrom && t.date < dateFrom) return false;
    if (dateTo && t.date > dateTo) return false;
    if (
      search &&
      !(
        (t.itemName || "").toLowerCase().includes(search.toLowerCase()) ||
        (t.category || "").toLowerCase().includes(search.toLowerCase())
      )
    )
      return false;
    return true;
  });

  return (
    <div className="space-y-6 animate-fade-in-down">
      <div className="border-b pb-4 flex items-center justify-between">
        <h2 className="text-2xl font-black text-gray-800 tracking-tighter uppercase flex items-center gap-2">
          <Receipt className="text-green-600" /> Sales Record
        </h2>
        <span className="bg-green-100 text-green-700 text-xs font-black px-3 py-1 rounded-full uppercase">
          {salesTxns.length} entries
        </span>
      </div>
      <div className="bg-white border rounded-[2rem] p-5 shadow-sm flex flex-wrap gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search item or category..."
          className="flex-1 min-w-[180px] border rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-green-400 bg-gray-50"
        />
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="border rounded-xl p-3 text-sm font-bold outline-none bg-gray-50"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="border rounded-xl p-3 text-sm font-bold outline-none bg-gray-50"
        />
        {(search || dateFrom || dateTo) && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setDateFrom("");
              setDateTo("");
            }}
            className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl text-xs font-black uppercase"
          >
            Clear
          </button>
        )}
      </div>
      {salesTxns.length === 0 ? (
        <div
          className="text-center py-16 text-gray-400 font-bold"
          data-ocid="salesrecord.empty_state"
        >
          No sales records found.
        </div>
      ) : (
        <div className="bg-white border rounded-[2rem] overflow-hidden shadow-sm">
          <div className="hidden md:grid grid-cols-6 gap-2 bg-green-50 px-6 py-3 text-[10px] font-black uppercase text-green-700">
            <span>Date</span>
            <span>Category</span>
            <span>Item</span>
            <span>Qty</span>
            <span>Rate</span>
            <span>By</span>
          </div>
          <div className="divide-y">
            {salesTxns.map((t, idx) => (
              <div
                key={t.id}
                data-ocid={`salesrecord.item.${idx + 1}`}
                className="px-4 md:px-6 py-4 grid grid-cols-2 md:grid-cols-6 gap-2 items-center hover:bg-green-50/30 transition-colors"
              >
                <span className="text-xs font-bold text-gray-500">
                  {t.date}
                </span>
                <span className="text-xs font-black text-gray-500 uppercase">
                  {t.category || "—"}
                </span>
                <span className="text-sm font-black text-gray-900 col-span-2 md:col-span-1">
                  {t.itemName || t.notes || "Sale"}
                </span>
                <span className="text-xs font-black text-green-700">
                  {t.itemsCount ?? "—"}
                </span>
                <span className="text-xs font-bold text-gray-500">
                  {t.notes?.includes("₹")
                    ? t.notes.match(/₹[d.]+/)?.[0] || "—"
                    : "—"}
                </span>
                <span className="text-[10px] font-bold text-gray-400">
                  {t.user}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export { SalesRecordTab };
