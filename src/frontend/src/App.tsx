import {
  AlertCircle,
  ArrowRightLeft,
  BarChart2,
  CheckCircle,
  History,
  LayoutDashboard,
  LogOut,
  Navigation,
  Package,
  PackagePlus,
  PlusCircle,
  Receipt,
  Settings,
  ShoppingCart,
  Truck,
  User,
  Warehouse,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  Category as BackendCategory,
  Godown as BackendGodown,
  SubCategory as BackendSubCategory,
  User as BackendUser,
  Role,
} from "./backend";
import { Role as RoleEnum } from "./backend";
import { AnalyticsTab } from "./components/AnalyticsTab";
import { DashboardTab, ItemHistoryPanel } from "./components/DashboardTab";
import { DeliveryTab } from "./components/DeliveryTab";
import { GodownStockTab } from "./components/GodownStockTab";
import { HistoryTab } from "./components/HistoryTab";
import { InwardSavedTab } from "./components/InwardSavedTab";
import { InwardTab } from "./components/InwardTab";
import {
  LoginScreen,
  NavButton,
  SidebarButton,
} from "./components/LoginScreen";
import { OpeningStockTab } from "./components/OpeningStockTab";
import { SalesRecordTab } from "./components/SalesRecordTab";
import { SalesTab } from "./components/SalesTab";
import { SettingsTab } from "./components/SettingsTab";
import { TransferTab } from "./components/TransferTab";
import { TransitTab } from "./components/TransitTab";
import { WarehouseTab } from "./components/WarehouseTab";
import { INITIAL_CATEGORIES, formatItemName } from "./constants";
import type {
  InventoryItem as BackendInventoryItem,
  InwardSavedEntry as BackendInwardSavedEntry,
  QueueEntry as BackendQueueEntry,
  TransitEntry as BackendTransitEntry,
  DeliveryEntry,
  GodownQty,
  InwardItem,
  QueueBale,
  SaleEntry,
  TransferEntry,
  TxRecord,
} from "./declarations/backend.did";
import { useActor } from "./hooks/useActor";
import { useInternetIdentity } from "./hooks/useInternetIdentity";
import type {
  AppUser,
  Business,
  Category,
  CustomColumns,
  DeliveryRecord,
  InventoryItem,
  InwardRecord,
  InwardSavedEntry,
  PendingParcel,
  Transaction,
  TransitRecord,
} from "./types";

// ---- Type converters ----
function fromBackendRole(r: Role): "admin" | "staff" | "supplier" {
  if (r === RoleEnum.admin) return "admin";
  if (r === RoleEnum.supplier) return "supplier";
  return "staff";
}

function toBackendRole(s: string): Role {
  if (s === "admin") return RoleEnum.admin;
  if (s === "supplier") return RoleEnum.supplier;
  return RoleEnum.staff;
}

function fromBackendUser(u: BackendUser): AppUser & { _backendId: string } {
  return {
    _backendId: u.id,
    username: u.username,
    password: u.password,
    role: fromBackendRole(u.role),
    assignedBusinessIds: u.businessIds,
  } as AppUser & { _backendId: string };
}

function fromBackendCategory(c: BackendCategory): Category {
  return {
    name: c.name,
    fields: c.subCategories.map((sc: BackendSubCategory) => ({
      name: sc.name,
      type: sc.fieldType as "text" | "select",
      options: sc.options.length > 0 ? sc.options : undefined,
    })),
  };
}

// ---- Transactional converters ----

function toBackendTransit(t: TransitRecord): BackendTransitEntry {
  return {
    id: String(t.id),
    biltyNumber: t.biltyNo,
    transport: t.transportName,
    supplier: t.supplierName,
    category: t.category || t.itemCategory || "",
    itemName: t.itemName,
    packages: BigInt(Number.parseInt(t.packages) || 1),
    biltyDate: t.date,
    businessId: t.businessId,
    enteredBy: t.addedBy,
    createdAt: BigInt(Date.now()),
  };
}

function fromBackendTransit(e: BackendTransitEntry): TransitRecord {
  return {
    id: Number.parseInt(e.id) || 0,
    biltyNo: e.biltyNumber,
    transportName: e.transport,
    supplierName: e.supplier,
    category: e.category,
    itemCategory: e.category,
    itemName: e.itemName,
    packages: String(e.packages),
    date: e.biltyDate,
    addedBy: e.enteredBy,
    businessId: e.businessId,
    customData: {},
  };
}

function toBackendQueue(p: PendingParcel): BackendQueueEntry {
  const meta = JSON.stringify({
    packages: p.packages,
    dateReceived: p.dateReceived,
    arrivalDate: p.arrivalDate,
    customData: p.customData,
    itemName: p.itemName,
    category: p.category,
    itemCategory: p.itemCategory,
    addedBy: (p as any).addedBy,
  });
  return {
    id: String(p.id),
    biltyNumber: p.biltyNo,
    transport: p.transportName,
    supplier: p.supplier || "",
    enteredBy: (p as any).addedBy || "",
    businessId: p.businessId,
    delivered: false,
    createdAt: BigInt(Date.now()),
    bales: [
      { status: "meta", baleLabel: "__meta__", itemName: meta, category: "" },
    ],
  };
}

function fromBackendQueue(e: BackendQueueEntry): PendingParcel {
  const metaBale = e.bales.find((b: QueueBale) => b.baleLabel === "__meta__");
  let meta: Record<string, any> = {};
  if (metaBale) {
    try {
      meta = JSON.parse(metaBale.itemName);
    } catch {
      /* */
    }
  }
  return {
    id: Number.parseInt(e.id) || 0,
    biltyNo: e.biltyNumber,
    transportName: e.transport,
    supplier: e.supplier,
    packages: meta.packages || "1",
    dateReceived:
      meta.dateReceived ||
      new Date(Number(e.createdAt)).toISOString().split("T")[0],
    arrivalDate: meta.arrivalDate,
    businessId: e.businessId,
    customData: meta.customData || {},
    itemName: meta.itemName,
    category: meta.category,
    itemCategory: meta.itemCategory,
  } as PendingParcel;
}

function toBackendInwardSaved(
  entry: InwardSavedEntry,
): BackendInwardSavedEntry {
  return {
    id: String(entry.id),
    biltyNumber: entry.biltyNumber,
    businessId: entry.businessId,
    supplier: entry.supplier,
    transport: entry.transporter,
    savedBy: entry.savedBy,
    savedAt: BigInt(new Date(entry.savedAt).getTime()),
    items: entry.items.map((item) => ({
      category: item.category,
      itemName: item.itemName,
      subCategory: JSON.stringify(item.attributes || {}),
      totalQty: BigInt(Math.round(item.qty)),
      shopQty: BigInt(Math.round(item.shopQty)),
      purchaseRate: item.purchaseRate,
      saleRate: item.saleRate,
      godownQtys:
        item.godownQuants && Object.keys(item.godownQuants).length > 0
          ? Object.entries(item.godownQuants).map(([godownId, qty]) => ({
              godownId,
              qty: BigInt(Math.round(qty || 0)),
            }))
          : [
              {
                godownId: "Main Godown",
                qty: BigInt(Math.round(item.godownQty)),
              },
            ],
    })),
  };
}

function fromBackendInwardSaved(e: BackendInwardSavedEntry): InwardSavedEntry {
  return {
    id: Number.parseInt(e.id) || 0,
    biltyNumber: e.biltyNumber,
    baseNumber: e.biltyNumber.replace(/X\d+\(\d+\)$/i, ""),
    packages: String(e.items.length),
    businessId: e.businessId,
    supplier: e.supplier,
    transporter: e.transport,
    savedBy: e.savedBy,
    savedAt: new Date(Number(e.savedAt)).toISOString(),
    items: e.items.map((item: InwardItem) => {
      let attrs: Record<string, string> = {};
      let godownQty = Number(item.godownQtys[0]?.qty || 0n);
      try {
        const m = JSON.parse(item.subCategory);
        attrs = m.attributes ?? m;
        if (m.godownQty != null) godownQty = Number(m.godownQty);
      } catch {
        /* */
      }
      return {
        category: item.category,
        itemName: item.itemName,
        qty: Number(item.totalQty),
        godownQty,
        shopQty: Number(item.shopQty),
        saleRate: item.saleRate,
        purchaseRate: item.purchaseRate,
        attributes: attrs,
      };
    }),
  };
}

function toBackendInventory(item: InventoryItem): BackendInventoryItem {
  return {
    id: item.sku,
    businessId: item.businessId,
    category: item.category,
    itemName: item.itemName,
    subCategory: JSON.stringify(item.attributes || {}),
    shopQty: BigInt(Math.round(item.shop || 0)),
    godownQtys: Object.entries(item.godowns || {}).map(([godownId, qty]) => ({
      godownId,
      qty: BigInt(Math.round(qty || 0)),
    })),
    saleRate: item.saleRate || 0,
    purchaseRate: item.purchaseRate || 0,
  };
}

function fromBackendInventory(
  e: BackendInventoryItem,
): [string, InventoryItem] {
  const attrs = (() => {
    try {
      return JSON.parse(e.subCategory);
    } catch {
      return {};
    }
  })();
  const item: InventoryItem = {
    sku: e.id,
    category: e.category,
    itemName: e.itemName,
    attributes: attrs,
    shop: Number(e.shopQty),
    godowns: Object.fromEntries(
      e.godownQtys.map((g: GodownQty) => [g.godownId, Number(g.qty)]),
    ),
    saleRate: e.saleRate,
    purchaseRate: e.purchaseRate,
    businessId: e.businessId,
  };
  return [e.id, item];
}

function fromBackendDelivery(e: DeliveryEntry): DeliveryRecord {
  return {
    id: e.id,
    type:
      e.deliveryType === "QUEUE" || e.deliveryType === "queue"
        ? "QUEUE"
        : "GODOWN",
    sourceGodown: e.items[0]?.godownId || "",
    biltyNo: e.biltyNumber || undefined,
    items: e.items.map((i) => ({
      category: i.category,
      itemName: i.itemName,
      qty: Number(i.qty),
      subCategory: i.subCategory || undefined,
    })),
    customerName: e.customerName,
    customerPhone: e.customerPhone || undefined,
    deliveredBy: e.deliveredBy,
    deliveredAt: new Date(Number(e.createdAt)).toISOString(),
    businessId: e.businessId,
  };
}

function fromBackendTxRecord(e: TxRecord): Transaction {
  const txTypeKey = Object.keys(e.txType)[0];
  return {
    id: Number.parseInt(e.id) || Math.floor(Math.random() * 1_000_000),
    type: txTypeKey ? txTypeKey.toUpperCase() : "INWARD",
    biltyNo: e.biltyNumber || undefined,
    businessId: e.businessId,
    date: new Date(Number(e.createdAt)).toISOString(),
    user: e.enteredBy,
    transportName: e.transport || undefined,
    itemName: e.itemName || undefined,
    category: e.category || undefined,
    notes: e.notes || undefined,
    fromLocation: e.fromLocation || undefined,
    toLocation: e.toLocation || undefined,
    subCategory: e.subCategory || undefined,
  };
}

export default function App() {
  const { actor } = useActor();
  const {
    identity,
    login: loginWithII,
    isInitializing: iiInitializing,
  } = useInternetIdentity();

  // Load persisted UI config once from localStorage
  const savedConfig = (() => {
    try {
      const raw = localStorage.getItem("stockflow_ui_config");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  })();

  const [activeTab, setActiveTab] = useState("dashboard");
  const [notification, setNotification] = useState<{
    message: string;
    type: string;
  } | null>(null);
  const [minStockThreshold, setMinStockThreshold] = useState<number>(
    savedConfig?.minStockThreshold ?? 10,
  );
  const [confirmDialog, setConfirmDialog] = useState<{
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const [promptDialog, setPromptDialog] = useState<{
    message: string;
    defaultValue?: string;
    onConfirm: (v: string) => void;
  } | null>(null);

  const [businesses, setBusinesses] = useState<Business[]>([
    { id: "default", name: "StockFlow Default" },
  ]);
  const [activeBusinessId, setActiveBusinessId] = useState("default");
  const [inventory, setInventory] = useState<Record<string, InventoryItem>>({});
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pendingParcels, setPendingParcels] = useState<PendingParcel[]>([]);
  const [transitGoods, setTransitGoods] = useState<TransitRecord[]>([]);
  const [categories, setCategories] = useState<Category[]>(INITIAL_CATEGORIES);
  const [godowns, setGodowns] = useState<string[]>([
    "Main Godown",
    "Side Godown",
  ]);
  const [biltyPrefixes, setBiltyPrefixes] = useState<string[]>([
    "sola",
    "erob",
    "cheb",
    "0",
  ]);
  const [customColumns, setCustomColumns] = useState<CustomColumns>(
    savedConfig?.customColumns ?? {
      transit: [],
      warehouse: [],
      inward: [],
    },
  );
  const [users, setUsers] = useState<AppUser[]>([
    { username: "admin", password: "password", role: "admin" },
    { username: "staff", password: "password", role: "staff" },
    { username: "supplier", password: "password", role: "supplier" },
  ]);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => {
    try {
      const saved = localStorage.getItem("stockflow_user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [openingParcel, setOpeningParcel] = useState<PendingParcel | null>(
    null,
  );
  const [transportTracking, setTransportTracking] = useState<
    Record<string, string>
  >({});
  const [fieldLabels, setFieldLabels] = useState<
    Record<string, Record<string, string>>
  >(savedConfig?.fieldLabels ?? {});
  const [requiredFields, setRequiredFields] = useState<
    Record<string, Record<string, boolean>>
  >(savedConfig?.requiredFields ?? {});
  const [fieldOrder, setFieldOrder] = useState<Record<string, string[]>>(
    savedConfig?.fieldOrder ?? {},
  );
  const [fieldTypes, setFieldTypes] = useState<
    Record<string, Record<string, "text" | "combo" | "drop">>
  >(savedConfig?.fieldTypes ?? {});
  const [fieldComboOptions, setFieldComboOptions] = useState<
    Record<string, Record<string, string[]>>
  >(savedConfig?.fieldComboOptions ?? {});
  const [customTabFields, setCustomTabFields] = useState<
    Record<string, { key: string; label: string }[]>
  >({});
  const [tabNames, setTabNames] = useState<Record<string, string>>(
    savedConfig?.tabNames ?? {
      dashboard: "Inventory Hub",
      transit: "Transit Ledger",
      warehouse: "Arrival Queue",
      inward: "Inward Processing",
      opening: "Opening Stock",
      transfer: "Transfers",
      sales: "Sales",
      history: "History Log",
      inwardSaved: "Inward Saved",
      godownStock: "Godown Stock",
      analytics: "Analytics",
      delivery: "Delivery",
      salesRecord: "Sales Record",
      settings: "Admin Settings",
    },
  );
  const [_inwardRecords, _setInwardRecords] = useState<InwardRecord[]>([]);
  const [inwardSaved, setInwardSaved] = useState<InwardSavedEntry[]>([]);
  const [thresholdExcludedItems, setThresholdExcludedItems] = useState<
    string[]
  >(savedConfig?.thresholdExcludedItems ?? []);
  const [deliveryRecords, setDeliveryRecords] = useState<DeliveryRecord[]>([]);
  const [_transfers, setTransfers] = useState<TransferEntry[]>([]);
  const [deliveredBilties, setDeliveredBilties] = useState<string[]>([]);
  const [isBackendReady, setIsBackendReady] = useState(false);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<string | null>(
    null,
  );

  const refreshInventory = async (businessId?: string) => {
    if (!actor) return;
    const freshInv = await (actor as any).getInventory(
      businessId || activeBusinessId,
    );
    const invMap: Record<string, InventoryItem> = {};
    for (const e of freshInv as BackendInventoryItem[]) {
      const [k, v] = fromBackendInventory(e);
      invMap[k] = v;
    }
    setInventory(invMap);
  };

  const [moveToQueueData, setMoveToQueueData] = useState<TransitRecord | null>(
    null,
  );

  // Refs for tracking current state in synced setters
  const usersRef = useRef(users);
  useEffect(() => {
    usersRef.current = users;
  }, [users]);

  const businessesRef = useRef(businesses);
  useEffect(() => {
    businessesRef.current = businesses;
  }, [businesses]);

  const godownsRef = useRef(godowns);
  useEffect(() => {
    godownsRef.current = godowns;
  }, [godowns]);

  const categoriesRef = useRef(categories);
  useEffect(() => {
    categoriesRef.current = categories;
  }, [categories]);

  const biltyPrefixesRef = useRef(biltyPrefixes);
  useEffect(() => {
    biltyPrefixesRef.current = biltyPrefixes;
  }, [biltyPrefixes]);

  const transportTrackingRef = useRef(transportTracking);
  useEffect(() => {
    transportTrackingRef.current = transportTracking;
  }, [transportTracking]);

  const transitGoodsRef = useRef(transitGoods);
  useEffect(() => {
    transitGoodsRef.current = transitGoods;
  }, [transitGoods]);

  const pendingParcelsRef = useRef(pendingParcels);
  useEffect(() => {
    pendingParcelsRef.current = pendingParcels;
  }, [pendingParcels]);

  const inwardSavedRef = useRef(inwardSaved);
  useEffect(() => {
    inwardSavedRef.current = inwardSaved;
  }, [inwardSaved]);

  const inventoryRef = useRef(inventory);
  const pendingInvRef = useRef<Record<string, InventoryItem> | null>(null);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    inventoryRef.current = inventory;
  }, [inventory]);

  const transactionsRef = useRef(transactions);
  useEffect(() => {
    transactionsRef.current = transactions;
  }, [transactions]);

  const deliveryRecordsRef = useRef(deliveryRecords);
  useEffect(() => {
    deliveryRecordsRef.current = deliveryRecords;
  }, [deliveryRecords]);

  // Maps for backend IDs
  const godownMapRef = useRef<
    Record<string, { id: string; businessId: string }>
  >({});
  const categoryMapRef = useRef<
    Record<string, { id: string; subCategories: BackendSubCategory[] }>
  >({});
  const businessMapRef = useRef<Record<string, string>>({}); // name -> id (businesses already have id)
  const biltyPrefixIdMapRef = useRef<Record<string, string>>({}); // prefix -> id
  const transportTrackerIdMapRef = useRef<Record<string, string>>({}); // transport key -> id

  // Load all data from backend on actor ready (config + transactional in one pass)
  useEffect(() => {
    if (!actor) return;
    (async () => {
      try {
        const [
          backendUsers,
          backendBusinesses,
          backendGodowns,
          backendCats,
          backendPrefixes,
          backendTrackers,
        ] = await Promise.all([
          actor.getUsers(),
          actor.getBusinesses(),
          actor.getGodowns(),
          actor.getCategories(),
          actor.getBiltyPrefixes(),
          actor.getTransportTrackers(),
        ]);

        if (backendUsers.length > 0) {
          setUsers(backendUsers.map(fromBackendUser) as AppUser[]);
        }
        let resolvedBusinessId = "b1";
        if (backendBusinesses.length > 0) {
          setBusinesses(backendBusinesses);
          resolvedBusinessId = backendBusinesses[0].id;
          for (const b of backendBusinesses) {
            businessMapRef.current[b.name] = b.id;
          }
        }
        setActiveBusinessId(resolvedBusinessId);
        if (backendGodowns.length > 0) {
          setGodowns(backendGodowns.map((g: BackendGodown) => g.name));
          for (const g of backendGodowns) {
            godownMapRef.current[g.name] = {
              id: g.id,
              businessId: g.businessId,
            };
          }
        }
        if (backendCats.length > 0) {
          setCategories(backendCats.map(fromBackendCategory));
          for (const c of backendCats) {
            categoryMapRef.current[c.name] = {
              id: c.id,
              subCategories: c.subCategories,
            };
          }
        }
        if (backendPrefixes.length > 0) {
          setBiltyPrefixes(backendPrefixes.map((p) => p.prefix));
          for (const p of backendPrefixes) {
            biltyPrefixIdMapRef.current[p.prefix] = p.id;
          }
        }
        if (backendTrackers.length > 0) {
          setTransportTracking(
            Object.fromEntries(
              backendTrackers.map((t) => [t.transport, t.trackingUrl]),
            ),
          );
          for (const t of backendTrackers) {
            transportTrackerIdMapRef.current[t.transport] = t.id;
          }
        }

        // Fetch transactional data using the businessId resolved above (no state timing issue)
        const [
          backendTransit,
          backendQueue,
          backendInwardSaved,
          backendInventory,
          backendDeliveries,
          backendTxHistory,
          backendTransfers,
          backendSales,
          backendAppSettings,
        ] = await Promise.all([
          (actor as any).getTransitEntries(resolvedBusinessId),
          (actor as any).getQueueEntries(resolvedBusinessId),
          (actor as any).getInwardSaved(resolvedBusinessId),
          (actor as any).getInventory(resolvedBusinessId),
          (actor as any).getDeliveries(resolvedBusinessId),
          (actor as any).getTxHistory(resolvedBusinessId),
          (actor as any).getTransfers(resolvedBusinessId),
          (actor as any).getSales(resolvedBusinessId),
          (actor as any).getAppSettings(),
        ]);
        setTransitGoods(
          (backendTransit as BackendTransitEntry[]).map(fromBackendTransit),
        );
        setPendingParcels(
          (backendQueue as BackendQueueEntry[])
            .filter((e) => !e.delivered)
            .map(fromBackendQueue),
        );
        setInwardSaved(
          (backendInwardSaved as BackendInwardSavedEntry[]).map(
            fromBackendInwardSaved,
          ),
        );
        const invMap: Record<string, InventoryItem> = {};
        for (const e of backendInventory as BackendInventoryItem[]) {
          const [k, v] = fromBackendInventory(e);
          invMap[k] = v;
        }
        setInventory(invMap);
        const deliveries = (backendDeliveries as DeliveryEntry[]).map(
          fromBackendDelivery,
        );
        setDeliveryRecords(deliveries);
        setDeliveredBilties(
          deliveries
            .filter((d) => d.type === "QUEUE" && d.biltyNo)
            .map((d) => d.biltyNo as string),
        );
        setTransactions(
          (backendTxHistory as TxRecord[]).map(fromBackendTxRecord),
        );
        setTransfers(backendTransfers as TransferEntry[]);
        // Merge backend sales into transactions as SALE type entries
        const backendSaleList = (backendSales as any[]) || [];
        if (backendSaleList.length > 0) {
          const saleTxns: Transaction[] = backendSaleList.map((s: any) => ({
            id: Number.parseInt(s.id) || Math.floor(Math.random() * 1_000_000),
            type: "SALE",
            businessId: s.businessId,
            date: new Date(Number(s.createdAt)).toISOString().split("T")[0],
            user: s.recordedBy || "",
            itemName: s.items?.[0]?.itemName || "Sale",
            category: s.items?.[0]?.category || "",
            itemsCount:
              s.items?.reduce(
                (sum: number, i: any) => sum + Number(i.qty),
                0,
              ) || 0,
            notes:
              s.items
                ?.map((i: any) => `${i.itemName} x${Number(i.qty)} @₹${i.rate}`)
                .join(", ") || "",
          }));
          setTransactions((prev) => {
            const existingSaleIds = new Set(
              prev.filter((t) => t.type === "SALE").map((t) => t.id),
            );
            const newSales = saleTxns.filter((t) => !existingSaleIds.has(t.id));
            return [...prev, ...newSales];
          });
        }
        // Load persisted app settings from backend (overrides localStorage)
        if (backendAppSettings && (backendAppSettings as string).length > 0) {
          try {
            const bs = JSON.parse(backendAppSettings as string);
            if (bs.tabNames) setTabNames(bs.tabNames);
            if (bs.fieldLabels) setFieldLabels(bs.fieldLabels);
            if (bs.requiredFields) setRequiredFields(bs.requiredFields);
            if (bs.minStockThreshold != null)
              setMinStockThreshold(bs.minStockThreshold);
            if (bs.thresholdExcludedItems)
              setThresholdExcludedItems(bs.thresholdExcludedItems);
          } catch {
            // malformed blob — ignore, keep localStorage values
          }
        }
        setIsBackendReady(true);
      } catch (e) {
        console.error("Failed to load data from backend:", e);
        setIsBackendReady(true); // allow UI to function even if backend load fails
      }
    })();
  }, [actor]);

  // Synced setters
  const setUsersWithBackend: React.Dispatch<React.SetStateAction<AppUser[]>> = (
    updater,
  ) => {
    const prev = usersRef.current;
    const next =
      typeof updater === "function"
        ? (updater as (p: AppUser[]) => AppUser[])(prev)
        : updater;
    setUsers(next);
    if (!actor) return;
    const added = next.filter(
      (u: AppUser) => !prev.find((p) => p.username === u.username),
    );
    const deleted = prev.filter(
      (p) => !next.find((u: AppUser) => u.username === p.username),
    );
    const updated = next.filter((u: AppUser) => {
      const old = prev.find((p) => p.username === u.username);
      return old && JSON.stringify(old) !== JSON.stringify(u);
    });
    for (const u of added) {
      const id = (u as any)._backendId || u.username;
      actor
        .addUser(
          id,
          u.username,
          u.password,
          toBackendRole(u.role),
          u.assignedBusinessIds || [],
        )
        .catch(handleWriteError("write"));
    }
    for (const u of deleted) {
      const backendId = (u as any)._backendId || u.username;
      actor.deleteUser(backendId).catch(handleWriteError('"user delete"'));
    }
    for (const u of updated) {
      const backendId = (u as any)._backendId || u.username;
      actor
        .updateUser(
          backendId,
          u.username,
          u.password,
          toBackendRole(u.role),
          u.assignedBusinessIds || [],
        )
        .catch(handleWriteError("write"));
    }
  };

  const setBusinessesWithBackend: React.Dispatch<
    React.SetStateAction<Business[]>
  > = (updater) => {
    const prev = businessesRef.current;
    const next =
      typeof updater === "function"
        ? (updater as (p: Business[]) => Business[])(prev)
        : updater;
    setBusinesses(next);
    if (!actor) return;
    const added = next.filter(
      (b: Business) => !prev.find((p) => p.id === b.id),
    );
    const deleted = prev.filter(
      (p) => !next.find((b: Business) => b.id === p.id),
    );
    const updated = next.filter((b: Business) => {
      const old = prev.find((p) => p.id === b.id);
      return old && old.name !== b.name;
    });
    for (const b of added)
      actor.addBusiness(b.id, b.name).catch(handleWriteError('"business"'));
    for (const b of deleted)
      actor.deleteBusiness(b.id).catch(handleWriteError('"business delete"'));
    for (const b of updated)
      actor
        .updateBusiness(b.id, b.name)
        .catch(handleWriteError('"business update"'));
  };

  const setGodownsWithBackend: React.Dispatch<
    React.SetStateAction<string[]>
  > = (updater) => {
    const prev = godownsRef.current;
    const next =
      typeof updater === "function"
        ? (updater as (p: string[]) => string[])(prev)
        : updater;
    setGodowns(next);
    if (!actor) return;
    const added = next.filter((name: string) => !prev.includes(name));
    const deleted = prev.filter((name) => !next.includes(name));
    for (const name of added) {
      const id = `${name.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`;
      godownMapRef.current[name] = { id, businessId: activeBusinessId };
      actor
        .addGodown(id, name, activeBusinessId)
        .catch(handleWriteError('"godown"'));
    }
    for (const name of deleted) {
      const mapping = godownMapRef.current[name];
      if (mapping)
        actor
          .deleteGodown(mapping.id)
          .catch(handleWriteError('"godown delete"'));
    }
  };

  const setCategoriesWithBackend: React.Dispatch<
    React.SetStateAction<Category[]>
  > = (updater) => {
    const prev = categoriesRef.current;
    const next =
      typeof updater === "function"
        ? (updater as (p: Category[]) => Category[])(prev)
        : updater;
    setCategories(next);
    if (!actor) return;
    const added = next.filter(
      (c: Category) => !prev.find((p) => p.name === c.name),
    );
    const deleted = prev.filter(
      (p) => !next.find((c: Category) => c.name === p.name),
    );
    const updated = next.filter((c: Category) => {
      const old = prev.find((p) => p.name === c.name);
      return old && JSON.stringify(old) !== JSON.stringify(c);
    });
    for (const c of added) {
      const id = c.name.toLowerCase().replace(/\s+/g, "-");
      actor.addCategory(id, c.name).catch(handleWriteError('"category"'));
      for (const f of c.fields) {
        const sc: BackendSubCategory = {
          id: f.name.toLowerCase().replace(/\s+/g, "-"),
          name: f.name,
          fieldType: f.type,
          options: f.options || [],
        };
        actor.addSubCategory(id, sc).catch(handleWriteError('"subcategory"'));
      }
    }
    for (const c of deleted) {
      const mapping = categoryMapRef.current[c.name];
      const catId = mapping?.id || c.name.toLowerCase().replace(/\s+/g, "-");
      actor.deleteCategory(catId).catch(handleWriteError('"category delete"'));
    }
    for (const c of updated) {
      const mapping = categoryMapRef.current[c.name];
      const catId = mapping?.id || c.name.toLowerCase().replace(/\s+/g, "-");
      const oldSubs = mapping?.subCategories || [];
      const newSubs = c.fields.map(
        (f) =>
          ({
            id: f.name.toLowerCase().replace(/\s+/g, "-"),
            name: f.name,
            fieldType: f.type,
            options: f.options || [],
          }) as BackendSubCategory,
      );
      for (const s of oldSubs)
        actor
          .deleteSubCategory(catId, s.id)
          .catch(handleWriteError('"subcategory delete"'));
      for (const s of newSubs)
        actor.addSubCategory(catId, s).catch(handleWriteError('"subcategory"'));
    }
  };

  const setBiltyPrefixesWithBackend: React.Dispatch<
    React.SetStateAction<string[]>
  > = (updater) => {
    const prev = biltyPrefixesRef.current;
    const next =
      typeof updater === "function"
        ? (updater as (p: string[]) => string[])(prev)
        : updater;
    setBiltyPrefixes(next);
    if (!actor) return;
    const added = next.filter((p: string) => !prev.includes(p));
    const deleted = prev.filter((p) => !next.includes(p));
    for (const p of added) {
      const id = biltyPrefixIdMapRef.current[p] || p;
      actor.addBiltyPrefix(id, p).catch(handleWriteError('"bilty prefix"'));
    }
    for (const p of deleted) {
      const id = biltyPrefixIdMapRef.current[p] || p;
      actor
        .deleteBiltyPrefix(id)
        .catch(handleWriteError('"bilty prefix delete"'));
    }
  };

  const setTransportTrackingWithBackend: React.Dispatch<
    React.SetStateAction<Record<string, string>>
  > = (updater) => {
    const prev = transportTrackingRef.current;
    const next =
      typeof updater === "function"
        ? (updater as (p: Record<string, string>) => Record<string, string>)(
            prev,
          )
        : updater;
    setTransportTracking(next);
    if (!actor) return;
    const prevKeys = Object.keys(prev);
    const nextKeys = Object.keys(next);
    const added = nextKeys.filter((k) => !prevKeys.includes(k));
    const deleted = prevKeys.filter((k) => !nextKeys.includes(k));
    const updated = nextKeys.filter(
      (k) => prevKeys.includes(k) && prev[k] !== next[k],
    );
    for (const k of added) {
      const id = transportTrackerIdMapRef.current[k] || k;
      actor
        .addTransportTracker(id, k, next[k])
        .catch(handleWriteError('"transport tracker"'));
    }
    for (const k of deleted) {
      const id = transportTrackerIdMapRef.current[k] || k;
      actor
        .deleteTransportTracker(id)
        .catch(handleWriteError('"transport tracker delete"'));
    }
    for (const k of updated) {
      const id = transportTrackerIdMapRef.current[k] || k;
      actor
        .updateTransportTracker(id, k, next[k])
        .catch(handleWriteError('"transport tracker update"'));
    }
  };

  // Backend login helper
  const loginViaBackend = actor
    ? async (username: string, password: string): Promise<AppUser | null> => {
        try {
          const result = await actor.login(username, password);
          if ("ok" in result) return fromBackendUser(result.ok) as AppUser;
          return null;
        } catch {
          return null;
        }
      }
    : undefined;

  useEffect(() => {
    const style = document.createElement("style");
    style.innerHTML = `
      @keyframes fadeInDown { 0% { opacity: 0; transform: translateY(-10px); } 100% { opacity: 1; transform: translateY(0); } }
      .animate-fade-in-down { animation: fadeInDown 0.3s ease-out forwards; }
      .scrollbar-hide::-webkit-scrollbar { display: none; }
      .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  useEffect(() => {
    if (currentUser?.role === "supplier" && activeTab !== "transit")
      setActiveTab("transit");
  }, [currentUser, activeTab]);

  // Morning backup reminder for admin
  useEffect(() => {
    if (currentUser?.role === "admin") {
      const today = new Date().toDateString();
      const lastReminder = localStorage.getItem("stockflow_backup_reminder");
      if (lastReminder !== today) {
        localStorage.setItem("stockflow_backup_reminder", today);
        setTimeout(() => {
          setNotification({
            message: "Reminder: Please download a data backup today!",
            type: "warning",
          });
          setTimeout(() => setNotification(null), 6000);
        }, 1500);
      }
    }
  }, [currentUser]);

  const showNotification = (message: string, type = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const handleWriteError = (label: string) => (err: unknown) => {
    console.error(err);
    showNotification(`Save failed: ${label}. Please try again.`, "error");
  };

  // Persist UI config to localStorage on change
  useEffect(() => {
    localStorage.setItem(
      "stockflow_ui_config",
      JSON.stringify({
        fieldLabels,
        requiredFields,
        fieldOrder,
        fieldTypes,
        fieldComboOptions,
        tabNames,
        customColumns,
        minStockThreshold,
        thresholdExcludedItems,
      }),
    );
    // Also persist settings to the Motoko backend so they survive device changes and localStorage clears
    if (actor && isBackendReady) {
      const blob = JSON.stringify({
        tabNames,
        fieldLabels,
        requiredFields,
        minStockThreshold,
        thresholdExcludedItems,
      });
      (actor as any)
        .saveAppSettings(blob)
        .catch((e: unknown) => console.warn("Settings save failed:", e));
    }
  }, [
    fieldLabels,
    requiredFields,
    fieldOrder,
    fieldTypes,
    fieldComboOptions,
    tabNames,
    customColumns,
    minStockThreshold,
    thresholdExcludedItems,
    actor,
    isBackendReady,
  ]);

  // setTransactionsWithBackend: local state only.
  // The backend auto-writes to txHistory inside saveInward, addSale, addDelivery, postTransfer.
  // Calling addTxRecord from here would cause double-writes.
  const setTransactionsWithBackend = (updaterOrArray: any) => {
    const prev = transactionsRef.current;
    const next: Transaction[] =
      typeof updaterOrArray === "function"
        ? updaterOrArray(prev)
        : updaterOrArray;
    setTransactions(next);
  };

  // setDeliveryRecordsWithBackend
  const setDeliveryRecordsWithBackend: React.Dispatch<
    React.SetStateAction<DeliveryRecord[]>
  > = (updaterOrArray) => {
    setDeliveryRecords(updaterOrArray);
  };

  const generateSku = (
    category: string,
    itemName: string,
    attributes: Record<string, string>,
    saleRate: string,
    businessId: string,
  ) => {
    const attrStr = Object.entries(attributes || {})
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, v]) => `${k}:${v}`)
      .join("|");
    const baseSku = btoa(
      encodeURIComponent(
        `${category}|${formatItemName(itemName)}|${attrStr}|${saleRate || 0}`,
      ),
    );
    return businessId ? `${businessId}_${baseSku}` : baseSku;
  };

  const setTransitGoodsWithBackend: React.Dispatch<
    React.SetStateAction<TransitRecord[]>
  > = (updater) => {
    const prev = transitGoodsRef.current;
    const next =
      typeof updater === "function"
        ? (updater as (p: TransitRecord[]) => TransitRecord[])(prev)
        : updater;
    setTransitGoods(next);
    if (!actor) return;
    const added = next.filter((n) => !prev.find((p) => p.id === n.id));
    const deleted = prev.filter((p) => !next.find((n) => n.id === p.id));
    const updated = next.filter((n) => {
      const old = prev.find((p) => p.id === n.id);
      return old && JSON.stringify(old) !== JSON.stringify(n);
    });
    for (const t of added)
      (actor as any)
        .addTransitEntry(toBackendTransit(t))
        .catch(handleWriteError('"transit entry"'));
    for (const t of deleted)
      (actor as any)
        .deleteTransitEntry(String(t.id))
        .catch(handleWriteError('"transit delete"'));
    for (const t of updated)
      (actor as any)
        .updateTransitEntry(toBackendTransit(t))
        .catch(handleWriteError("write"));
  };

  const setPendingParcelsWithBackend: React.Dispatch<
    React.SetStateAction<PendingParcel[]>
  > = (updater) => {
    const prev = pendingParcelsRef.current;
    const next =
      typeof updater === "function"
        ? (updater as (p: PendingParcel[]) => PendingParcel[])(prev)
        : updater;
    setPendingParcels(next);
    if (!actor) return;
    const added = next.filter((n) => !prev.find((p) => p.id === n.id));
    const deleted = prev.filter((p) => !next.find((n) => n.id === p.id));
    const updated = next.filter((n) => {
      const old = prev.find((p) => p.id === n.id);
      return old && JSON.stringify(old) !== JSON.stringify(n);
    });
    for (const p of added)
      (actor as any)
        .addQueueEntry(toBackendQueue(p))
        .catch(handleWriteError('"queue entry"'));
    for (const p of deleted)
      (actor as any)
        .deleteQueueEntry(String(p.id))
        .catch(handleWriteError('"queue delete"'));
    for (const p of updated)
      (actor as any)
        .updateQueueEntry(toBackendQueue(p))
        .catch(handleWriteError('"queue update"'));
  };

  const setInwardSavedWithBackend: React.Dispatch<
    React.SetStateAction<InwardSavedEntry[]>
  > = (updater) => {
    const prev = inwardSavedRef.current;
    const next =
      typeof updater === "function"
        ? (updater as (p: InwardSavedEntry[]) => InwardSavedEntry[])(prev)
        : updater;
    setInwardSaved(next);
    if (!actor) return;
    const added = next.filter((n) => !prev.find((p) => p.id === n.id));
    const deleted = prev.filter((p) => !next.find((n) => n.id === p.id));
    const updated = next.filter((n) => {
      const old = prev.find((p) => p.id === n.id);
      return old && JSON.stringify(old) !== JSON.stringify(n);
    });
    for (const e of added)
      (actor as any)
        .saveInward(toBackendInwardSaved(e))
        .catch(handleWriteError('"inward"'));
    for (const e of deleted)
      (actor as any)
        .deleteInwardSaved(String(e.id))
        .catch(handleWriteError('"inward delete"'));
    for (const e of updated)
      (actor as any)
        .updateInwardSaved(toBackendInwardSaved(e))
        .catch(handleWriteError("write"));
  };

  const setInventoryWithBackend: React.Dispatch<
    React.SetStateAction<Record<string, InventoryItem>>
  > = (updater) => {
    const prev = inventoryRef.current;
    const next =
      typeof updater === "function"
        ? (
            updater as (
              p: Record<string, InventoryItem>,
            ) => Record<string, InventoryItem>
          )(prev)
        : updater;
    setInventory(next);
    if (!actor) return;
    const prevKeys = Object.keys(prev);
    const nextKeys = Object.keys(next);
    const added = nextKeys.filter((k) => !prevKeys.includes(k));
    const deleted = prevKeys.filter((k) => !nextKeys.includes(k));
    const updated = nextKeys.filter(
      (k) =>
        prevKeys.includes(k) &&
        JSON.stringify(prev[k]) !== JSON.stringify(next[k]),
    );
    for (const k of added)
      (actor as any)
        .addInventoryItem(toBackendInventory(next[k]))
        .catch(handleWriteError("write"));
    for (const k of deleted)
      (actor as any)
        .deleteInventoryItem(k)
        .catch(handleWriteError('"inventory delete"'));
    for (const k of updated)
      (actor as any)
        .updateInventoryItem(toBackendInventory(next[k]))
        .catch(handleWriteError("write"));
  };

  const updateStock = (
    sku: string,
    details: Partial<InventoryItem>,
    shopDelta: number,
    godownDelta: number,
    targetGodown = "Main Godown",
  ) => {
    // Use pendingInvRef to accumulate synchronous calls — avoids stale inventoryRef
    const base = pendingInvRef.current ?? inventoryRef.current;
    const current: InventoryItem = base[sku] || {
      sku,
      category: details.category || "",
      itemName: formatItemName(details.itemName || ""),
      attributes: details.attributes || {},
      shop: 0,
      godowns: {},
      saleRate: details.saleRate || 0,
      purchaseRate: details.purchaseRate || 0,
      businessId: activeBusinessId,
    };
    const nextGodowns = { ...current.godowns };
    nextGodowns[targetGodown] =
      (Number(nextGodowns[targetGodown]) || 0) + Number(godownDelta);
    const updated: InventoryItem = {
      ...current,
      shop: (Number(current.shop) || 0) + Number(shopDelta),
      godowns: nextGodowns,
      saleRate: details.saleRate ?? current.saleRate,
      purchaseRate: details.purchaseRate ?? current.purchaseRate,
    };
    pendingInvRef.current = { ...base, [sku]: updated };
    if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    flushTimerRef.current = setTimeout(() => {
      const snapshot = pendingInvRef.current!;
      pendingInvRef.current = null;
      flushTimerRef.current = null;
      setInventoryWithBackend(snapshot);
    }, 0);
  };

  const exportDatabase = () => {
    const data = {
      inventory,
      transactions,
      pendingParcels,
      transitGoods,
      inwardSaved,
      transfers: _transfers,
      fieldLabels,
      requiredFields,
      fieldOrder,
      fieldTypes,
      fieldComboOptions,
      categories,
      godowns,
      biltyPrefixes,
      customColumns,
      users,
      minStockThreshold,
      businesses,
      activeBusinessId,
      deliveryRecords,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `StockFlow_Backup_${Date.now()}.json`;
    link.click();
  };

  const importDatabase = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = JSON.parse(evt.target?.result as string);
        if (data.inventory) setInventoryWithBackend(data.inventory);
        if (data.transactions) setTransactions(data.transactions);
        if (data.pendingParcels)
          setPendingParcelsWithBackend(data.pendingParcels);
        if (data.transitGoods) setTransitGoodsWithBackend(data.transitGoods);
        if (data.inwardSaved) setInwardSavedWithBackend(data.inwardSaved);
        if (data.fieldLabels) setFieldLabels(data.fieldLabels);
        if (data.requiredFields) setRequiredFields(data.requiredFields);
        if (data.fieldOrder) setFieldOrder(data.fieldOrder);
        if (data.fieldTypes) setFieldTypes(data.fieldTypes);
        if (data.fieldComboOptions)
          setFieldComboOptions(data.fieldComboOptions);
        if (data.customColumns) setCustomColumns(data.customColumns);
        if (data.categories) setCategoriesWithBackend(data.categories);
        if (data.users) setUsersWithBackend(data.users);
        if (data.businesses) setBusinesses(data.businesses);
        if (data.activeBusinessId) setActiveBusinessId(data.activeBusinessId);
        if (data.deliveryRecords)
          setDeliveryRecordsWithBackend(data.deliveryRecords);
        showNotification("System Restore Complete");
      } catch {
        showNotification("Corrupt Backup File", "error");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const allSuppliers = useMemo(() => {
    const fromTransit = transitGoods
      .filter((r) => r.businessId === activeBusinessId)
      .map((r) => r.supplierName);
    const fromQueue = pendingParcels
      .filter((r) => !r.businessId || r.businessId === activeBusinessId)
      .map((r) => r.supplier);
    const fromTxns = transactions
      .filter((r) => r.businessId === activeBusinessId)
      .map((r) => (r as any).supplier || (r as any).supplierName || "")
      .filter(Boolean);
    const all = [...new Set([...fromTransit, ...fromQueue, ...fromTxns])]
      .filter(Boolean)
      .sort();
    if (currentUser?.role === "supplier") {
      const mine = new Set(
        [
          ...transitGoods
            .filter(
              (r) =>
                r.addedBy === currentUser.username &&
                r.businessId === activeBusinessId,
            )
            .map((r) => r.supplierName),
          ...pendingParcels
            .filter(
              (r) =>
                (r as any).addedBy === currentUser.username &&
                (!r.businessId || r.businessId === activeBusinessId),
            )
            .map((r) => r.supplier),
        ].filter(Boolean) as string[],
      );
      return all.filter((s) => mine.has(s));
    }
    return all;
  }, [
    transitGoods,
    pendingParcels,
    transactions,
    activeBusinessId,
    currentUser,
  ]);

  const allTransporters = useMemo(() => {
    const fromTransit = transitGoods
      .filter((r) => r.businessId === activeBusinessId)
      .map((r) => r.transportName);
    const fromQueue = pendingParcels
      .filter((r) => !r.businessId || r.businessId === activeBusinessId)
      .map((r) => r.transportName);
    const fromTxns = transactions
      .filter((r) => r.businessId === activeBusinessId)
      .map((r) => (r as any).transportName || "")
      .filter(Boolean);
    const all = [...new Set([...fromTransit, ...fromQueue, ...fromTxns])]
      .filter(Boolean)
      .sort();
    if (currentUser?.role === "supplier") {
      const mine = new Set(
        [
          ...transitGoods
            .filter(
              (r) =>
                r.addedBy === currentUser.username &&
                r.businessId === activeBusinessId,
            )
            .map((r) => r.transportName),
          ...pendingParcels
            .filter(
              (r) =>
                (r as any).addedBy === currentUser.username &&
                (!r.businessId || r.businessId === activeBusinessId),
            )
            .map((r) => r.transportName),
        ].filter(Boolean) as string[],
      );
      return all.filter((t) => mine.has(t));
    }
    return all;
  }, [
    transitGoods,
    pendingParcels,
    transactions,
    activeBusinessId,
    currentUser,
  ]);

  // Show II login screen if not authenticated with Internet Identity
  if (!iiInitializing && !identity) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-md border border-gray-100">
          <div className="flex justify-center mb-6">
            <div className="bg-blue-600 p-4 rounded-2xl shadow-lg shadow-blue-200 text-white">
              <Package size={40} />
            </div>
          </div>
          <h1 className="text-3xl font-black text-center text-gray-900 mb-2 tracking-tighter">
            StockFlow Pro
          </h1>
          <p className="text-center text-gray-500 mb-8 text-xs font-bold uppercase tracking-widest">
            Inventory Management
          </p>
          <button
            type="button"
            onClick={loginWithII}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl shadow-lg transition-transform active:scale-95 uppercase tracking-widest text-xs"
          >
            Login with Internet Identity
          </button>
          <p className="text-center text-gray-400 text-[10px] mt-4 font-medium">
            Secure, decentralized login on the Internet Computer
          </p>
        </div>
      </div>
    );
  }

  if (!currentUser && !actor)
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 font-bold text-sm uppercase tracking-widest">
            Connecting...
          </p>
        </div>
      </div>
    );

  if (!currentUser)
    return (
      <>
        <LoginScreen
          users={users}
          onLogin={setCurrentUser}
          showNotification={showNotification}
          loginViaBackend={loginViaBackend}
        />
        {notification && (
          <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2 px-6 py-4 rounded-3xl shadow-2xl animate-fade-in-down w-[90%] max-w-sm text-white font-black uppercase text-[10px] tracking-widest bg-gray-900 border border-gray-700">
            {notification.type === "success" ? (
              <CheckCircle className="text-green-400" />
            ) : (
              <AlertCircle className="text-red-400" />
            )}
            {notification.message}
          </div>
        )}
      </>
    );

  const activeBusiness =
    businesses.find((b) => b.id === activeBusinessId) || businesses[0];

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans pb-24 md:pb-0 md:pl-64 flex flex-col">
      {/* Mobile Header */}
      <header className="md:hidden bg-white border-b p-4 flex justify-between items-center sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 p-1.5 rounded-lg text-white shadow-md">
            <Package size={18} />
          </div>
          <div className="flex flex-col">
            <h1 className="font-black uppercase tracking-tighter text-sm leading-none">
              StockFlow
            </h1>
            <span className="text-[8px] font-bold text-gray-500 uppercase tracking-widest">
              {activeBusiness?.name}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {businesses.filter((b) => {
            if (currentUser.role === "admin") return true;
            if (
              !currentUser.assignedBusinessIds ||
              currentUser.assignedBusinessIds.length === 0
            )
              return true;
            return currentUser.assignedBusinessIds.includes(b.id);
          }).length > 1 && (
            <select
              value={activeBusinessId}
              onChange={(e) => setActiveBusinessId(e.target.value)}
              className="border rounded-lg p-1.5 text-[10px] font-bold bg-white outline-none focus:ring-2 focus:ring-blue-500 max-w-[110px]"
            >
              {businesses
                .filter((b) => {
                  if (currentUser.role === "admin") return true;
                  if (
                    !currentUser.assignedBusinessIds ||
                    currentUser.assignedBusinessIds.length === 0
                  )
                    return true;
                  return currentUser.assignedBusinessIds.includes(b.id);
                })
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
            </select>
          )}
          <button
            type="button"
            onClick={() => {
              localStorage.removeItem("stockflow_user");
              setCurrentUser(null);
            }}
            className="text-gray-400 hover:text-red-500 transition-colors"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r h-screen fixed left-0 top-0 shadow-sm z-20">
        <div className="p-8 border-b">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-2xl text-white shadow-xl shadow-blue-100">
              <Package size={24} />
            </div>
            <h1 className="font-black uppercase tracking-tighter text-lg leading-none">
              Stock
              <br />
              <span className="text-blue-600">Flow</span>
            </h1>
          </div>
        </div>
        <div className="px-6 py-4 border-b bg-gray-50/50">
          <p className="text-[9px] font-black uppercase text-gray-400 tracking-widest block mb-1">
            Business Profile
          </p>
          <select
            value={activeBusinessId}
            onChange={(e) => setActiveBusinessId(e.target.value)}
            className="w-full border rounded-xl p-2 text-xs font-bold bg-white outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
          >
            {businesses
              .filter((b) => {
                if (currentUser.role === "admin") return true;
                if (
                  !currentUser.assignedBusinessIds ||
                  currentUser.assignedBusinessIds.length === 0
                )
                  return true;
                return currentUser.assignedBusinessIds.includes(b.id);
              })
              .map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
          </select>
        </div>
        <nav className="flex-1 p-5 space-y-2 overflow-y-auto scrollbar-hide">
          {currentUser.role !== "supplier" && (
            <SidebarButton
              active={activeTab === "dashboard"}
              onClick={() => setActiveTab("dashboard")}
              icon={LayoutDashboard}
              label={tabNames.dashboard}
            />
          )}
          <SidebarButton
            active={activeTab === "transit"}
            onClick={() => setActiveTab("transit")}
            icon={Navigation}
            label={tabNames.transit}
          />
          {currentUser.role !== "supplier" && (
            <>
              <SidebarButton
                active={activeTab === "warehouse"}
                onClick={() => setActiveTab("warehouse")}
                icon={Warehouse}
                label={tabNames.warehouse}
              />
              <SidebarButton
                active={activeTab === "inward"}
                onClick={() => setActiveTab("inward")}
                icon={PlusCircle}
                label={tabNames.inward}
              />
              {currentUser.role === "admin" && (
                <SidebarButton
                  active={activeTab === "opening"}
                  onClick={() => setActiveTab("opening")}
                  icon={PackagePlus}
                  label={tabNames.opening}
                />
              )}
              <SidebarButton
                active={activeTab === "transfer"}
                onClick={() => setActiveTab("transfer")}
                icon={ArrowRightLeft}
                label={tabNames.transfer}
              />
              {currentUser.role === "admin" && (
                <SidebarButton
                  active={activeTab === "sales"}
                  onClick={() => setActiveTab("sales")}
                  icon={ShoppingCart}
                  label={tabNames.sales}
                />
              )}
              {currentUser.role === "admin" && (
                <SidebarButton
                  active={activeTab === "salesRecord"}
                  onClick={() => setActiveTab("salesRecord")}
                  icon={Receipt}
                  label={tabNames.salesRecord || "Sales Record"}
                />
              )}
              <SidebarButton
                active={activeTab === "delivery"}
                onClick={() => setActiveTab("delivery")}
                icon={Truck}
                label={tabNames.delivery || "Delivery"}
              />
              <SidebarButton
                active={activeTab === "history"}
                onClick={() => setActiveTab("history")}
                icon={History}
                label={tabNames.history}
              />
              <SidebarButton
                active={activeTab === "inwardSaved"}
                onClick={() => setActiveTab("inwardSaved")}
                icon={CheckCircle}
                label={tabNames.inwardSaved}
              />
              <SidebarButton
                active={activeTab === "godownStock"}
                onClick={() => setActiveTab("godownStock")}
                icon={Warehouse}
                label={tabNames.godownStock}
              />
              {currentUser.role === "admin" && (
                <SidebarButton
                  active={activeTab === "analytics"}
                  onClick={() => setActiveTab("analytics")}
                  icon={BarChart2}
                  label={tabNames.analytics}
                />
              )}
            </>
          )}
          {currentUser.role === "admin" && (
            <SidebarButton
              active={activeTab === "settings"}
              onClick={() => setActiveTab("settings")}
              icon={Settings}
              label={tabNames.settings}
            />
          )}
        </nav>
        <div className="p-6 border-t bg-gray-50/50">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-gray-200 p-2 rounded-full text-gray-500">
              <User size={18} />
            </div>
            <div>
              <p className="text-sm font-black text-gray-900 leading-none truncate w-24">
                {currentUser.username}
              </p>
              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                {currentUser.role}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              localStorage.removeItem("stockflow_user");
              setCurrentUser(null);
            }}
            className="w-full bg-white border border-red-100 text-red-500 font-bold py-2 rounded-xl text-[10px] uppercase tracking-widest hover:bg-red-50 transition-colors"
          >
            Sign Out
          </button>
        </div>
        <div className="p-3 border-t bg-gray-100/50 text-center">
          <p className="text-[9px] font-black uppercase text-gray-400 tracking-widest">
            Powered by JPS
          </p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="p-4 md:p-10 max-w-6xl mx-auto flex-1 w-full relative">
        {!isBackendReady ? (
          <div className="flex items-center justify-center h-64 flex-col gap-4">
            <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-400 font-bold text-xs uppercase tracking-widest">
              Loading data...
            </p>
          </div>
        ) : (
          <>
            {activeTab === "dashboard" && currentUser.role !== "supplier" && (
              <DashboardTab
                inventory={inventory}
                minStockThreshold={minStockThreshold}
                activeBusinessId={activeBusinessId}
                transactions={transactions}
                onItemClick={(sku) => setSelectedHistoryItem(sku)}
                thresholdExcludedItems={thresholdExcludedItems}
              />
            )}
            {activeTab === "transit" && (
              <TransitTab
                transitGoods={transitGoods}
                setTransitGoods={setTransitGoodsWithBackend}
                biltyPrefixes={biltyPrefixes}
                showNotification={showNotification}
                currentUser={currentUser}
                customColumns={customColumns.transit}
                setConfirmDialog={setConfirmDialog}
                activeBusinessId={activeBusinessId}
                allTransitGoods={transitGoods}
                categories={categories}
                transportTracking={transportTracking}
                setMoveToQueueData={setMoveToQueueData}
                setActiveTabFromTransit={setActiveTab}
                pendingParcels={pendingParcels}
                transactions={transactions}
                inwardSaved={inwardSaved}
                fieldLabels={fieldLabels}
                supplierOptions={allSuppliers}
                transportOptions={allTransporters}
              />
            )}
            {activeTab === "warehouse" && currentUser.role !== "supplier" && (
              <WarehouseTab
                pendingParcels={pendingParcels}
                setPendingParcels={setPendingParcelsWithBackend}
                setOpeningParcel={setOpeningParcel}
                setActiveTab={setActiveTab}
                setTransitGoods={setTransitGoodsWithBackend}
                inventory={inventory}
                biltyPrefixes={biltyPrefixes}
                customColumns={customColumns.warehouse}
                showNotification={showNotification}
                setConfirmDialog={setConfirmDialog}
                activeBusinessId={activeBusinessId}
                transportTracking={transportTracking}
                categories={categories}
                transitGoods={transitGoods}
                moveToQueueData={moveToQueueData}
                clearMoveToQueueData={() => setMoveToQueueData(null)}
                existingQueueBiltyNos={pendingParcels
                  .filter(
                    (p) => !p.businessId || p.businessId === activeBusinessId,
                  )
                  .map((p) => p.biltyNo)}
                transactions={transactions}
                inwardSaved={inwardSaved}
                fieldLabels={fieldLabels}
                supplierOptions={allSuppliers}
                transportOptions={allTransporters}
              />
            )}
            {activeTab === "inward" && currentUser.role !== "supplier" && (
              <InwardTab
                inventory={inventory}
                categories={categories}
                updateStock={updateStock}
                setTransactions={setTransactionsWithBackend as any}
                showNotification={showNotification}
                currentUser={currentUser}
                generateSku={generateSku}
                openingParcel={openingParcel}
                setOpeningParcel={setOpeningParcel}
                pendingParcels={pendingParcels}
                setPendingParcels={setPendingParcelsWithBackend}
                transitGoods={transitGoods}
                setTransitGoods={setTransitGoodsWithBackend}
                godowns={godowns}
                biltyPrefixes={biltyPrefixes}
                customColumns={customColumns.inward}
                activeBusinessId={activeBusinessId}
                transactions={transactions}
                setInventory={setInventoryWithBackend}
                setConfirmDialog={setConfirmDialog}
                setInwardSaved={setInwardSavedWithBackend}
                inwardSaved={inwardSaved}
                fieldLabels={fieldLabels}
                deliveredBilties={deliveredBilties}
                requiredFields={requiredFields}
              />
            )}
            {activeTab === "opening" && currentUser.role === "admin" && (
              <OpeningStockTab
                inventory={inventory}
                setInventory={setInventoryWithBackend}
                categories={categories}
                godowns={godowns}
                setTransactions={setTransactionsWithBackend as any}
                activeBusinessId={activeBusinessId}
                currentUser={currentUser}
                showNotification={showNotification}
                transitGoods={transitGoods}
                pendingParcels={pendingParcels}
                inwardSaved={inwardSaved}
              />
            )}
            {activeTab === "transfer" && currentUser.role !== "supplier" && (
              <TransferTab
                inventory={inventory}
                updateStock={updateStock}
                showNotification={showNotification}
                godowns={godowns}
                activeBusinessId={activeBusinessId}
                setTransactions={setTransactionsWithBackend as any}
                currentUser={currentUser}
                actor={actor}
                transfers={_transfers}
                setTransfers={setTransfers}
                onInventoryRefresh={refreshInventory}
              />
            )}
            {activeTab === "sales" && currentUser.role === "admin" && (
              <SalesTab
                inventory={inventory}
                updateStock={updateStock}
                setTransactions={setTransactionsWithBackend as any}
                showNotification={showNotification}
                currentUser={currentUser}
                godowns={godowns}
                activeBusinessId={activeBusinessId}
                categories={categories}
                actor={actor}
                onInventoryRefresh={refreshInventory}
              />
            )}
            {activeTab === "history" && currentUser.role !== "supplier" && (
              <HistoryTab
                transactions={transactions}
                setConfirmDialog={setConfirmDialog}
                setTransactions={setTransactionsWithBackend as any}
                activeBusinessId={activeBusinessId}
                currentUser={currentUser}
                inventory={inventory}
                transitGoods={transitGoods}
                pendingParcels={pendingParcels}
                categories={categories}
                godowns={godowns}
                showNotification={showNotification}
              />
            )}
            {activeTab === "inwardSaved" && currentUser.role !== "supplier" && (
              <InwardSavedTab
                inwardSaved={inwardSaved}
                setInwardSaved={setInwardSavedWithBackend}
                currentUser={currentUser}
                transactions={transactions}
                activeBusinessId={activeBusinessId}
                showNotification={showNotification}
              />
            )}
            {activeTab === "godownStock" && currentUser.role !== "supplier" && (
              <GodownStockTab
                inventory={inventory}
                godowns={godowns}
                activeBusinessId={activeBusinessId}
              />
            )}
            {activeTab === "delivery" && currentUser.role !== "supplier" && (
              <DeliveryTab
                inventory={inventory}
                setInventory={setInventoryWithBackend}
                pendingParcels={pendingParcels}
                setPendingParcels={setPendingParcelsWithBackend}
                godowns={godowns}
                categories={categories}
                currentUser={currentUser}
                activeBusinessId={activeBusinessId}
                deliveryRecords={deliveryRecords}
                setDeliveryRecords={setDeliveryRecordsWithBackend}
                transactions={transactions}
                setTransactions={setTransactionsWithBackend as any}
                updateStock={updateStock}
                showNotification={showNotification}
                actor={actor}
                onInventoryRefresh={refreshInventory}
                onDeliveredBilty={(biltyNo) =>
                  setDeliveredBilties((prev) => [
                    ...new Set([...prev, biltyNo]),
                  ])
                }
              />
            )}
            {activeTab === "analytics" && currentUser.role === "admin" && (
              <AnalyticsTab
                transactions={transactions}
                activeBusinessId={activeBusinessId}
                godowns={godowns}
                inwardSaved={inwardSaved}
              />
            )}
            {activeTab === "salesRecord" && currentUser.role === "admin" && (
              <SalesRecordTab
                transactions={transactions}
                activeBusinessId={activeBusinessId}
              />
            )}
            {activeTab === "settings" && currentUser.role === "admin" && (
              <SettingsTab
                users={users}
                setUsers={setUsersWithBackend}
                categories={categories}
                setCategories={setCategoriesWithBackend}
                customColumns={customColumns}
                setCustomColumns={setCustomColumns}
                exportDatabase={exportDatabase}
                importDatabase={importDatabase}
                showNotification={showNotification}
                setPromptDialog={setPromptDialog}
                setConfirmDialog={setConfirmDialog}
                businesses={businesses}
                setBusinesses={setBusinessesWithBackend}
                activeBusinessId={activeBusinessId}
                setActiveBusinessId={setActiveBusinessId}
                inventory={inventory}
                setInventory={setInventoryWithBackend}
                godowns={godowns}
                setGodowns={setGodownsWithBackend}
                minStockThreshold={minStockThreshold}
                setMinStockThreshold={setMinStockThreshold}
                setTransactions={setTransactionsWithBackend as any}
                currentUser={currentUser}
                transportTracking={transportTracking}
                setTransportTracking={setTransportTrackingWithBackend}
                tabNames={tabNames}
                setTabNames={setTabNames}
                fieldLabels={fieldLabels}
                setFieldLabels={setFieldLabels}
                requiredFields={requiredFields}
                setRequiredFields={setRequiredFields}
                fieldOrder={fieldOrder}
                setFieldOrder={setFieldOrder}
                thresholdExcludedItems={thresholdExcludedItems}
                setThresholdExcludedItems={setThresholdExcludedItems}
                setTransitGoods={setTransitGoodsWithBackend}
                setPendingParcels={setPendingParcelsWithBackend}
                setInwardSaved={setInwardSavedWithBackend}
                setDeliveryRecords={setDeliveryRecordsWithBackend}
                setDeliveredBilties={setDeliveredBilties}
                biltyPrefixes={biltyPrefixes}
                setBiltyPrefixes={setBiltyPrefixesWithBackend}
                fieldTypes={fieldTypes}
                setFieldTypes={setFieldTypes}
                fieldComboOptions={fieldComboOptions}
                setFieldComboOptions={setFieldComboOptions}
                customTabFields={customTabFields}
                setCustomTabFields={setCustomTabFields}
              />
            )}

            {/* Item History Panel */}
            <ItemHistoryPanel
              sku={selectedHistoryItem}
              inventory={inventory}
              transactions={transactions}
              activeBusinessId={activeBusinessId}
              onClose={() => setSelectedHistoryItem(null)}
            />

            {/* Confirm Dialog */}
            {confirmDialog && (
              <div className="fixed inset-0 bg-gray-900/60 z-[100] flex items-center justify-center p-4">
                <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl max-w-sm w-full animate-fade-in-down">
                  <h3 className="text-xl font-black text-gray-800 mb-4">
                    Confirm Action
                  </h3>
                  <p className="text-sm font-bold text-gray-500 mb-6">
                    {confirmDialog.message}
                  </p>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setConfirmDialog(null)}
                      className="flex-1 bg-gray-100 text-gray-700 font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        confirmDialog.onConfirm();
                        setConfirmDialog(null);
                      }}
                      className="flex-1 bg-red-600 text-white font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest shadow-lg"
                    >
                      Confirm
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Prompt Dialog */}
            {promptDialog && (
              <div className="fixed inset-0 bg-gray-900/60 z-[100] flex items-center justify-center p-4">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const val = (e.target as HTMLFormElement).promptInput.value;
                    promptDialog.onConfirm(val);
                    setPromptDialog(null);
                  }}
                  className="bg-white p-8 rounded-[2.5rem] shadow-2xl max-w-sm w-full animate-fade-in-down"
                >
                  <h3 className="text-xl font-black text-gray-800 mb-2">
                    Input Required
                  </h3>
                  <p className="text-xs font-bold text-gray-500 mb-4">
                    {promptDialog.message}
                  </p>
                  <input
                    name="promptInput"
                    type="text"
                    defaultValue={promptDialog.defaultValue || ""}
                    className="w-full border rounded-xl p-4 outline-none font-bold focus:ring-2 focus:ring-blue-500 mb-6 bg-gray-50"
                  />
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setPromptDialog(null)}
                      className="flex-1 bg-gray-100 text-gray-700 font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 bg-blue-600 text-white font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest shadow-lg"
                    >
                      Save
                    </button>
                  </div>
                </form>
              </div>
            )}
          </>
        )}
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full bg-white border-t flex overflow-x-auto scrollbar-hide items-center p-2 z-10 gap-0.5">
        {currentUser.role !== "supplier" && (
          <NavButton
            active={activeTab === "dashboard"}
            onClick={() => setActiveTab("dashboard")}
            icon={LayoutDashboard}
            label={tabNames.dashboard}
          />
        )}
        <NavButton
          active={activeTab === "transit"}
          onClick={() => setActiveTab("transit")}
          icon={Navigation}
          label={tabNames.transit}
        />
        {currentUser.role !== "supplier" && (
          <>
            <NavButton
              active={activeTab === "warehouse"}
              onClick={() => setActiveTab("warehouse")}
              icon={Warehouse}
              label="Queue"
            />
            <NavButton
              active={activeTab === "inward"}
              onClick={() => setActiveTab("inward")}
              icon={PlusCircle}
              label="Inward"
            />
            <NavButton
              active={activeTab === "opening"}
              onClick={() => setActiveTab("opening")}
              icon={PackagePlus}
              label="Opening"
            />
            <NavButton
              active={activeTab === "transfer"}
              onClick={() => setActiveTab("transfer")}
              icon={ArrowRightLeft}
              label="Move"
            />
            {currentUser.role === "admin" && (
              <NavButton
                active={activeTab === "sales"}
                onClick={() => setActiveTab("sales")}
                icon={ShoppingCart}
                label="Sales"
              />
            )}
            {currentUser.role === "admin" && (
              <NavButton
                active={activeTab === "salesRecord"}
                onClick={() => setActiveTab("salesRecord")}
                icon={Receipt}
                label="Rec"
              />
            )}
            <NavButton
              active={activeTab === "delivery"}
              onClick={() => setActiveTab("delivery")}
              icon={Truck}
              label="Delivery"
            />
            <NavButton
              active={activeTab === "history"}
              onClick={() => setActiveTab("history")}
              icon={History}
              label="History"
            />
            <NavButton
              active={activeTab === "inwardSaved"}
              onClick={() => setActiveTab("inwardSaved")}
              icon={CheckCircle}
              label="Saved"
            />
            <NavButton
              active={activeTab === "godownStock"}
              onClick={() => setActiveTab("godownStock")}
              icon={Warehouse}
              label="Stock"
            />
            {currentUser.role === "admin" && (
              <NavButton
                active={activeTab === "analytics"}
                onClick={() => setActiveTab("analytics")}
                icon={BarChart2}
                label="Analytics"
              />
            )}
          </>
        )}
        {currentUser.role === "admin" && (
          <NavButton
            active={activeTab === "settings"}
            onClick={() => setActiveTab("settings")}
            icon={Settings}
            label="Admin"
          />
        )}
      </nav>

      {/* Notification */}
      {notification && (
        <div className="fixed top-20 md:top-6 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2 px-6 py-4 rounded-3xl shadow-2xl animate-fade-in-down w-[90%] max-w-sm text-white font-black uppercase text-[10px] tracking-widest bg-gray-900 border border-gray-700">
          {notification.type === "success" ? (
            <CheckCircle className="text-green-400" />
          ) : (
            <AlertCircle className="text-red-400" />
          )}
          {notification.message}
        </div>
      )}
    </div>
  );
}
