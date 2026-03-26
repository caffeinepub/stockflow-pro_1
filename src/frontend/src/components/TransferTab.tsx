import { ArrowRightLeft, RefreshCw, Trash2, X } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { getTotalGodownStock } from "../constants";
import type { AppUser, InventoryItem, Transaction } from "../types";

function TransferTab({
  inventory,
  updateStock: _updateStock,
  showNotification,
  godowns,
  activeBusinessId,
  setTransactions,
  currentUser,
  actor,
  setTransfers,
  onInventoryRefresh,
}: {
  inventory: Record<string, InventoryItem>;
  updateStock?: (
    sku: string,
    details: Partial<InventoryItem>,
    shopDelta: number,
    godownDelta: number,
    targetGodown?: string,
  ) => void;
  showNotification: (m: string, t?: string) => void;
  godowns: string[];
  activeBusinessId: string;
  setTransactions?: React.Dispatch<React.SetStateAction<Transaction[]>>;
  currentUser?: AppUser;
  transfers?: any[];
  setTransfers?: React.Dispatch<React.SetStateAction<any[]>>;
  actor?: any;
  onInventoryRefresh?: () => Promise<void>;
}) {
  const [mode, setMode] = useState("G2S");
  const [targetG, setTargetG] = useState(godowns?.[0] || "Main Godown");
  const [search, setSearch] = useState("");
  const [selectedSku, setSelectedSku] = useState<string | null>(null);
  const [qty, setQty] = useState("");
  const [pendingTransfers, setPendingTransfers] = useState<
    Array<{
      id: number;
      sku: string;
      itemName: string;
      category: string;
      qty: number;
      mode: string;
      targetG: string;
      fromLoc: string;
      toLoc: string;
      saleRate?: number;
    }>
  >([]);

  const filteredSkus = Object.keys(inventory || {})
    .filter((s) => {
      const matchesBusiness =
        !inventory[s].businessId ||
        inventory[s].businessId === activeBusinessId;
      return (
        matchesBusiness &&
        inventory[s].itemName?.toLowerCase().includes(search.toLowerCase())
      );
    })
    .slice(0, 10);

  const handleAddToTransferList = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSku || !qty) return;
    const item = inventory[selectedSku];
    const qVal = Number(qty);
    let fromLoc = "";
    let toLoc = "";
    if (mode === "G2S") {
      if ((item.godowns?.[targetG] || 0) < qVal)
        return showNotification(`Not enough stock in ${targetG}`, "error");
      fromLoc = targetG;
      toLoc = "Shop";
    } else {
      if ((item.shop || 0) < qVal)
        return showNotification("Not enough stock in Shop", "error");
      fromLoc = "Shop";
      toLoc = targetG;
    }
    setPendingTransfers((prev) => [
      ...prev,
      {
        id: Date.now(),
        sku: selectedSku,
        itemName: item.itemName,
        category: item.category,
        qty: qVal,
        mode,
        targetG,
        fromLoc,
        toLoc,
        saleRate: item.saleRate,
      },
    ]);
    showNotification("Added to transfer list", "success");
    setQty("");
    setSelectedSku(null);
    setSearch("");
  };

  const handleTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    handleAddToTransferList(e);
  };

  const handlePostAllTransfers = async () => {
    if (pendingTransfers.length === 0) return;
    for (const pt of pendingTransfers) {
      const item = inventory[pt.sku];
      if (!item) continue;
      if (actor) {
        try {
          const transferEntry = {
            id: String(Date.now() + Math.random()),
            businessId: activeBusinessId,
            createdAt: BigInt(Date.now()),
            itemName: item.itemName,
            category: item.category,
            subCategory: JSON.stringify(item.attributes || {}),
            qty: BigInt(pt.qty),
            rate: item.saleRate || 0,
            fromId: pt.fromLoc,
            fromType: pt.mode === "G2S" ? "godown" : "shop",
            toId: pt.toLoc,
            toType: pt.mode === "G2S" ? "shop" : "godown",
            transferredBy: currentUser?.username || "",
          };
          const result = await actor.postTransfer(transferEntry);
          if (result !== "ok") {
            showNotification(`Transfer failed: ${result}`, "error");
            continue;
          }
          if (setTransactions && currentUser) {
            const attrStr = Object.entries(item.attributes || {})
              .map(([k, v]) => `${k}: ${v}`)
              .join(", ");
            setTransactions((prev) => [
              {
                id: Date.now() + Math.random(),
                type: "transfer",
                biltyNo: undefined,
                businessId: activeBusinessId,
                date: new Date().toISOString().split("T")[0],
                user: currentUser.username,
                itemName: item.itemName,
                category: item.category,
                itemsCount: pt.qty,
                fromLocation: pt.fromLoc,
                toLocation: pt.toLoc,
                transferredBy: currentUser.username,
                subCategory: attrStr || undefined,
                notes: `${item.itemName} · ${pt.qty} pcs · ${pt.fromLoc} → ${pt.toLoc}`,
              },
              ...prev,
            ]);
          }
          if (setTransfers)
            setTransfers((prev: any[]) => [...prev, transferEntry]);
          if (onInventoryRefresh) await onInventoryRefresh();
        } catch (e) {
          console.error(e);
        }
      }
    }
    showNotification(
      `${pendingTransfers.length} transfer(s) posted!`,
      "success",
    );
    setPendingTransfers([]);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in-down">
      <h2 className="text-2xl font-black text-gray-800 tracking-tighter uppercase flex items-center gap-2 border-b pb-4">
        <ArrowRightLeft className="text-purple-600" /> Internal Transfers
      </h2>
      <div className="flex bg-gray-100 p-1.5 rounded-[1.5rem] font-black uppercase text-[10px] tracking-widest shadow-inner">
        <button
          type="button"
          onClick={() => setMode("G2S")}
          className={`flex-1 py-4 rounded-2xl transition-all ${mode === "G2S" ? "bg-purple-600 text-white shadow-lg" : "text-gray-500"}`}
        >
          Godown ➡️ Shop
        </button>
        <button
          type="button"
          onClick={() => setMode("S2G")}
          className={`flex-1 py-4 rounded-2xl transition-all ${mode === "S2G" ? "bg-blue-600 text-white shadow-lg" : "text-gray-500"}`}
        >
          Shop ➡️ Godown
        </button>
      </div>
      <div className="bg-white p-8 rounded-[2.5rem] border shadow-xl space-y-6">
        <div className="relative">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-black uppercase text-gray-400 ml-1">
              Search Product
            </p>
            <button
              type="button"
              title="Reset selection"
              onClick={() => {
                setSelectedSku(null);
                setSearch("");
                setQty("");
              }}
              className="p-1.5 bg-gray-100 hover:bg-purple-100 text-gray-400 hover:text-purple-600 rounded-lg transition-colors"
            >
              <RefreshCw size={13} />
            </button>
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border rounded-2xl p-4 font-bold outline-none bg-gray-50 focus:bg-white focus:ring-2 focus:ring-purple-500 transition-all"
            placeholder="Type item name..."
          />
          {search && !selectedSku && (
            <div className="absolute z-10 w-full bg-white border mt-2 rounded-2xl shadow-2xl divide-y overflow-hidden">
              {filteredSkus.map((s) => {
                const inv = inventory[s];
                const attrs = Object.entries(inv.attributes || {});
                return (
                  <button
                    type="button"
                    key={s}
                    onClick={() => {
                      setSelectedSku(s);
                      setSearch(inv.itemName);
                    }}
                    className="w-full text-left p-4 hover:bg-purple-50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-bold text-sm">{inv.itemName}</p>
                        <p className="text-[10px] font-black text-gray-400 uppercase mt-0.5">
                          {inv.category}
                        </p>
                        {attrs.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {attrs.map(([k, v]) => (
                              <span
                                key={k}
                                className="bg-purple-50 text-purple-700 text-[9px] font-black px-1.5 py-0.5 rounded uppercase"
                              >
                                {k}: {v}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[10px] font-black text-amber-600 uppercase">
                          Godown: {getTotalGodownStock(inv)}
                        </p>
                        <p className="text-[10px] font-black text-blue-600 uppercase">
                          Shop: {inv.shop}
                          <p className="text-[10px] font-black text-green-600 uppercase">
                            ₹{inv.saleRate}/unit
                          </p>
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        {selectedSku && (
          <div className="animate-fade-in-down space-y-4">
            {/* Subcategories display */}
            {Object.keys(inventory[selectedSku]?.attributes || {}).length >
              0 && (
              <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                <p className="text-[10px] font-black uppercase text-blue-700 mb-2">
                  Item Sub-Categories
                </p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(inventory[selectedSku].attributes).map(
                    ([k, v]) => (
                      <span
                        key={k}
                        className="bg-white border border-blue-200 text-blue-800 px-3 py-1 rounded-full text-xs font-bold uppercase"
                      >
                        {k}: {v}
                      </span>
                    ),
                  )}
                </div>
              </div>
            )}
            {/* Per-Godown Stock Breakdown */}
            {(() => {
              const godownEntries = Object.entries(
                inventory[selectedSku]?.godowns || {},
              ).filter(([, v]) => Number(v) > 0);
              if (godownEntries.length === 0) return null;
              return (
                <div className="bg-amber-50/60 p-4 rounded-2xl border border-amber-100">
                  <p className="text-[10px] font-black uppercase text-amber-800 mb-2">
                    Stock by Godown
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {godownEntries.map(([g, v]) => (
                      <span
                        key={g}
                        className="bg-white border border-amber-200 text-amber-800 px-3 py-1.5 rounded-xl text-xs font-black"
                      >
                        {g}: <span className="text-amber-600">{v}</span>
                      </span>
                    ))}
                  </div>
                </div>
              );
            })()}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-purple-50/50 p-6 rounded-3xl border border-purple-100">
              <div>
                <p className="text-[10px] font-black uppercase text-purple-900 ml-1">
                  Location
                </p>
                <select
                  value={targetG}
                  onChange={(e) => setTargetG(e.target.value)}
                  className="w-full border border-purple-200 rounded-2xl p-4 font-bold outline-none bg-white shadow-sm"
                >
                  {godowns.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-purple-900 ml-1">
                  Quantity
                </p>
                <input
                  type="number"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  className="w-full border border-purple-200 rounded-2xl p-4 font-black text-lg outline-none bg-white shadow-sm text-purple-700"
                  placeholder="0"
                />
              </div>
              <button
                type="button"
                onClick={handleTransfer}
                className="sm:col-span-2 bg-purple-600 text-white font-black py-5 rounded-2xl uppercase tracking-widest text-xs shadow-xl shadow-purple-200 active:scale-95 transition-transform"
              >
                ＋ Add to Transfer List
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Pending Transfer List */}
      {pendingTransfers.length > 0 && (
        <div className="bg-white rounded-[2rem] border border-purple-200 shadow-lg overflow-hidden animate-fade-in-down">
          <div className="bg-purple-600 text-white px-6 py-4 flex items-center justify-between">
            <h3 className="font-black uppercase tracking-widest text-xs">
              Transfer Queue ({pendingTransfers.length} items)
            </h3>
            <button
              type="button"
              onClick={handlePostAllTransfers}
              className="bg-white text-purple-700 font-black text-[10px] uppercase px-4 py-2 rounded-xl hover:bg-purple-50 transition-colors"
            >
              Post All Transfers
            </button>
          </div>
          <div className="divide-y">
            {pendingTransfers.map((pt) => (
              <div
                key={pt.id}
                className="px-6 py-4 flex items-center justify-between gap-3"
              >
                <div className="flex-1">
                  <p className="font-black text-sm text-gray-900">
                    {pt.itemName}
                  </p>
                  <p className="text-[10px] font-bold text-gray-500 uppercase">
                    {pt.category}
                  </p>
                  <p className="text-[10px] font-black text-purple-700 mt-0.5">
                    {pt.fromLoc} → {pt.toLoc} · {pt.qty} pcs
                  </p>
                  {pt.saleRate ? (
                    <p className="text-[10px] font-black text-green-600 mt-0.5">
                      ₹{pt.saleRate}/unit
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setPendingTransfers((prev) =>
                      prev.filter((x) => x.id !== pt.id),
                    )
                  }
                  className="p-2 bg-red-50 text-red-400 rounded-xl hover:bg-red-100 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ================= HISTORY TAB ================= */

export { TransferTab };
