import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Clock, CalendarOff, Plus, Trash2, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/vendor/hooks/useVendorAuth";
import { vendorApi as api } from "@/vendor/lib/vendorApi";
import { toast } from "sonner";
import VendorHeader from "@/vendor/components/VendorHeader";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface DaySchedule {
  enabled: boolean;
  startTime: string;
  endTime: string;
}

interface BlockedDate {
  date: string;
  reason: string;
}

const VendorAvailability = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [schedule, setSchedule] = useState<DaySchedule[]>(
    Array.from({ length: 7 }, () => ({ enabled: false, startTime: "09:00", endTime: "18:00" }))
  );
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [newBlockDate, setNewBlockDate] = useState("");
  const [newBlockReason, setNewBlockReason] = useState("");
  const [addingBlock, setAddingBlock] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  const loadAvailability = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getAvailability();
      if (res.data) {
        const slots = res.data.slots || [];
        const blocked = res.data.blockedDates || [];

        const newSchedule: DaySchedule[] = Array.from({ length: 7 }, () => ({
          enabled: false, startTime: "09:00", endTime: "18:00",
        }));

        for (const s of slots) {
          const dow = s.dayOfWeek;
          if (dow >= 0 && dow < 7) {
            newSchedule[dow].enabled = true;
            newSchedule[dow].startTime = s.startTime || "09:00";
            newSchedule[dow].endTime = s.endTime || "18:00";
          }
        }

        setSchedule(newSchedule);
        setBlockedDates(blocked.map((b: any) => ({
          date: b.blockedDate,
          reason: b.reason || "",
        })));
      }
    } catch (e: any) {
      toast.error("Failed to load availability");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (user) loadAvailability();
  }, [user, loadAvailability]);

  const saveSchedule = async () => {
    setSaving(true);
    try {
      const slots = schedule
        .map((d, i) => d.enabled ? { dayOfWeek: i, startTime: d.startTime, endTime: d.endTime } : null)
        .filter(Boolean) as { dayOfWeek: number; startTime: string; endTime: string }[];

      await api.setAvailability(slots);
      toast.success("Schedule saved");
    } catch (e: any) {
      toast.error(e.message || "Failed to save schedule");
    }
    setSaving(false);
  };

  const toggleDay = (index: number) => {
    setSchedule(prev => prev.map((d, i) => i === index ? { ...d, enabled: !d.enabled } : d));
  };

  const updateTime = (index: number, field: "startTime" | "endTime", value: string) => {
    setSchedule(prev => prev.map((d, i) => i === index ? { ...d, [field]: value } : d));
  };

  const addBlockedDate = async () => {
    if (!newBlockDate) { toast.error("Select a date"); return; }
    setAddingBlock(true);
    try {
      await api.addBlockedDate(newBlockDate, newBlockReason || undefined);
      setBlockedDates(prev => [...prev, { date: newBlockDate, reason: newBlockReason }]);
      setNewBlockDate("");
      setNewBlockReason("");
      toast.success("Date blocked");
    } catch (e: any) {
      toast.error(e.message || "Failed to block date");
    }
    setAddingBlock(false);
  };

  const removeBlocked = async (date: string) => {
    try {
      await api.removeBlockedDate(date);
      setBlockedDates(prev => prev.filter(b => b.date !== date));
      toast.success("Unblocked");
    } catch (e: any) {
      toast.error(e.message || "Failed to remove blocked date");
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background">
        <VendorHeader />
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <VendorHeader />
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Back to Dashboard
        </Button>

        {/* Weekly Schedule */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="w-5 h-5 text-orange-500" />
              Weekly Schedule
            </CardTitle>
            <Button size="sm" onClick={saveSchedule} disabled={saving} className="bg-gradient-to-r from-orange-500 to-pink-500 text-white border-0">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Save className="w-4 h-4 mr-1.5" />}
              {saving ? "Saving..." : "Save Schedule"}
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {schedule.map((day, i) => (
              <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${day.enabled ? "bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800" : "bg-muted/30 border-border"}`}>
                <Switch checked={day.enabled} onCheckedChange={() => toggleDay(i)} />
                <span className={`w-24 font-medium text-sm ${day.enabled ? "text-foreground" : "text-muted-foreground"}`}>
                  {DAY_NAMES[i]}
                </span>
                {day.enabled ? (
                  <div className="flex items-center gap-2 flex-1">
                    <Input
                      type="time"
                      value={day.startTime}
                      onChange={e => updateTime(i, "startTime", e.target.value)}
                      className="h-9 w-28 text-sm"
                    />
                    <span className="text-muted-foreground text-sm">to</span>
                    <Input
                      type="time"
                      value={day.endTime}
                      onChange={e => updateTime(i, "endTime", e.target.value)}
                      className="h-9 w-28 text-sm"
                    />
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground italic">Closed</span>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Blocked Dates */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarOff className="w-5 h-5 text-red-500" />
              Blocked Dates
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Block specific dates when you're unavailable (holidays, leave, etc.)
            </p>

            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                type="date"
                value={newBlockDate}
                onChange={e => setNewBlockDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
                className="h-10 flex-1"
              />
              <Input
                placeholder="Reason (optional)"
                value={newBlockReason}
                onChange={e => setNewBlockReason(e.target.value)}
                className="h-10 flex-1"
              />
              <Button onClick={addBlockedDate} disabled={addingBlock} size="sm" className="h-10 px-4">
                {addingBlock ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
                Block
              </Button>
            </div>

            {blockedDates.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4 italic">No blocked dates</p>
            ) : (
              <div className="space-y-2">
                {blockedDates.map((bd) => (
                  <div key={bd.date} className="flex items-center justify-between p-3 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10">
                    <div>
                      <p className="font-medium text-sm">
                        {new Date(bd.date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                      </p>
                      {bd.reason && <p className="text-xs text-muted-foreground mt-0.5">{bd.reason}</p>}
                    </div>
                    <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 hover:bg-red-100" onClick={() => removeBlocked(bd.date)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default VendorAvailability;
