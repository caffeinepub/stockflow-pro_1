import { CheckCircle, Truck, X } from "lucide-react";
import type React from "react";
import { useState } from "react";
import type {
  AppUser,
  Category,
  DeliveryRecord,
  InventoryItem,
  PendingParcel,
  Transaction,
} from "../types";

function DeliveryTab({
  inventory,
  setInventory: _setInventory,
  pendingParcels,
  setPendingParcels,
  godowns,
  categories,
  currentUser,
  activeBusinessId,
  deliveryRecords,
  setDeliveryRecords,
  transactions: _transactions,
  setTransactions,
  updateStock: _updateStock,
  showNotification,
  onDeliveredBilty,
  actor,
  onInventoryRefresh,
}: {
  inventory: Record<string, InventoryItem>;
  setInventory: React.Dispatch<
    React.SetStateAction<Record<string, InventoryItem>>
  >;
  pendingParcels: PendingParcel[];
  setPendingParcels: React.Dispatch<React.SetStateAction<PendingParcel[]>>;
  godowns: string[];
  categories: Category[];
  currentUser: AppUser;
  activeBusinessId: string;
  deliveryRecords: DeliveryRecord[];
  setDeliveryRecords: React.Dispatch<React.SetStateAction<DeliveryRecord[]>>;
  transactions: Transaction[];
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  updateStock: (
    sku: string,
    details: Partial<InventoryItem>,
    shopDelta: number,
    godownDelta: number,
    targetGodown: string,
  ) => void;
  showNotification: (m: string, t?: string) => void;
  onDeliveredBilty?: (biltyNo: string) => void;
  actor?: any;
  onInventoryRefresh?: () => Promise<void>;
}) {
  const [viewMode, setViewMode] = useState<"new" | "timeline">("new");
  const [sourceType, setSourceType] = useState<"GODOWN" | "QUEUE">("GODOWN");
  const [selectedGodown, setSelectedGodown] = useState(godowns[0] || "");
  const [selectedBiltyId, setSelectedBiltyId] = useState<number | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryItems, setDeliveryItems] = useState<
    Array<{
      id: number;
      category: string;
      itemName: string;
      subCategory: string;
      qty: string;
    }>
  >([{ id: Date.now(), category: "", itemName: "", subCategory: "", qty: "" }]);

  // Timeline filters
  const [filterCustomer, setFilterCustomer] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterGodown, setFilterGodown] = useState("all");

  const queueEntries = pendingParcels.filter(
    (p) => !p.businessId || p.businessId === activeBusinessId,
  );

  const selectedQueue =
    selectedBiltyId != null
      ? queueEntries.find((p) => p.id === selectedBiltyId)
      : null;

  const handleQueueSelect = (id: number) => {
    setSelectedBiltyId(id);
    const entry = queueEntries.find((p) => p.id === id);
    if (entry) {
      setDeliveryItems([
        {
          id: Date.now(),
          category: entry.itemCategory || entry.category || "",
          itemName: entry.itemName || "",
          subCategory: "",
          qty: entry.packages || "1",
        },
      ]);
    }
  };

  const handleSaveDelivery = async () => {
    if (!customerName.trim())
      return showNotification("Customer name required", "error");
    if (!selectedGodown) return showNotification("Select a godown", "error");
    const validItems = deliveryItems.filter(
      (i) => i.itemName && Number(i.qty) > 0,
    );
    if (validItems.length === 0)
      return showNotification("Add at least one item with qty", "error");

    // Zero-stock check
    for (const item of validItems) {
      const existingItem = Object.values(inventory).find(
        (inv) =>
          (!inv.businessId || inv.businessId === activeBusinessId) &&
          inv.itemName.toLowerCase() === item.itemName.toLowerCase() &&
          (!item.category || inv.category === item.category),
      );
      const godownQty = existingItem?.godowns[selectedGodown] || 0;
      if (godownQty <= 0) {
        return showNotification(
          `No stock available for "${item.itemName}" in ${selectedGodown}`,
          "error",
        );
      }
      if (godownQty < Number(item.qty)) {
        return showNotification(
          `Only ${godownQty} units of "${item.itemName}" available in ${selectedGodown}`,
          "error",
        );
      }
    }

    const now = new Date().toISOString();
    const record: DeliveryRecord = {
      id: Date.now().toString(),
      type: sourceType,
      sourceGodown: selectedGodown,
      biltyNo: selectedQueue?.biltyNo,
      items: validItems.map((i) => ({
        category: i.category,
        itemName: i.itemName,
        qty: Number(i.qty),
        subCategory: i.subCategory || undefined,
      })),
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      deliveredBy: currentUser.username,
      deliveredAt: now,
      businessId: activeBusinessId,
    };

    if (sourceType === "QUEUE" && selectedQueue) {
      // Remove from queue
      setPendingParcels((prev) =>
        prev.filter((p) => p.id !== selectedQueue.id),
      );
      // Add to godown then deduct (net effect: just log)
    }

    // Log transaction
    setTransactions((prev) => [
      {
        id: Date.now(),
        type: "DELIVERY",
        biltyNo: selectedQueue?.biltyNo,
        businessId: activeBusinessId,
        date: now.split("T")[0],
        user: currentUser.username,
        fromLocation: selectedGodown,
        toLocation: customerName.trim(),
        notes: `Delivered to ${customerName}`,
        itemsCount: validItems.reduce((s, i) => s + Number(i.qty), 0),
        baleItemsList: validItems.map((item) => ({
          itemName: item.itemName,
          category: item.category,
          attributes: {},
          qty: Number(item.qty),
          shopQty: 0,
          godownQuants: { [selectedGodown]: Number(item.qty) },
          saleRate: 0,
          purchaseRate: 0,
        })),
      },
      ...prev,
    ]);

    if (actor) {
      try {
        const result = await actor.addDelivery({
          id: record.id,
          businessId: activeBusinessId,
          createdAt: BigInt(Date.now()),
          deliveredBy: currentUser.username,
          customerName: record.customerName,
          customerPhone: customerPhone || "",
          deliveryType: sourceType === "QUEUE" ? "queue" : "godown",
          biltyNumber: record.biltyNo || "",
          items: validItems.map((item: any) => ({
            itemName: item.itemName,
            category: item.category || "",
            subCategory: (() => {
              const invItem = Object.values(inventory).find(
                (inv) =>
                  (!inv.businessId || inv.businessId === activeBusinessId) &&
                  inv.category === item.category &&
                  inv.itemName?.toLowerCase() === item.itemName?.toLowerCase(),
              );
              return invItem
                ? JSON.stringify(invItem.attributes || {})
                : item.subCategory || "{}";
            })(),
            qty: BigInt(Number(item.qty)),
            godownId: selectedGodown,
          })),
        });
        if (result !== "ok") {
          showNotification(`Delivery failed: ${result}`, "error");
          return;
        }
        if (onInventoryRefresh) await onInventoryRefresh();
      } catch (e) {
        console.error(e);
        showNotification("Delivery failed: backend error", "error");
        return;
      }
    } else {
      showNotification("Not connected to backend", "error");
      return;
    }
    setDeliveryRecords((prev) => [record, ...prev]);
    // Mark queue bilty as delivered so Inward tab can check
    if (sourceType === "QUEUE" && selectedQueue?.biltyNo && onDeliveredBilty) {
      onDeliveredBilty(selectedQueue.biltyNo.toLowerCase());
    }
    setCustomerName("");
    setCustomerPhone("");
    setDeliveryItems([
      { id: Date.now(), category: "", itemName: "", subCategory: "", qty: "" },
    ]);
    setSelectedBiltyId(null);
    showNotification("Delivery recorded successfully!", "success");
  };

  const filteredRecords = deliveryRecords
    .filter((r) => !r.businessId || r.businessId === activeBusinessId)
    .filter(
      (r) =>
        !filterCustomer ||
        r.customerName.toLowerCase().includes(filterCustomer.toLowerCase()),
    )
    .filter(
      (r) => !filterDateFrom || r.deliveredAt.split("T")[0] >= filterDateFrom,
    )
    .filter((r) => !filterDateTo || r.deliveredAt.split("T")[0] <= filterDateTo)
    .filter((r) => filterGodown === "all" || r.sourceGodown === filterGodown);

  return (
    <div className="space-y-6 animate-fade-in-down">
      <div className="flex justify-between items-center border-b pb-4">
        <h2 className="text-2xl font-black text-gray-800 tracking-tighter uppercase flex items-center gap-2">
          <Truck className="text-blue-600" /> Delivery
        </h2>
        <div className="flex gap-2">
          <button
            type="button"
            data-ocid="delivery.tab"
            onClick={() => setViewMode("new")}
            className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-colors ${viewMode === "new" ? "bg-blue-600 text-white shadow-lg" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >
            New Delivery
          </button>
          <button
            type="button"
            data-ocid="delivery.timeline.tab"
            onClick={() => setViewMode("timeline")}
            className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-colors ${viewMode === "timeline" ? "bg-blue-600 text-white shadow-lg" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >
            Timeline
          </button>
        </div>
      </div>

      {viewMode === "new" && (
        <div className="space-y-6">
          {/* Source Type */}
          <div className="flex gap-3">
            <button
              type="button"
              data-ocid="delivery.godown.toggle"
              onClick={() => {
                setSourceType("GODOWN");
                setSelectedBiltyId(null);
                setDeliveryItems([
                  {
                    id: Date.now(),
                    category: "",
                    itemName: "",
                    subCategory: "",
                    qty: "",
                  },
                ]);
              }}
              className={`flex-1 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest border-2 transition-colors ${sourceType === "GODOWN" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"}`}
            >
              📦 From Godown
            </button>
            <button
              type="button"
              data-ocid="delivery.queue.toggle"
              onClick={() => {
                setSourceType("QUEUE");
                setDeliveryItems([
                  {
                    id: Date.now(),
                    category: "",
                    itemName: "",
                    subCategory: "",
                    qty: "",
                  },
                ]);
              }}
              className={`flex-1 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest border-2 transition-colors ${sourceType === "QUEUE" ? "bg-amber-500 text-white border-amber-500" : "bg-white text-gray-600 border-gray-200 hover:border-amber-300"}`}
            >
              🚚 From Queue
            </button>
          </div>

          <div className="bg-white border rounded-[2rem] p-6 space-y-5 shadow-sm">
            {/* Godown selector */}
            <div>
              <p className="text-[10px] font-black uppercase text-gray-400 mb-1">
                Source Godown
              </p>
              <select
                value={selectedGodown}
                onChange={(e) => setSelectedGodown(e.target.value)}
                data-ocid="delivery.select"
                className="w-full border rounded-xl p-3 font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
              >
                {godowns.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            {/* Queue Bilty Picker */}
            {sourceType === "QUEUE" && (
              <div>
                <p className="text-[10px] font-black uppercase text-gray-400 mb-1">
                  Select Bilty from Queue
                </p>
                <select
                  value={selectedBiltyId ?? ""}
                  onChange={(e) => handleQueueSelect(Number(e.target.value))}
                  data-ocid="delivery.bilty.select"
                  className="w-full border rounded-xl p-3 font-bold text-sm outline-none focus:ring-2 focus:ring-amber-500 bg-gray-50"
                >
                  <option value="">— Select Bilty —</option>
                  {queueEntries.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.biltyNo} {p.itemName ? `(${p.itemName})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Items */}
            <div>
              <p className="text-[10px] font-black uppercase text-gray-400 mb-2">
                Items to Deliver
              </p>
              <div className="space-y-3">
                {deliveryItems.map((item, idx) => {
                  const _inventoryItems = Object.values(inventory).filter(
                    (inv) =>
                      (!inv.businessId ||
                        inv.businessId === activeBusinessId) &&
                      (!item.category || inv.category === item.category),
                  );
                  const matchedInvForQty = item.subCategory
                    ? Object.values(inventory).find(
                        (inv) =>
                          (!inv.businessId ||
                            inv.businessId === activeBusinessId) &&
                          inv.itemName.toLowerCase() ===
                            item.itemName.toLowerCase() &&
                          Object.entries(inv.attributes || {})
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(", ") === item.subCategory,
                      )
                    : Object.values(inventory).find(
                        (inv) =>
                          (!inv.businessId ||
                            inv.businessId === activeBusinessId) &&
                          inv.itemName.toLowerCase() ===
                            item.itemName.toLowerCase(),
                      );
                  const godownQty =
                    matchedInvForQty?.godowns[selectedGodown] || 0;
                  return (
                    <div
                      key={item.id}
                      className="grid grid-cols-12 gap-2 bg-gray-50 p-3 rounded-xl"
                    >
                      <select
                        value={item.category}
                        onChange={(e) =>
                          setDeliveryItems((prev) =>
                            prev.map((x, i) =>
                              i === idx
                                ? {
                                    ...x,
                                    category: e.target.value,
                                    itemName: "",
                                  }
                                : x,
                            ),
                          )
                        }
                        className="col-span-3 border rounded-lg p-2 text-xs font-bold outline-none"
                      >
                        <option value="">Category</option>
                        {categories.map((c) => (
                          <option key={c.name} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      <div className="col-span-5 relative">
                        {/* Rich dropdown: show items with qty>0 in selected godown */}
                        {(() => {
                          const richItems = Object.values(inventory).filter(
                            (inv) =>
                              (!inv.businessId ||
                                inv.businessId === activeBusinessId) &&
                              (!item.category ||
                                inv.category === item.category) &&
                              (inv.godowns[selectedGodown] || 0) > 0,
                          );
                          return (
                            <select
                              value={`${item.itemName}|||${item.subCategory || ""}`}
                              onChange={(e) => {
                                const [name, sub] = e.target.value.split("|||");
                                setDeliveryItems((prev) =>
                                  prev.map((x, i) =>
                                    i === idx
                                      ? {
                                          ...x,
                                          itemName: name,
                                          subCategory: sub || "",
                                        }
                                      : x,
                                  ),
                                );
                              }}
                              className="w-full border rounded-lg p-2 text-xs font-bold outline-none bg-white"
                            >
                              <option value="|||">Select Item</option>
                              {richItems.map((inv) => {
                                const attrStr = Object.values(
                                  inv.attributes || {},
                                )
                                  .filter(Boolean)
                                  .join(" -- ");
                                const godownStock =
                                  inv.godowns[selectedGodown] || 0;
                                const label = attrStr
                                  ? `${inv.itemName} -- ${attrStr} -- ${godownStock} PCS -- ₹${inv.saleRate}`
                                  : `${inv.itemName} -- ${godownStock} PCS -- ₹${inv.saleRate}`;
                                const subVal = Object.entries(
                                  inv.attributes || {},
                                )
                                  .map(([k, v]) => `${k}: ${v}`)
                                  .join(", ");
                                return (
                                  <option
                                    key={inv.sku}
                                    value={`${inv.itemName}|||${subVal}`}
                                  >
                                    {label}
                                  </option>
                                );
                              })}
                            </select>
                          );
                        })()}
                        {item.itemName && (
                          <span className="text-[9px] text-gray-400 font-bold">
                            In {selectedGodown}: {godownQty}
                          </span>
                        )}
                        {/* Sub-category dropdown */}
                        {item.itemName &&
                          (() => {
                            const matchingItems = Object.values(
                              inventory,
                            ).filter(
                              (inv) =>
                                (!inv.businessId ||
                                  inv.businessId === activeBusinessId) &&
                                inv.itemName.toLowerCase() ===
                                  item.itemName.toLowerCase() &&
                                Object.keys(inv.attributes || {}).length > 0,
                            );
                            if (matchingItems.length === 0) return null;
                            const subCatOptions = matchingItems
                              .map((inv) =>
                                Object.entries(inv.attributes || {})
                                  .map(([k, v]) => `${k}: ${v}`)
                                  .join(", "),
                              )
                              .filter(Boolean);
                            if (subCatOptions.length === 0) return null;
                            return (
                              <select
                                value={item.subCategory}
                                onChange={(e) =>
                                  setDeliveryItems((prev) =>
                                    prev.map((x, i) =>
                                      i === idx
                                        ? { ...x, subCategory: e.target.value }
                                        : x,
                                    ),
                                  )
                                }
                                className="w-full border border-blue-200 rounded-lg p-1.5 mt-1 text-[10px] font-bold outline-none bg-blue-50"
                              >
                                <option value="">
                                  -- Sub-category (required) --
                                </option>
                                {matchingItems.map((inv) => {
                                  const subLabel = Object.entries(
                                    inv.attributes || {},
                                  )
                                    .map(([k, v]) => `${k}: ${v}`)
                                    .join(", ");
                                  const subGodownQty =
                                    inv.godowns[selectedGodown] || 0;
                                  const subShopQty = inv.shop || 0;
                                  return (
                                    <option
                                      key={inv.sku}
                                      value={subLabel}
                                      disabled={subGodownQty <= 0}
                                    >
                                      {subLabel || "Default"} — Godown:{" "}
                                      {subGodownQty} | Shop: {subShopQty}
                                      {subGodownQty <= 0
                                        ? " (Out of stock)"
                                        : ""}
                                    </option>
                                  );
                                })}
                              </select>
                            );
                          })()}
                      </div>
                      <input
                        type="number"
                        value={item.qty}
                        min={1}
                        onChange={(e) =>
                          setDeliveryItems((prev) =>
                            prev.map((x, i) =>
                              i === idx ? { ...x, qty: e.target.value } : x,
                            ),
                          )
                        }
                        placeholder="Qty"
                        className="col-span-2 border rounded-lg p-2 text-xs font-bold outline-none"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setDeliveryItems((prev) =>
                            prev.filter((_, i) => i !== idx),
                          )
                        }
                        className="col-span-2 bg-red-50 text-red-400 rounded-lg font-black text-xs hover:bg-red-100"
                        disabled={deliveryItems.length === 1}
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
                <button
                  type="button"
                  data-ocid="delivery.primary_button"
                  onClick={() =>
                    setDeliveryItems((prev) => [
                      ...prev,
                      {
                        id: Date.now(),
                        category: "",
                        itemName: "",
                        subCategory: "",
                        qty: "",
                      },
                    ])
                  }
                  className="w-full py-2 border-2 border-dashed border-gray-300 rounded-xl text-gray-400 font-black text-[10px] uppercase tracking-widest hover:border-blue-400 hover:text-blue-600 transition-colors"
                >
                  + Add Item
                </button>
              </div>
            </div>

            {/* Customer Name */}
            <div>
              <p className="text-[10px] font-black uppercase text-gray-400 mb-1">
                Delivered To (Customer Name)
              </p>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                data-ocid="delivery.input"
                placeholder="Customer name..."
                className="w-full border rounded-xl p-3 font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
              />
            </div>

            {/* Customer Phone */}
            <div>
              <p className="text-[10px] font-black uppercase text-gray-400 mb-1">
                Customer Phone (Optional)
              </p>
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                data-ocid="delivery.phone.input"
                placeholder="Phone number..."
                className="w-full border rounded-xl p-3 font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
              />
            </div>

            <button
              type="button"
              data-ocid="delivery.submit_button"
              onClick={handleSaveDelivery}
              className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-xs shadow-lg hover:bg-blue-700 transition-colors"
            >
              Save Delivery
            </button>
          </div>
        </div>
      )}

      {viewMode === "timeline" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-white border rounded-[2rem] p-5 shadow-sm grid grid-cols-2 md:grid-cols-4 gap-3">
            <input
              type="text"
              value={filterCustomer}
              onChange={(e) => setFilterCustomer(e.target.value)}
              placeholder="Search customer..."
              data-ocid="delivery.search_input"
              className="border rounded-xl p-2.5 text-xs font-bold outline-none col-span-2 md:col-span-1"
            />
            <input
              type="date"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              className="border rounded-xl p-2.5 text-xs font-bold outline-none"
            />
            <input
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              className="border rounded-xl p-2.5 text-xs font-bold outline-none"
            />
            <select
              value={filterGodown}
              onChange={(e) => setFilterGodown(e.target.value)}
              className="border rounded-xl p-2.5 text-xs font-bold outline-none"
            >
              <option value="all">All Godowns</option>
              {godowns.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          {filteredRecords.length === 0 ? (
            <div
              data-ocid="delivery.empty_state"
              className="text-center py-16 text-gray-400"
            >
              <Truck size={48} className="mx-auto mb-4 opacity-30" />
              <p className="font-black text-sm uppercase tracking-widest">
                No deliveries found
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRecords.map((r, idx) => (
                <div
                  key={r.id}
                  data-ocid={`delivery.item.${idx + 1}`}
                  className="bg-white border rounded-[2rem] p-5 shadow-sm"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${r.type === "GODOWN" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}
                      >
                        {r.type === "GODOWN" ? "Godown" : "Queue"}
                      </span>
                      <span className="font-black text-gray-800">
                        {r.customerName}
                        {r.customerPhone && (
                          <span className="text-[10px] text-blue-500 ml-1">
                            📞 {r.customerPhone}
                          </span>
                        )}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-gray-400">
                      {new Date(r.deliveredAt).toLocaleDateString("en-IN")}{" "}
                      {new Date(r.deliveredAt).toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10px] font-bold text-gray-500 mb-3">
                    <span>📦 {r.sourceGodown}</span>
                    <span>👤 {r.deliveredBy}</span>
                    {r.biltyNo && (
                      <span className="col-span-2">🚚 {r.biltyNo}</span>
                    )}
                  </div>
                  <div className="space-y-1">
                    {r.items.map((item, i) => (
                      <div
                        key={`${r.id}-item-${item.itemName}-${i}`}
                        className="flex justify-between bg-gray-50 rounded-lg px-3 py-1.5 text-xs font-bold"
                      >
                        <span>
                          {item.category} — {item.itemName}
                        </span>
                        <span className="text-blue-700">×{item.qty}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ================= MAIN APP ================= */

export { DeliveryTab };
