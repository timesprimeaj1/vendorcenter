import 'package:flutter/material.dart';
import 'package:vendorcenter/config/theme.dart';
import 'package:vendorcenter/services/api_service.dart';
import 'package:vendorcenter/widgets/status_badge.dart';
import 'package:shimmer/shimmer.dart';
import 'package:intl/intl.dart';

class VendorBookingsScreen extends StatefulWidget {
  const VendorBookingsScreen({super.key});

  @override
  State<VendorBookingsScreen> createState() => _VendorBookingsScreenState();
}

class _VendorBookingsScreenState extends State<VendorBookingsScreen> with SingleTickerProviderStateMixin {
  final _api = ApiService();
  late TabController _tabCtrl;
  List<dynamic> _bookings = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: 3, vsync: this);
    _loadBookings();
  }

  @override
  void dispose() {
    _tabCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadBookings() async {
    setState(() => _loading = true);
    try {
      final data = await _api.getVendorBookings();
      if (mounted) setState(() => _bookings = data);
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  List<dynamic> _filtered(List<String> statuses) {
    return _bookings.where((b) => statuses.contains(b['status'])).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Bookings'),
        bottom: TabBar(
          controller: _tabCtrl,
          labelColor: AppColors.vendor,
          indicatorColor: AppColors.vendor,
          tabs: const [
            Tab(text: 'Active'),
            Tab(text: 'Completed'),
            Tab(text: 'Cancelled'),
          ],
        ),
      ),
      body: RefreshIndicator(
        onRefresh: _loadBookings,
        child: _loading
          ? _buildLoading()
          : TabBarView(
              controller: _tabCtrl,
              children: [
                _buildList(_filtered(['pending', 'confirmed', 'in_progress'])),
                _buildList(_filtered(['completed'])),
                _buildList(_filtered(['cancelled', 'rejected'])),
              ],
            ),
      ),
    );
  }

  Widget _buildList(List<dynamic> items) {
    if (items.isEmpty) {
      return const Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.inbox_outlined, size: 48, color: AppColors.textMuted),
            SizedBox(height: 12),
            Text('No bookings', style: TextStyle(color: AppColors.textSecondary)),
          ],
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
      itemCount: items.length,
      itemBuilder: (_, i) => _bookingCard(items[i]),
    );
  }

  Widget _bookingCard(Map<String, dynamic> booking) {
    final date = booking['booking_date'] ?? booking['scheduled_date'] ?? booking['date'] ?? '';
    final formattedDate = date.isNotEmpty
      ? DateFormat('MMM d, y').format(DateTime.parse(date))
      : 'N/A';
    final status = booking['status'] ?? 'pending';
    final customerName = booking['customer_name'] ?? booking['customerName'] ?? 'Customer';
    final serviceName = booking['service_name'] ?? booking['serviceName'] ?? 'Service';
    final paymentStatus = (booking['payment_status'] ?? '').toString().toLowerCase();
    final finalAmount = booking['final_amount'] ?? booking['finalAmount'];
    final completionRequested = booking['completion_requested_at'] != null;
    final serviceAddress = booking['serviceAddress'];
    final servicePincode = booking['servicePincode'] ?? booking['service_pincode'];

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Text(
                    serviceName,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                StatusBadge(status: status),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                const Icon(Icons.person_outline, size: 16, color: AppColors.textSecondary),
                const SizedBox(width: 4),
                Text(customerName, style: const TextStyle(color: AppColors.textSecondary, fontSize: 13)),
              ],
            ),
            if (serviceAddress != null && serviceAddress is Map) ...[
              const SizedBox(height: 4),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.location_on_outlined, size: 16, color: AppColors.textSecondary),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      [
                        if (serviceAddress['label'] != null) serviceAddress['label'],
                        if (serviceAddress['landmark'] != null) serviceAddress['landmark'],
                        if (serviceAddress['fullAddress'] != null) serviceAddress['fullAddress'],
                        if (serviceAddress['pincode'] != null) serviceAddress['pincode'],
                      ].where((s) => s != null && s.toString().isNotEmpty).join(', '),
                      style: const TextStyle(color: AppColors.textSecondary, fontSize: 12),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ] else if (servicePincode != null) ...[
              const SizedBox(height: 4),
              Row(
                children: [
                  const Icon(Icons.location_on_outlined, size: 16, color: AppColors.textSecondary),
                  const SizedBox(width: 4),
                  Text('Pincode: $servicePincode', style: const TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                ],
              ),
            ],
            const SizedBox(height: 4),
            Row(
              children: [
                const Icon(Icons.calendar_today, size: 16, color: AppColors.textSecondary),
                const SizedBox(width: 4),
                Text(formattedDate, style: const TextStyle(color: AppColors.textSecondary, fontSize: 13)),
              ],
            ),
            if (finalAmount != null) ...[
              const SizedBox(height: 4),
              Row(
                children: [
                  const Icon(Icons.currency_rupee, size: 16, color: AppColors.textSecondary),
                  const SizedBox(width: 4),
                  Text('₹${(num.tryParse(finalAmount.toString()) ?? 0) / 100}',
                    style: const TextStyle(color: AppColors.textSecondary, fontSize: 13, fontWeight: FontWeight.w600)),
                ],
              ),
            ],

            // ── Action buttons based on status ──
            if (status == 'pending') ...[
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => _showRejectDialog('${booking['id']}'),
                      style: OutlinedButton.styleFrom(foregroundColor: AppColors.error),
                      child: const Text('Reject'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: () => _updateStatus('${booking['id']}', 'confirmed'),
                      child: const Text('Accept'),
                    ),
                  ),
                ],
              ),
            ],
            if (status == 'confirmed') ...[
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () => _updateStatus('${booking['id']}', 'in_progress'),
                  child: const Text('Start Work'),
                ),
              ),
            ],
            if (status == 'in_progress') ...[
              const SizedBox(height: 12),
              if (paymentStatus == 'success') ...[
                // Payment done → vendor enters OTP from customer
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: () => _showOtpDialog('${booking['id']}'),
                    style: ElevatedButton.styleFrom(backgroundColor: AppColors.success),
                    child: const Text('Enter Completion OTP'),
                  ),
                ),
              ] else if (completionRequested) ...[
                // Payment requested, waiting for customer
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
                  decoration: BoxDecoration(
                    color: Colors.orange.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.orange.withValues(alpha: 0.3)),
                  ),
                  child: const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.orange)),
                      SizedBox(width: 8),
                      Text('Waiting for Customer Payment', style: TextStyle(color: Colors.orange, fontWeight: FontWeight.w600, fontSize: 13)),
                    ],
                  ),
                ),
              ] else ...[
                // Work in progress → set amount and request payment
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: () => _showSetAmountDialog('${booking['id']}', finalAmount),
                    icon: const Icon(Icons.payment, size: 18),
                    label: const Text('Set Amount & Request Payment'),
                    style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
                  ),
                ),
              ],
            ],
          ],
        ),
      ),
    );
  }

  void _showRejectDialog(String bookingId) {
    final reasonCtrl = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Reject Booking'),
        content: TextField(
          controller: reasonCtrl,
          maxLines: 3,
          decoration: const InputDecoration(
            labelText: 'Reason for rejection',
            hintText: 'Enter reason (min 5 characters)',
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.error),
            onPressed: () async {
              final reason = reasonCtrl.text.trim();
              if (reason.length < 5) return;
              Navigator.pop(ctx);
              try {
                await _api.rejectBooking(bookingId, reason);
                _loadBookings();
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Booking rejected')),
                  );
                }
              } catch (e) {
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Failed: $e'), backgroundColor: AppColors.error),
                  );
                }
              }
            },
            child: const Text('Reject'),
          ),
        ],
      ),
    );
  }

  void _showSetAmountDialog(String bookingId, dynamic currentAmount) {
    final amountCtrl = TextEditingController(
      text: currentAmount != null ? ((num.tryParse(currentAmount.toString()) ?? 0) / 100).toString() : '',
    );
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Set Final Amount'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('Enter the final service amount. A payment link will be sent to the customer.'),
            const SizedBox(height: 16),
            TextField(
              controller: amountCtrl,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(
                labelText: 'Amount (₹)',
                prefixText: '₹ ',
              ),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              final amount = double.tryParse(amountCtrl.text.trim());
              if (amount == null || amount <= 0) return;
              Navigator.pop(ctx);
              try {
                // Set final amount (in paise)
                await _api.setFinalAmount(bookingId, amount * 100);
                // Request payment
                await _api.requestPayment(bookingId);
                _loadBookings();
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Payment request sent to customer'), backgroundColor: AppColors.success),
                  );
                }
              } catch (e) {
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Failed: $e'), backgroundColor: AppColors.error),
                  );
                }
              }
            },
            child: const Text('Send Payment Request'),
          ),
        ],
      ),
    );
  }

  Future<void> _updateStatus(String id, String status) async {
    try {
      await _api.updateBookingStatus(id, status);
      _loadBookings();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Booking ${status == 'confirmed' ? 'accepted' : status}')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed: $e'), backgroundColor: AppColors.error),
        );
      }
    }
  }

  void _showOtpDialog(String bookingId) {
    final otpCtrl = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Complete Booking'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('Enter the OTP shared by the customer to mark this booking complete.'),
            const SizedBox(height: 16),
            TextField(
              controller: otpCtrl,
              keyboardType: TextInputType.number,
              maxLength: 6,
              decoration: const InputDecoration(
                labelText: 'Customer OTP',
                hintText: 'Enter 6-digit OTP',
              ),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              final otp = otpCtrl.text.trim();
              if (otp.length != 6) return;
              Navigator.pop(ctx);
              try {
                await _api.verifyCompletionOtp(bookingId, otp);
                _loadBookings();
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Booking completed!'), backgroundColor: AppColors.success),
                  );
                }
              } catch (e) {
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Failed: $e'), backgroundColor: AppColors.error),
                  );
                }
              }
            },
            child: const Text('Complete'),
          ),
        ],
      ),
    );
  }

  Widget _buildLoading() {
    return Shimmer.fromColors(
      baseColor: AppColors.surfaceAlt,
      highlightColor: AppColors.surface,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: 5,
        itemBuilder: (_, __) => Container(
          height: 100,
          margin: const EdgeInsets.only(bottom: 12),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
          ),
        ),
      ),
    );
  }
}
