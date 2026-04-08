import { useEffect, useState, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAdminAuth } from "../hooks/useAdminAuth";
import { adminApi } from "../lib/adminApi";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Plus, ToggleLeft, ToggleRight, Search, MapPin, Loader2, Zap, X, Building2, Map, Trash2 } from "lucide-react";

const INDIAN_STATES = ["Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal","Andaman and Nicobar Islands","Chandigarh","Dadra and Nagar Haveli and Daman and Diu","Delhi","Jammu and Kashmir","Ladakh","Lakshadweep","Puducherry"];

interface ServiceState { id: string; name: string; country: string; active: boolean; zoneCount?: number }
interface ServiceZone { id: string; stateId: string; name: string; description: string | null; active: boolean; areaCount?: number }
interface ServiceArea { id: string; zoneId: string; name: string; active: boolean; pincodeCount?: number }
interface ServicePincode { id: string; areaId: string; pincode: string; localityName: string | null; district: string | null; active: boolean }

export default function AdminServiceZones() {
  const { user, loading: authLoading, hasPermission } = useAdminAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin";

  const [states, setStates] = useState<ServiceState[]>([]);
  const [expandedStates, setExpandedStates] = useState<Set<string>>(new Set());
  const [zones, setZones] = useState<Record<string, ServiceZone[]>>({});
  const [expandedZones, setExpandedZones] = useState<Set<string>>(new Set());
  const [areas, setAreas] = useState<Record<string, ServiceArea[]>>({});
  const [expandedAreas, setExpandedAreas] = useState<Set<string>>(new Set());
  const [pincodes, setPincodes] = useState<Record<string, ServicePincode[]>>({});

  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<{ states: number; zones: number; pincodes: number }>({ states: 0, zones: 0, pincodes: 0 });

  // Quick Add
  const [quickPin, setQuickPin] = useState("");
  const [quickLookup, setQuickLookup] = useState<any>(null);
  const [quickLoading, setQuickLoading] = useState(false);
  const [quickAdding, setQuickAdding] = useState(false);
  const [quickAreaName, setQuickAreaName] = useState("");

  // Advanced
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [newStateName, setNewStateName] = useState("");
  const [newZone, setNewZone] = useState({ stateId: "", name: "" });
  const [newArea, setNewArea] = useState({ zoneId: "", name: "" });
  const [newPincodes, setNewPincodes] = useState({ areaId: "", pincodes: "" });

  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [authLoading, user, navigate]);

  useEffect(() => { loadStates(); loadCounts(); }, []);

  async function loadStates() {
    setLoading(true);
    try {
      const res = await adminApi.getServiceStates();
      if (res.success) setStates(res.data || []);
    } catch { toast.error("Failed to load states"); }
    setLoading(false);
  }

  async function loadCounts() {
    try {
      const res = await adminApi.getServiceZoneCounts();
      if (res.success && res.data) setCounts(res.data);
    } catch {}
  }

  async function loadZones(stateId: string) {
    try {
      const res = await adminApi.getServiceZonesByState(stateId);
      if (res.success) setZones(prev => ({ ...prev, [stateId]: res.data || [] }));
    } catch { toast.error("Failed to load zones"); }
  }

  async function loadAreas(zoneId: string) {
    try {
      const res = await adminApi.getServiceAreasByZone(zoneId);
      if (res.success) setAreas(prev => ({ ...prev, [zoneId]: res.data || [] }));
    } catch { toast.error("Failed to load areas"); }
  }

  async function loadPincodes(areaId: string) {
    try {
      const res = await adminApi.getServicePincodesByArea(areaId);
      if (res.success) setPincodes(prev => ({ ...prev, [areaId]: res.data || [] }));
    } catch { toast.error("Failed to load pincodes"); }
  }

  // Reload all expanded subtrees (fixes stale cache)
  const refreshExpandedTree = useCallback(async () => {
    loadStates();
    loadCounts();
    for (const sid of expandedStates) {
      await loadZones(sid);
      const stateZones = zones[sid] || [];
      for (const z of stateZones) {
        if (expandedZones.has(z.id)) {
          await loadAreas(z.id);
          const zoneAreas = areas[z.id] || [];
          for (const a of zoneAreas) {
            if (expandedAreas.has(a.id)) await loadPincodes(a.id);
          }
        }
      }
    }
  }, [expandedStates, expandedZones, expandedAreas, zones, areas]);

  function toggleState(stateId: string) {
    const next = new Set(expandedStates);
    if (next.has(stateId)) { next.delete(stateId); } else { next.add(stateId); loadZones(stateId); }
    setExpandedStates(next);
  }
  function toggleZone(zoneId: string) {
    const next = new Set(expandedZones);
    if (next.has(zoneId)) { next.delete(zoneId); } else { next.add(zoneId); loadAreas(zoneId); }
    setExpandedZones(next);
  }
  function toggleArea(areaId: string) {
    const next = new Set(expandedAreas);
    if (next.has(areaId)) { next.delete(areaId); } else { next.add(areaId); loadPincodes(areaId); }
    setExpandedAreas(next);
  }

  async function handleToggleActive(level: string, id: string) {
    try {
      const res = await adminApi.toggleServiceZoneLevel(level, id);
      if (res.success) {
        toast.success(`${level.slice(0, -1)} toggled`);
        if (level === "states") loadStates();
        else if (level === "zones") {
          const z = Object.entries(zones).find(([, list]) => list.some(zz => zz.id === id));
          if (z) loadZones(z[0]);
        } else if (level === "areas") {
          const a = Object.entries(areas).find(([, list]) => list.some(aa => aa.id === id));
          if (a) loadAreas(a[0]);
        } else if (level === "pincodes") {
          const p = Object.entries(pincodes).find(([, list]) => list.some(pp => pp.id === id));
          if (p) loadPincodes(p[0]);
        }
        loadCounts();
      }
    } catch (e: any) { toast.error(e.message); }
  }

  async function handleDelete(level: string, id: string, name: string) {
    const label = level.slice(0, -1);
    if (!confirm(`Permanently delete ${label} "${name}" and all its children? This cannot be undone.`)) return;
    try {
      const res = await adminApi.deleteServiceZoneLevel(level, id);
      if (res.success) {
        toast.success(`${label} "${name}" deleted`);
        if (level === "states") { loadStates(); }
        else if (level === "zones") {
          const z = Object.entries(zones).find(([, list]) => list.some(zz => zz.id === id));
          if (z) loadZones(z[0]);
        } else if (level === "areas") {
          const a = Object.entries(areas).find(([, list]) => list.some(aa => aa.id === id));
          if (a) loadAreas(a[0]);
        } else if (level === "pincodes") {
          const p = Object.entries(pincodes).find(([, list]) => list.some(pp => pp.id === id));
          if (p) loadPincodes(p[0]);
        }
        loadCounts();
      }
    } catch (e: any) { toast.error(e.message); }
  }

  // ── Quick Add ────────────────────────────────────────────

  async function handleQuickLookup() {
    if (!/^\d{6}$/.test(quickPin)) { toast.error("Enter a valid 6-digit pincode"); return; }
    setQuickLoading(true);
    setQuickLookup(null);
    setQuickAreaName("");
    try {
      const res = await adminApi.lookupPincode(quickPin);
      if (res.data?.valid) {
        // Also check if already in system
        let existingInfo = null;
        try {
          const svcRes = await adminApi.checkServiceability(quickPin);
          if (svcRes.data?.serviceable) {
            existingInfo = svcRes.data;
          }
        } catch {}
        setQuickLookup({ ...res.data, existingInfo });
        setQuickAreaName(res.data.postOffices?.[0]?.name || res.data.district || "");
      } else {
        toast.error(`Pincode ${quickPin} not found in India Post database`);
      }
    } catch (e: any) { toast.error(e.message); }
    setQuickLoading(false);
  }

  async function handleQuickAdd() {
    if (!quickLookup?.valid) return;
    setQuickAdding(true);
    try {
      const res = await adminApi.quickAddPincode(quickPin, quickAreaName.trim() || undefined);
      if (res.success) {
        const d = res.data;
        toast.success(`Added ${quickPin} → ${d.area.name}, ${d.zone.name}, ${d.state.name}`);
        setQuickPin("");
        setQuickLookup(null);
        setQuickAreaName("");
        refreshExpandedTree();
      }
    } catch (e: any) { toast.error(e.message); }
    setQuickAdding(false);
  }

  // ── Advanced Handlers ────────────────────────────────────

  async function handleAddState() {
    if (!newStateName.trim()) return;
    try {
      const res = await adminApi.createServiceState(newStateName.trim());
      if (res.success) { toast.success("State added"); setNewStateName(""); loadStates(); loadCounts(); }
    } catch (e: any) { toast.error(e.message); }
  }

  async function handleAddZone() {
    if (!newZone.stateId || !newZone.name.trim()) return;
    try {
      const res = await adminApi.createServiceZone(newZone.stateId, newZone.name.trim());
      if (res.success) { toast.success("City/District added"); setNewZone({ stateId: "", name: "" }); loadZones(newZone.stateId); loadCounts(); }
    } catch (e: any) { toast.error(e.message); }
  }

  async function handleAddArea() {
    if (!newArea.zoneId || !newArea.name.trim()) return;
    try {
      const res = await adminApi.createServiceArea(newArea.zoneId, newArea.name.trim());
      if (res.success) { toast.success("Area added"); setNewArea({ zoneId: "", name: "" }); loadAreas(newArea.zoneId); loadCounts(); }
    } catch (e: any) { toast.error(e.message); }
  }

  async function handleAddPincodes() {
    if (!newPincodes.areaId || !newPincodes.pincodes.trim()) return;
    const pins = newPincodes.pincodes.split(/[\s,]+/).filter(p => /^\d{6}$/.test(p));
    if (pins.length === 0) { toast.error("Enter valid 6-digit pincodes"); return; }
    try {
      const res = await adminApi.createServicePincodes(newPincodes.areaId, pins);
      if (res.success) { toast.success(`${pins.length} pincode(s) added`); setNewPincodes({ areaId: "", pincodes: "" }); loadPincodes(newPincodes.areaId); loadCounts(); }
    } catch (e: any) { toast.error(e.message); }
  }

  if (authLoading || loading) return <div className="flex items-center justify-center h-screen"><Loader2 className="animate-spin h-8 w-8 text-blue-600" /></div>;

  const filteredStates = searchQuery.trim()
    ? states.filter(s => {
        const q = searchQuery.toLowerCase();
        if (s.name.toLowerCase().includes(q)) return true;
        return (zones[s.id] || []).some(z => z.name.toLowerCase().includes(q));
      })
    : states;

  const stateSuggestions = newStateName.trim().length >= 2
    ? INDIAN_STATES.filter(s => s.toLowerCase().includes(newStateName.toLowerCase()) && !states.some(ex => ex.name.toLowerCase() === s.toLowerCase()))
    : [];

  // Build scoped zone list: show parent state name for clarity
  const scopedZones = Object.entries(zones).flatMap(([stateId, zList]) => {
    const st = states.find(s => s.id === stateId);
    return zList.map(z => ({ ...z, stateName: st?.name || "" }));
  });

  // Build scoped area list: show parent zone name
  const scopedAreas = Object.entries(areas).flatMap(([zoneId, aList]) => {
    const z = scopedZones.find(sz => sz.id === zoneId);
    return aList.map(a => ({ ...a, zoneName: z?.name || "", stateName: z?.stateName || "" }));
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex h-14 items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-slate-900 flex items-center justify-center">
              <Building2 className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold">VendorCenter <span className="text-xs ml-1 px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">ADMIN</span></span>
          </Link>
          <nav className="hidden md:flex items-center gap-5 text-sm">
            <Link to="/dashboard" className="text-gray-500 hover:text-gray-900">Dashboard</Link>
            {hasPermission("vendors.view") && <Link to="/vendors" className="text-gray-500 hover:text-gray-900">Vendors</Link>}
            {hasPermission("users.view") && <Link to="/users" className="text-gray-500 hover:text-gray-900">Users</Link>}
            {hasPermission("bookings.view") && <Link to="/bookings" className="text-gray-500 hover:text-gray-900">Bookings</Link>}
            <Link to="/zones" className="text-gray-900 font-medium">Zones</Link>
          </nav>
          <button onClick={() => navigate("/dashboard")} className="text-sm text-blue-600 hover:underline">← Back</button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5 space-y-5">
        {/* Title + Summary */}
        <div>
          <h1 className="text-xl font-bold text-gray-900">Service Zones</h1>
          <p className="text-xs text-gray-500 mt-0.5">State → City/District → Area → Pincode</p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-lg border px-4 py-3">
            <div className="text-xl font-bold text-blue-600">{counts.states}</div>
            <div className="text-xs text-gray-500">States</div>
          </div>
          <div className="bg-white rounded-lg border px-4 py-3">
            <div className="text-xl font-bold text-green-600">{counts.zones}</div>
            <div className="text-xs text-gray-500">Cities/Districts</div>
          </div>
          <div className="bg-white rounded-lg border px-4 py-3">
            <div className="text-xl font-bold text-purple-600">{counts.pincodes}</div>
            <div className="text-xs text-gray-500">Pincodes</div>
          </div>
        </div>

        {/* ── QUICK ADD ─────────────────────────────────────── */}
        {isAdmin && (
          <div className="bg-white rounded-lg border overflow-hidden">
            <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
              <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-blue-600" />
                Quick Add by Pincode
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">India Post auto-fills State, District, Localities. Select areas to create, then add.</p>
            </div>
            <div className="p-4">
              <div className="flex gap-2 items-center">
                <input
                  value={quickPin}
                  onChange={e => { setQuickPin(e.target.value.replace(/\D/g, "").slice(0, 6)); setQuickLookup(null); }}
                  placeholder="6-digit pincode"
                  className="border rounded-lg px-3 py-2 w-44 text-sm focus:ring-2 focus:ring-blue-300 outline-none"
                  maxLength={6}
                  onKeyDown={e => e.key === "Enter" && handleQuickLookup()}
                />
                <button
                  onClick={handleQuickLookup}
                  disabled={quickLoading || quickPin.length !== 6}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {quickLoading ? <Loader2 className="animate-spin h-4 w-4" /> : <Search className="h-4 w-4" />}
                  Lookup
                </button>
              </div>

              {quickLookup?.valid && (
                <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-green-800">Pincode {quickPin} found</p>
                      <div className="mt-1 flex gap-4 text-sm">
                        <span><span className="text-gray-500">State:</span> <strong>{quickLookup.state}</strong></span>
                        <span><span className="text-gray-500">District:</span> <strong>{quickLookup.district}</strong></span>
                      </div>
                      {quickLookup.existingInfo && (
                        <div className="mt-2 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 text-xs text-amber-800">
                          <strong>Already registered</strong> under: {quickLookup.existingInfo.areaName}, {quickLookup.existingInfo.zoneName}, {quickLookup.existingInfo.stateName}.
                          Adding again will <strong>move</strong> it to the new area.
                        </div>
                      )}
                    </div>
                    <button onClick={() => setQuickLookup(null)} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
                  </div>

                  {/* Area name picker — choose one locality for this pincode */}
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1.5">Area name for this pincode (pick a locality):</label>
                    <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                      {(quickLookup.postOffices || []).map((po: any) => (
                        <button
                          key={po.name}
                          type="button"
                          onClick={() => setQuickAreaName(po.name)}
                          className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                            quickAreaName === po.name
                              ? "bg-blue-100 border-blue-300 text-blue-700 font-medium"
                              : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
                          }`}
                        >
                          {po.name}
                        </button>
                      ))}
                    </div>
                    <input
                      value={quickAreaName}
                      onChange={e => setQuickAreaName(e.target.value)}
                      className="border rounded px-2 py-1 text-xs w-44 mt-1.5"
                      placeholder="Or type custom area name..."
                    />
                  </div>

                  <div className="text-xs text-gray-500">
                    Creates: <strong>{quickLookup.state}</strong> → <strong>{quickLookup.district}</strong> → <strong>{quickAreaName || "—"}</strong> → <span className="font-mono text-blue-600">{quickPin}</span>
                  </div>

                  <button
                    onClick={handleQuickAdd}
                    disabled={quickAdding}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {quickAdding ? <Loader2 className="animate-spin h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    Add to Service Zones
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── ADVANCED ──────────────────────────────────────── */}
        {isAdmin && (
          <div>
            <button
              onClick={() => setShowAdvanced(p => !p)}
              className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
            >
              {showAdvanced ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              Advanced: Manual add (state names validated against official list)
            </button>

            {showAdvanced && (
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div className="bg-white rounded-lg border p-3 relative">
                  <h3 className="text-xs font-semibold text-gray-600 mb-1.5">Add State</h3>
                  <div className="flex gap-1.5">
                    <div className="flex-1 relative">
                      <input value={newStateName} onChange={e => setNewStateName(e.target.value)} placeholder="e.g. Maharashtra" className="border rounded px-2 py-1.5 w-full text-xs" />
                      {stateSuggestions.length > 0 && (
                        <div className="absolute z-10 top-full left-0 right-0 mt-0.5 bg-white border rounded shadow-lg max-h-36 overflow-y-auto">
                          {stateSuggestions.slice(0, 8).map(s => (
                            <button key={s} type="button" onClick={() => { setNewStateName(s); }} className="block w-full text-left px-2 py-1 text-xs hover:bg-blue-50 text-gray-700">{s}</button>
                          ))}
                        </div>
                      )}
                    </div>
                    <button onClick={handleAddState} className="bg-green-600 text-white px-2 py-1.5 rounded text-xs hover:bg-green-700"><Plus className="h-3.5 w-3.5" /></button>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">Only valid Indian states/UTs accepted</p>
                </div>

                <div className="bg-white rounded-lg border p-3">
                  <h3 className="text-xs font-semibold text-gray-600 mb-1.5">Add City/District</h3>
                  <div className="flex gap-1.5">
                    <select value={newZone.stateId} onChange={e => setNewZone(p => ({ ...p, stateId: e.target.value }))} className="border rounded px-2 py-1.5 text-xs">
                      <option value="">State</option>
                      {states.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <input value={newZone.name} onChange={e => setNewZone(p => ({ ...p, name: e.target.value }))} placeholder="City/District" className="border rounded px-2 py-1.5 flex-1 text-xs" />
                    <button onClick={handleAddZone} className="bg-green-600 text-white px-2 py-1.5 rounded text-xs hover:bg-green-700"><Plus className="h-3.5 w-3.5" /></button>
                  </div>
                </div>

                <div className="bg-white rounded-lg border p-3">
                  <h3 className="text-xs font-semibold text-gray-600 mb-1.5">Add Area</h3>
                  <div className="flex gap-1.5">
                    <select value={newArea.zoneId} onChange={e => setNewArea(p => ({ ...p, zoneId: e.target.value }))} className="border rounded px-2 py-1.5 text-xs">
                      <option value="">City/District</option>
                      {scopedZones.map(z => <option key={z.id} value={z.id}>{z.name} ({z.stateName})</option>)}
                    </select>
                    <input value={newArea.name} onChange={e => setNewArea(p => ({ ...p, name: e.target.value }))} placeholder="Area/Locality" className="border rounded px-2 py-1.5 flex-1 text-xs" />
                    <button onClick={handleAddArea} className="bg-green-600 text-white px-2 py-1.5 rounded text-xs hover:bg-green-700"><Plus className="h-3.5 w-3.5" /></button>
                  </div>
                </div>

                <div className="bg-white rounded-lg border p-3">
                  <h3 className="text-xs font-semibold text-gray-600 mb-1.5">Add Pincodes</h3>
                  <div className="flex gap-1.5">
                    <select value={newPincodes.areaId} onChange={e => setNewPincodes(p => ({ ...p, areaId: e.target.value }))} className="border rounded px-2 py-1.5 text-xs">
                      <option value="">Area</option>
                      {scopedAreas.map(a => <option key={a.id} value={a.id}>{a.name} ({a.zoneName})</option>)}
                    </select>
                    <input value={newPincodes.pincodes} onChange={e => setNewPincodes(p => ({ ...p, pincodes: e.target.value }))} placeholder="400001, 400002" className="border rounded px-2 py-1.5 flex-1 text-xs" />
                    <button onClick={handleAddPincodes} className="bg-green-600 text-white px-2 py-1.5 rounded text-xs hover:bg-green-700"><Plus className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── ZONE HIERARCHY ────────────────────────────────── */}
        <div className="bg-white rounded-lg border">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
              <Map className="h-4 w-4 text-gray-400" />
              Zone Hierarchy
            </h2>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="border rounded-lg pl-7 pr-3 py-1 text-xs w-48"
              />
            </div>
          </div>
          <div className="p-3">
            {filteredStates.length === 0 ? (
              <p className="text-gray-400 text-center py-6 text-sm">
                {states.length === 0 ? "No zones yet. Use Quick Add above." : "No matches."}
              </p>
            ) : (
              <div className="space-y-0.5">
                {filteredStates.map(state => (
                  <div key={state.id}>
                    {/* State */}
                    <div className="flex items-center gap-1.5 py-1.5 px-2 rounded hover:bg-gray-50 cursor-pointer group" onClick={() => toggleState(state.id)}>
                      {expandedStates.has(state.id) ? <ChevronDown className="h-3.5 w-3.5 text-gray-400" /> : <ChevronRight className="h-3.5 w-3.5 text-gray-400" />}
                      <MapPin className="h-3.5 w-3.5 text-blue-500" />
                      <span className="text-sm font-medium text-gray-900">{state.name}</span>
                      <span className="text-[10px] text-gray-400">({state.zoneCount ?? 0} cities)</span>
                      <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100">
                        {isAdmin && (
                          <>
                            <button onClick={e => { e.stopPropagation(); handleToggleActive("states", state.id); }} title={state.active ? "Disable" : "Enable"}>
                              {state.active ? <ToggleRight className="h-4 w-4 text-green-500" /> : <ToggleLeft className="h-4 w-4 text-gray-300" />}
                            </button>
                            <button onClick={e => { e.stopPropagation(); handleDelete("states", state.id, state.name); }} title="Delete state" className="text-red-400 hover:text-red-600">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Zones (Cities/Districts) */}
                    {expandedStates.has(state.id) && (
                      <div className="ml-5 border-l pl-3">
                        {(zones[state.id] || []).map(zone => (
                          <div key={zone.id}>
                            <div className="flex items-center gap-1.5 py-1 px-2 rounded hover:bg-gray-50 cursor-pointer group" onClick={() => toggleZone(zone.id)}>
                              {expandedZones.has(zone.id) ? <ChevronDown className="h-3 w-3 text-gray-400" /> : <ChevronRight className="h-3 w-3 text-gray-400" />}
                              <Building2 className="h-3 w-3 text-green-500" />
                              <span className="text-sm text-gray-800">{zone.name}</span>
                              <span className="text-[10px] text-gray-400">({zone.areaCount ?? 0} areas)</span>
                              <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100">
                                {isAdmin && (
                                  <>
                                    <button onClick={e => { e.stopPropagation(); handleToggleActive("zones", zone.id); }}>
                                      {zone.active ? <ToggleRight className="h-3.5 w-3.5 text-green-500" /> : <ToggleLeft className="h-3.5 w-3.5 text-gray-300" />}
                                    </button>
                                    <button onClick={e => { e.stopPropagation(); handleDelete("zones", zone.id, zone.name); }} className="text-red-400 hover:text-red-600">
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Areas */}
                            {expandedZones.has(zone.id) && (
                              <div className="ml-5 border-l pl-3">
                                {(areas[zone.id] || []).map(area => (
                                  <div key={area.id}>
                                    <div className="flex items-center gap-1.5 py-0.5 px-2 rounded hover:bg-gray-50 cursor-pointer group" onClick={() => toggleArea(area.id)}>
                                      {expandedAreas.has(area.id) ? <ChevronDown className="h-2.5 w-2.5 text-gray-400" /> : <ChevronRight className="h-2.5 w-2.5 text-gray-400" />}
                                      <span className="text-xs text-gray-700">{area.name}</span>
                                      <span className="text-[10px] text-gray-400">({area.pincodeCount ?? 0})</span>
                                      <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100">
                                        {isAdmin && (
                                          <>
                                            <button onClick={e => { e.stopPropagation(); handleToggleActive("areas", area.id); }}>
                                              {area.active ? <ToggleRight className="h-3.5 w-3.5 text-green-500" /> : <ToggleLeft className="h-3.5 w-3.5 text-gray-300" />}
                                            </button>
                                            <button onClick={e => { e.stopPropagation(); handleDelete("areas", area.id, area.name); }} className="text-red-400 hover:text-red-600">
                                              <Trash2 className="h-3 w-3" />
                                            </button>
                                          </>
                                        )}
                                      </div>
                                    </div>

                                    {/* Pincodes */}
                                    {expandedAreas.has(area.id) && (
                                      <div className="ml-5 border-l pl-3 py-0.5">
                                        {(pincodes[area.id] || []).length === 0 ? (
                                          <p className="text-[10px] text-gray-400 py-0.5">No pincodes</p>
                                        ) : (
                                          <div className="flex flex-wrap gap-1">
                                            {(pincodes[area.id] || []).map(pin => (
                                              <span
                                                key={pin.id}
                                                className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] transition-colors ${
                                                  pin.active
                                                    ? "bg-green-50 text-green-700 border border-green-200"
                                                    : "bg-gray-100 text-gray-400 border border-gray-200"
                                                } group/pin`}
                                                title={pin.localityName ? `${pin.localityName}, ${pin.district}` : pin.pincode}
                                              >
                                                {isAdmin && (
                                                  <button onClick={() => handleToggleActive("pincodes", pin.id)} className="hover:opacity-70 cursor-pointer">
                                                    {pin.active ? <ToggleRight className="h-3 w-3 text-green-500" /> : <ToggleLeft className="h-3 w-3 text-gray-300" />}
                                                  </button>
                                                )}
                                                {pin.pincode}
                                                {pin.localityName && <span className="text-gray-400">({pin.localityName})</span>}
                                                {isAdmin && (
                                                  <button onClick={() => handleDelete("pincodes", pin.id, pin.pincode)} className="text-red-300 hover:text-red-500 opacity-0 group-hover/pin:opacity-100">
                                                    <X className="h-2.5 w-2.5" />
                                                  </button>
                                                )}
                                              </span>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                ))}
                                {(areas[zone.id] || []).length === 0 && <p className="text-[10px] text-gray-400 py-0.5">No areas</p>}
                              </div>
                            )}
                          </div>
                        ))}
                        {(zones[state.id] || []).length === 0 && <p className="text-[10px] text-gray-400 py-0.5">No cities/districts</p>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Info box about system design */}
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700 space-y-1">
          <p><strong>How it works:</strong></p>
          <ul className="list-disc ml-4 space-y-0.5 text-blue-600">
            <li>Pincodes are globally unique — each pincode belongs to exactly one area.</li>
            <li>Vendors select pincodes they serve. Customers enter pincode during address/booking — auto-checked for serviceability.</li>
            <li>Vendor radius (km) and pincode coverage work together: radius for map proximity, pincodes for exact service area matching.</li>
            <li>Customer location (OpenStreetMap/Nominatim) auto-detects pincode for address forms. India Post validates zone data.</li>
            <li>Customer address is shared with vendor only during active booking. After completion, full address is hidden.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
