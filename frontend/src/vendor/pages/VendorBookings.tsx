import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Loader2, LogOut, CalendarDays, Clock, CheckCircle2, XCircle, Download, IndianRupee, ShieldCheck, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/vendor/hooks/useVendorAuth";
import { vendorApi as api } from "@/vendor/lib/vendorApi";
import { toast } from "sonner";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  in_progress: "bg-orange-100 text-orange-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

const VendorBookings = () => {
  const { user, logout, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Completion flow state keyed by booking ID
  const [amountInputs, setAmountInputs] = useState<Record<string, string>>({});
  const [savingAmount, setSavingAmount] = useState<Record<string, boolean>>({});
  const [otpSent, setOtpSent] = useState<Record<string, boolean>>({});
  const [sendingOtp, setSendingOtp] = useState<Record<string, boolean>>({});
  const [otpInputs, setOtpInputs] = useState<Record<string, string>>({});
  const [verifyingOtp, setVerifyingOtp] = useState<Record<string, boolean>>({});
  const [rejecting, setRejecting] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    api.getBookings()
      .then((res) => setBookings(res.data || []))
      .catch(() => toast.error("Failed to load bookings"))
      .finally(() => setLoading(false));
  }, [user]);

  const updateStatus = async (bookingId: string, status: string) => {
    try {
      await api.updateBookingStatus(bookingId, status);
      setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status } : b));
      toast.success(`Booking ${status}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    }
  };

  const rejectBooking = async (bookingId: string) => {
    const reason = window.prompt("Enter cancellation reason for customer:", "Service unavailable at requested time");
    if (!reason || reason.trim().length < 5) {
      toast.error("Cancellation reason must be at least 5 characters");
      return;
    }

    setRejecting(prev => ({ ...prev, [bookingId]: true }));
    try {
      await api.rejectBooking(bookingId, reason.trim());
      setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: "cancelled", rejectionReason: reason.trim() } : b));
      toast.success("Booking declined and customer notified");
    } catch (err: any) {
      toast.error(err.message || "Failed to reject booking");
    } finally {
      setRejecting(prev => ({ ...prev, [bookingId]: false }));
    }
  };

  const saveAmount = async (bookingId: string) => {
    const raw = amountInputs[bookingId];
    const amount = Math.round(parseFloat(raw) * 100); // convert to paise
    if (isNaN(amount) || amount < 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setSavingAmount(prev => ({ ...prev, [bookingId]: true }));
    try {
      await api.updateBookingFinalAmount(bookingId, amount);
      setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, finalAmount: amount } : b));
      toast.success("Amount updated");
    } catch (err: any) {
      toast.error(err.message || "Failed to update amount");
    } finally {
      setSavingAmount(prev => ({ ...prev, [bookingId]: false }));
    }
  };

  const requestCompletion = async (bookingId: string) => {
    setSendingOtp(prev => ({ ...prev, [bookingId]: true }));
    try {
      await api.requestCompletion(bookingId);
      setOtpSent(prev => ({ ...prev, [bookingId]: true }));
      toast.success("Payment request sent. OTP will be generated after customer payment.");
    } catch (err: any) {
      toast.error(err.message || "Failed to send completion OTP");
    } finally {
      setSendingOtp(prev => ({ ...prev, [bookingId]: false }));
    }
  };

  const verifyCompletion = async (bookingId: string) => {
    const code = otpInputs[bookingId];
    if (!code || code.length !== 6) {
      toast.error("Enter the 6-digit OTP from customer");
      return;
    }
    setVerifyingOtp(prev => ({ ...prev, [bookingId]: true }));
    try {
      await api.verifyCompletion(bookingId, code);
      setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: "completed" } : b));
      setOtpSent(prev => ({ ...prev, [bookingId]: false }));
      setOtpInputs(prev => ({ ...prev, [bookingId]: "" }));
      toast.success("Work verified & completed! Customer has been notified.");
    } catch (err: any) {
      toast.error(err.message || "Invalid OTP");
    } finally {
      setVerifyingOtp(prev => ({ ...prev, [bookingId]: false }));
    }
  };

  const downloadReceipt = async (bookingId: string) => {
    try {
      const token = localStorage.getItem("vendor_accessToken");
      const res = await fetch(`/api/bookings/${bookingId}/receipt`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `receipt-${bookingId.slice(0, 8)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to download receipt");
    }
  };

  if (authLoading || !user) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex h-16 items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center">
              <span className="text-white font-bold text-sm">V</span>
            </div>
            <span className="font-bold text-lg hidden sm:block">
              Vendor<span className="bg-gradient-to-r from-orange-500 to-pink-500 bg-clip-text text-transparent">Portal</span>
            </span>
          </Link>
          <Button variant="ghost" size="sm" onClick={async () => { await logout(); navigate("/login"); }}>
            <LogOut className="w-4 h-4 mr-1.5" />
            Logout
          </Button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Back to Dashboard
        </Button>

        <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <CalendarDays className="w-6 h-6 text-orange-500" />
          Your Bookings
        </h1>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : bookings.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              <CalendarDays className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No bookings yet</p>
              <p className="text-sm mt-1">When customers book your services, they'll appear here.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {bookings.map((b) => (
              <Card key={b.id}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-base truncate">{b.serviceName}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        <Clock className="w-3 h-3 inline mr-1" />
                        {new Date(b.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                      {b.scheduledDate && (
                        <p className="text-xs text-orange-600 font-medium mt-0.5">
                          <CalendarDays className="w-3 h-3 inline mr-1" />
                          Scheduled: {new Date(b.scheduledDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                          {b.scheduledTime && ` at ${b.scheduledTime}`}
                        </p>
                      )}
                      {b.notes && <p className="text-xs text-muted-foreground mt-0.5 italic">"{b.notes}"</p>}
                      {b.workStartedAt && (
                        <p className="text-xs text-green-700 mt-0.5">
                          Work started: {new Date(b.workStartedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                        </p>
                      )}
                      {b.rejectionReason && (
                        <p className="text-xs text-red-600 mt-0.5">
                          Cancellation reason: {b.rejectionReason}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">ID: {b.transactionId}</p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${statusColors[b.status] || "bg-gray-100 text-gray-800"}`}>
                      {b.status.replace("_", " ")}
                    </span>
                  </div>
                  {b.status === "pending" && (
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => updateStatus(b.id, "confirmed")}>
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                        Accept
                      </Button>
                      <Button size="sm" variant="destructive" disabled={rejecting[b.id]} onClick={() => rejectBooking(b.id)}>
                        <XCircle className="w-3.5 h-3.5 mr-1" />
                        {rejecting[b.id] ? "Declining..." : "Decline"}
                      </Button>
                    </div>
                  )}
                  {b.status === "confirmed" && (
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white" onClick={() => updateStatus(b.id, "in_progress")}>
                        Start Work
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => downloadReceipt(b.id)}>
                        <Download className="w-3.5 h-3.5 mr-1" /> Receipt
                      </Button>
                    </div>
                  )}
                  {b.status === "in_progress" && (
                    <div className="mt-3 space-y-3">
                      {/* Step 1: Adjust Amount */}
                      <div className="bg-blue-50 dark:bg-blue-900/10 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
                        <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-2 flex items-center gap-1">
                          <IndianRupee className="w-3.5 h-3.5" /> Adjust Final Amount
                        </p>
                        <div className="flex gap-2 items-center">
                          <span className="text-sm font-medium">₹</span>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder={b.finalAmount ? (b.finalAmount / 100).toFixed(2) : "Enter amount"}
                            value={amountInputs[b.id] ?? (b.finalAmount ? (b.finalAmount / 100).toFixed(2) : "")}
                            onChange={(e) => setAmountInputs(prev => ({ ...prev, [b.id]: e.target.value }))}
                            className="h-8 w-32"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={savingAmount[b.id]}
                            onClick={() => saveAmount(b.id)}
                          >
                            {savingAmount[b.id] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save"}
                          </Button>
                          {b.finalAmount != null && (
                            <span className="text-xs text-green-600 font-medium">
                              Set: ₹{(b.finalAmount / 100).toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Step 2: Work Done → Ask customer to pay */}
                      {!otpSent[b.id] ? (
                        <Button
                          size="sm"
                          className="bg-orange-500 hover:bg-orange-600 text-white w-full"
                          disabled={sendingOtp[b.id]}
                          onClick={() => requestCompletion(b.id)}
                        >
                          {sendingOtp[b.id] ? (
                            <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> Sending...</>
                          ) : (
                            <><Send className="w-3.5 h-3.5 mr-1" /> Work Done — Request Customer Payment</>
                          )}
                        </Button>
                      ) : (
                        /* Step 3: Enter OTP from customer */
                        <div className="bg-green-50 dark:bg-green-900/10 rounded-lg p-3 border border-green-200 dark:border-green-800">
                          <p className="text-xs font-semibold text-green-700 dark:text-green-300 mb-2 flex items-center gap-1">
                            <ShieldCheck className="w-3.5 h-3.5" /> Enter OTP from Customer
                          </p>
                          <p className="text-xs text-muted-foreground mb-2">
                            Customer has been asked to complete payment. OTP is sent after payment. Ask customer for OTP to verify completion.
                          </p>
                          <div className="flex gap-2">
                            <Input
                              type="text"
                              maxLength={6}
                              placeholder="6-digit OTP"
                              value={otpInputs[b.id] ?? ""}
                              onChange={(e) => setOtpInputs(prev => ({ ...prev, [b.id]: e.target.value.replace(/\D/g, "").slice(0, 6) }))}
                              className="h-8 w-32 font-mono tracking-widest text-center"
                            />
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700 text-white"
                              disabled={verifyingOtp[b.id]}
                              onClick={() => verifyCompletion(b.id)}
                            >
                              {verifyingOtp[b.id] ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <><ShieldCheck className="w-3.5 h-3.5 mr-1" /> Verify</>
                              )}
                            </Button>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="mt-2 text-xs"
                            disabled={sendingOtp[b.id]}
                            onClick={() => requestCompletion(b.id)}
                          >
                            Resend OTP
                          </Button>
                        </div>
                      )}

                      <Button size="sm" variant="outline" onClick={() => downloadReceipt(b.id)}>
                        <Download className="w-3.5 h-3.5 mr-1" /> Receipt
                      </Button>
                    </div>
                  )}
                  {b.status === "completed" && (
                    <div className="mt-3">
                      <Button size="sm" variant="outline" onClick={() => downloadReceipt(b.id)}>
                        <Download className="w-3.5 h-3.5 mr-1" /> Download Receipt
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default VendorBookings;
