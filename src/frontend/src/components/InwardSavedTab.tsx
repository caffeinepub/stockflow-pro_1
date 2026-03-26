import { CheckCircle, Edit, Edit2, X } from "lucide-react";
import type React from "react";
import { useState } from "react";
import type { AppUser, InwardSavedEntry, Transaction } from "../types";

function InwardSavedTab({
  inwardSaved,
  setInwardSaved,
  currentUser,
  transactions,
  activeBusinessId,
  showNotification,
}: {
  inwardSaved: InwardSavedEntry[];
  setInwardSaved: React.Dispatch<React.SetStateAction<InwardSavedEntry[]>>;
  currentUser: AppUser;
  transactions: Transaction[];
  activeBusinessId: string;
  showNotification: (m: string, t?: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [selectedBilty, setSelectedBilty] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<InwardSavedEntry | null>(
    null,
  );

  const filtered = inwardSaved.filter(
    (e) =>
      (!e.businessId || e.businessId === activeBusinessId) &&
      (!search ||
        e.biltyNumber.toLowerCase().includes(search.toLowerCase()) ||
        e.savedBy.toLowerCase().includes(search.toLowerCase()) ||
        e.transporter.toLowerCase().includes(search.toLowerCase())),
  );

  return (
    <div className="space-y-6 animate-fade-in-down">
      <div className="flex items-center gap-3 border-b pb-4">
        <div className="bg-green-600 p-2 rounded-2xl text-white shadow-lg">
          <CheckCircle size={20} />
        </div>
        <div>
          <h2 className="text-2xl font-black text-gray-800 tracking-tighter uppercase">
            Inward Saved
          </h2>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
            {filtered.length} completed bilties
          </p>
        </div>
      </div>
      <div className="flex gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search bilty number, transporter, saved by..."
          className="flex-1 border rounded-2xl p-3 font-bold bg-white outline-none focus:ring-2 focus:ring-green-500 text-sm"
        />
      </div>
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <CheckCircle size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-black uppercase text-sm">
            No completed bilties yet
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((entry) => (
            <div
              key={entry.id}
              className="bg-white rounded-[1.5rem] border border-green-100 shadow-sm overflow-hidden"
            >
              <div className="p-4 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setSelectedBilty(entry.biltyNumber)}
                      className="font-black text-green-700 text-sm hover:text-green-900 hover:underline"
                    >
                      {entry.biltyNumber}
                    </button>
                    <span className="text-[9px] font-black bg-green-100 text-green-700 px-2 py-0.5 rounded-full uppercase">
                      Completed
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
                    {entry.transporter && (
                      <p className="text-[10px] font-bold text-gray-500 uppercase">
                        <span className="text-gray-400">Transport:</span>{" "}
                        {entry.transporter}
                      </p>
                    )}
                    <p className="text-[10px] font-bold text-gray-500 uppercase">
                      <span className="text-gray-400">By:</span> {entry.savedBy}
                    </p>
                    <p className="text-[10px] font-bold text-gray-500 uppercase">
                      <span className="text-gray-400">On:</span>{" "}
                      {entry.savedAt
                        ? new Date(entry.savedAt).toLocaleDateString("en-IN")
                        : "—"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {entry.items.map((itm, i) => (
                      <span
                        key={`${entry.id}-item-${i}`}
                        className="text-[9px] font-black bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full"
                      >
                        {itm.itemName} ({itm.qty})
                      </span>
                    ))}
                  </div>
                </div>
                {currentUser.role === "admin" && (
                  <button
                    type="button"
                    onClick={() => setEditingEntry(entry)}
                    className="shrink-0 p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors"
                    title="Edit entry (Admin only)"
                  >
                    <Edit2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bilty History Panel */}
      {selectedBilty &&
        (() => {
          const bNo = selectedBilty;
          const inwardEntries = transactions.filter(
            (t) =>
              t.biltyNo?.toLowerCase() === bNo.toLowerCase() &&
              (t.type === "INWARD" || t.type === "inward") &&
              (!t.businessId || t.businessId === activeBusinessId),
          );
          const inwardEntry = inwardEntries[0] || null;
          const entry = inwardSaved.find(
            (e) => e.biltyNumber.toLowerCase() === bNo.toLowerCase(),
          );
          return (
            <div className="fixed inset-0 bg-gray-900/60 z-[100] flex items-center justify-center p-4">
              <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto animate-fade-in-down">
                <div className="sticky top-0 bg-white border-b px-6 py-5 flex justify-between items-center rounded-t-[2.5rem] z-10">
                  <div>
                    <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">
                      Inward Saved Detail
                    </p>
                    <h3 className="font-black text-gray-900 text-xl uppercase tracking-tight">
                      {bNo}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedBilty(null)}
                    className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full"
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="p-6 space-y-4">
                  {entry && (
                    <>
                      <div className="bg-green-50 border border-green-200 rounded-2xl p-4 space-y-1">
                        <p className="text-[10px] font-black uppercase text-green-800 mb-2">
                          Inward Details
                        </p>
                        <p className="text-xs font-bold text-gray-700">
                          Saved by: <b>{entry.savedBy}</b>
                        </p>
                        <p className="text-xs font-bold text-gray-700">
                          Date:{" "}
                          <b>
                            {entry.savedAt
                              ? new Date(entry.savedAt).toLocaleDateString(
                                  "en-IN",
                                )
                              : "—"}
                          </b>
                        </p>
                        {entry.transporter && (
                          <p className="text-xs font-bold text-gray-700">
                            Transporter: <b>{entry.transporter}</b>
                          </p>
                        )}
                        {entry.supplier && (
                          <p className="text-xs font-bold text-gray-700">
                            Supplier: <b>{entry.supplier}</b>
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <p className="text-[10px] font-black uppercase text-gray-500">
                          Items Received
                        </p>
                        {entry.items.map((itm) => (
                          <div
                            key={`${itm.itemName}-${itm.category}`}
                            className="bg-gray-50 border rounded-xl p-3 text-xs"
                          >
                            <p className="font-black text-gray-800">
                              {itm.itemName}{" "}
                              <span className="text-gray-400">
                                ({itm.category})
                              </span>
                            </p>
                            <div className="flex gap-3 mt-1 text-gray-600">
                              <span>
                                Total Qty:{" "}
                                <b className="text-gray-900">{itm.qty}</b>
                              </span>
                              {itm.shopQty > 0 && (
                                <span>
                                  Shop:{" "}
                                  <b className="text-green-700">
                                    {itm.shopQty}
                                  </b>
                                </span>
                              )}
                              {itm.godownQty > 0 && (
                                <span>
                                  Godown:{" "}
                                  <b className="text-amber-700">
                                    {itm.godownQty}
                                  </b>
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  {inwardEntry?.baleItemsList &&
                    inwardEntry.baleItemsList.length > 0 &&
                    !entry && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-black uppercase text-gray-500">
                          Items (from transaction record)
                        </p>
                        {inwardEntry.baleItemsList.map((bi) => (
                          <div
                            key={`${bi.itemName}-${bi.category}`}
                            className="bg-gray-50 border rounded-xl p-3 text-xs"
                          >
                            <p className="font-black">
                              {bi.itemName} ({bi.category})
                            </p>
                            <p className="text-gray-600 mt-0.5">
                              Qty: {bi.qty}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                </div>
              </div>
            </div>
          );
        })()}

      {/* Admin Edit Modal */}
      {editingEntry && currentUser.role === "admin" && (
        <div className="fixed inset-0 bg-gray-900/60 z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto animate-fade-in-down">
            <div className="sticky top-0 bg-white border-b px-6 py-5 flex justify-between items-center rounded-t-[2.5rem]">
              <div>
                <p className="text-[10px] font-black uppercase text-blue-600">
                  Admin Edit — Inward Saved
                </p>
                <h3 className="font-black text-gray-900 text-lg">
                  {editingEntry.biltyNumber}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingEntry(null)}
                className="p-2 bg-gray-100 rounded-full"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <p className="text-[10px] font-black uppercase text-amber-700">
                  Bilty number is locked
                </p>
                <p className="font-black text-amber-900">
                  {editingEntry.biltyNumber}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase text-gray-500 mb-1">
                    Transporter
                  </p>
                  <input
                    type="text"
                    value={editingEntry.transporter}
                    onChange={(e) =>
                      setEditingEntry({
                        ...editingEntry,
                        transporter: e.target.value,
                      })
                    }
                    className="w-full border rounded-xl p-3 font-bold text-sm bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-gray-500 mb-1">
                    Supplier
                  </p>
                  <input
                    type="text"
                    value={editingEntry.supplier}
                    onChange={(e) =>
                      setEditingEntry({
                        ...editingEntry,
                        supplier: e.target.value,
                      })
                    }
                    className="w-full border rounded-xl p-3 font-bold text-sm bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-gray-500 mb-1">
                    Saved By
                  </p>
                  <input
                    type="text"
                    value={editingEntry.savedBy}
                    onChange={(e) =>
                      setEditingEntry({
                        ...editingEntry,
                        savedBy: e.target.value,
                      })
                    }
                    className="w-full border rounded-xl p-3 font-bold text-sm bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-gray-500 mb-1">
                    Date
                  </p>
                  <input
                    type="date"
                    value={
                      editingEntry.savedAt
                        ? editingEntry.savedAt.split("T")[0]
                        : ""
                    }
                    onChange={(e) =>
                      setEditingEntry({
                        ...editingEntry,
                        savedAt: e.target.value,
                      })
                    }
                    className="w-full border rounded-xl p-3 font-bold text-sm bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-gray-500 mb-3 mt-2">
                  Items
                </p>
                {editingEntry.items.map((itm, idx) => (
                  <div
                    key={`edit-itm-${itm.itemName || idx}-${itm.category || idx}`}
                    className="border border-blue-100 rounded-2xl p-4 mb-3 bg-blue-50/40 space-y-3"
                  >
                    <div className="flex justify-between items-center">
                      <p className="text-[10px] font-black uppercase text-blue-700">
                        Item {idx + 1}
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          setEditingEntry({
                            ...editingEntry,
                            items: editingEntry.items.filter(
                              (_, i) => i !== idx,
                            ),
                          })
                        }
                        className="text-red-400 hover:text-red-600 text-[10px] font-black uppercase"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase text-gray-400 mb-1">
                          Category
                        </p>
                        <input
                          type="text"
                          value={itm.category}
                          onChange={(e) => {
                            const upd = [...editingEntry.items];
                            upd[idx] = {
                              ...upd[idx],
                              category: e.target.value,
                            };
                            setEditingEntry({ ...editingEntry, items: upd });
                          }}
                          className="w-full border rounded-xl p-3 font-bold text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase text-gray-400 mb-1">
                          Item Name
                        </p>
                        <input
                          type="text"
                          value={itm.itemName}
                          onChange={(e) => {
                            const upd = [...editingEntry.items];
                            upd[idx] = {
                              ...upd[idx],
                              itemName: e.target.value,
                            };
                            setEditingEntry({ ...editingEntry, items: upd });
                          }}
                          className="w-full border rounded-xl p-3 font-bold text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase text-gray-400 mb-1">
                          Shop Qty
                        </p>
                        <input
                          type="number"
                          value={itm.shopQty}
                          onChange={(e) => {
                            const upd = [...editingEntry.items];
                            const sq = Number(e.target.value) || 0;
                            upd[idx] = {
                              ...upd[idx],
                              shopQty: sq,
                              qty: sq + upd[idx].godownQty,
                            };
                            setEditingEntry({ ...editingEntry, items: upd });
                          }}
                          className="w-full border rounded-xl p-3 font-bold text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase text-gray-400 mb-1">
                          Godown Qty
                        </p>
                        <input
                          type="number"
                          value={itm.godownQty}
                          onChange={(e) => {
                            const upd = [...editingEntry.items];
                            const gq = Number(e.target.value) || 0;
                            upd[idx] = {
                              ...upd[idx],
                              godownQty: gq,
                              qty: upd[idx].shopQty + gq,
                            };
                            setEditingEntry({ ...editingEntry, items: upd });
                          }}
                          className="w-full border rounded-xl p-3 font-bold text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase text-gray-400 mb-1">
                          Sale Rate (₹)
                        </p>
                        <input
                          type="number"
                          value={itm.saleRate}
                          onChange={(e) => {
                            const upd = [...editingEntry.items];
                            upd[idx] = {
                              ...upd[idx],
                              saleRate: Number(e.target.value) || 0,
                            };
                            setEditingEntry({ ...editingEntry, items: upd });
                          }}
                          className="w-full border rounded-xl p-3 font-bold text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase text-gray-400 mb-1">
                          Purchase Rate (₹)
                        </p>
                        <input
                          type="number"
                          value={itm.purchaseRate}
                          onChange={(e) => {
                            const upd = [...editingEntry.items];
                            upd[idx] = {
                              ...upd[idx],
                              purchaseRate: Number(e.target.value) || 0,
                            };
                            setEditingEntry({ ...editingEntry, items: upd });
                          }}
                          className="w-full border rounded-xl p-3 font-bold text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <p className="text-[10px] font-black text-blue-700">
                      Total: {itm.shopQty + itm.godownQty} pcs
                    </p>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setEditingEntry({
                      ...editingEntry,
                      items: [
                        ...editingEntry.items,
                        {
                          category: "",
                          itemName: "",
                          qty: 0,
                          shopQty: 0,
                          godownQty: 0,
                          saleRate: 0,
                          purchaseRate: 0,
                          attributes: {},
                        },
                      ],
                    })
                  }
                  className="w-full border-2 border-dashed border-blue-300 text-blue-600 font-black text-[10px] uppercase py-3 rounded-2xl hover:bg-blue-50"
                >
                  + Add Item
                </button>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setInwardSaved((prev) =>
                      prev.map((e) =>
                        e.id === editingEntry.id ? editingEntry : e,
                      ),
                    );
                    setEditingEntry(null);
                    showNotification("Entry updated", "success");
                  }}
                  className="flex-1 bg-blue-600 text-white font-black py-3 rounded-2xl text-xs uppercase shadow-lg"
                >
                  Save Changes
                </button>
                <button
                  type="button"
                  onClick={() => setEditingEntry(null)}
                  className="px-6 border font-black py-3 rounded-2xl text-xs uppercase"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { InwardSavedTab };
