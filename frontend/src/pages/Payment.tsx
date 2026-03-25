import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { Loader2, ShieldCheck, CreditCard } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

const Payment = () => {
  const { t } = useTranslation("common");
  const { bookingId = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [paying, setPaying] = useState(false);
  const [checkingOwnership, setCheckingOwnership] = useState(false);
  const [ownerAllowed, setOwnerAllowed] = useState<boolean | null>(null);
  const [bookingData, setBookingData] = useState<any | null>(null);

  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const paymentToken = params.get("pt") || "";

  useEffect(() => {
    if (!user || !bookingId) return;
    let active = true;
    setCheckingOwnership(true);
    api.getBookings()
      .then((res) => {
        if (!active) return;
        const mineBooking = (res.data || []).find((b: any) => b.id === bookingId) || null;
        const mine = !!mineBooking;
        setOwnerAllowed(mine);
        setBookingData(mineBooking);
      })
      .catch(() => {
        if (!active) return;
        setOwnerAllowed(false);
      })
      .finally(() => {
        if (!active) return;
        setCheckingOwnership(false);
      });
    return () => { active = false; };
  }, [user, bookingId]);

  const handleDummyPayment = async () => {
    if (!bookingId) return;
    if (!paymentToken) {
      toast.error(t("payment.invalidPaymentLink"));
      return;
    }
    setPaying(true);
    try {
      await api.payBooking(bookingId, paymentToken);
      toast.success(t("payment.paymentSuccess"));
      navigate("/account?tab=bookings");
    } catch (err: any) {
      toast.error(err.message || t("payment.paymentFailed"));
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="container py-16 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  if (!paymentToken) {
    return (
      <Layout>
        <div className="container py-10 max-w-xl">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">{t("payment.invalidLink")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {t("payment.missingToken")}
              </p>
              <Button asChild variant="outline">
                <Link to="/account?tab=bookings">{t("payment.goToBookings")}</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  if (!user) {
    const redirect = `${location.pathname}${location.search}`;
    return (
      <Layout>
        <div className="container py-10 max-w-xl">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">{t("payment.loginRequired")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {t("payment.loginDesc")}
              </p>
              <Button asChild>
                <Link to={`/login?redirect=${encodeURIComponent(redirect)}`}>{t("payment.loginToContinue")}</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  if (checkingOwnership) {
    return (
      <Layout>
        <div className="container py-16 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  if (ownerAllowed === false) {
    return (
      <Layout>
        <div className="container py-10 max-w-xl">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">{t("payment.accessDenied")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {t("payment.notYourBooking")}
              </p>
              <Button asChild variant="outline">
                <Link to="/account?tab=bookings">{t("payment.goToYourBookings")}</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  const serverAmountPaise = Number(bookingData?.finalAmount ?? 0);
  const amountInr = Number.isFinite(serverAmountPaise) ? (serverAmountPaise / 100).toFixed(2) : "0.00";
  const txn = bookingData?.transactionId || "-";

  return (
    <Layout>
      <div className="container py-10 max-w-xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <CreditCard className="w-5 h-5 text-primary" />
              {t("payment.confirmationTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div translate="no" className="notranslate rounded-lg border p-4 bg-secondary/30 space-y-2">
              <p className="text-sm"><span className="text-muted-foreground">{t("payment.bookingIdLabel")}</span> {bookingId}</p>
              <p className="text-sm"><span className="text-muted-foreground">{t("payment.transactionIdLabel")}</span> {txn}</p>
              <p className="text-sm"><span className="text-muted-foreground">{t("payment.amountLabel")}</span> INR {amountInr}</p>
            </div>

            <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800 flex gap-2 items-start">
              <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                {t("payment.securityNote")}
              </span>
            </div>

            <Button className="w-full" onClick={handleDummyPayment} disabled={paying || !bookingId}>
              {paying ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {t("payment.confirmPayment")}
            </Button>
            <p className="text-xs text-muted-foreground">
              {t("payment.otpNote")}
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Payment;
