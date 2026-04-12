import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:shimmer/shimmer.dart';
import 'package:vendorcenter/config/theme.dart';
import 'package:vendorcenter/services/api_service.dart';
import 'package:vendorcenter/widgets/status_badge.dart';

class VendorBookingDetailScreen extends StatefulWidget {
  final String bookingId;
  const VendorBookingDetailScreen({super.key, required this.bookingId});

  @override
  State<VendorBookingDetailScreen> createState() => _VendorBookingDetailScreenState();
}

class _VendorBookingDetailScreenState extends State<VendorBookingDetailScreen> {
  final _api = ApiService();
  Map<String, dynamic>? _booking;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadBooking();
  }

  Future<void> _loadBooking() async {
    setState(() => _loading = true);
    try {
      final bookings = await _api.getVendorBookings();
      Map<String, dynamic>? match;
      try {
        match = Map<String, dynamic>.from(bookings.firstWhere(
          (b) => b['id']?.toString() == widget.bookingId,
        ));
      } catch (_) {
        match = null;
      }
      if (mounted) setState(() { _booking = match; _loading = false; });
    } catch (e) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Booking Details')),
      body: _loading
          ? _buildShimmer()
          : _booking == null
              ? Center(child: Text('Booking not found', style: TextStyle(color: AppColors.textSecondaryOf(context))))
              : RefreshIndicator(onRefresh: _loadBooking, child: _buildContent()),
    );
  }

  Widget _buildContent() {
    final b = _booking!;
    final status = (b['status'] ?? 'pending').toString().toLowerCase();
    final customerName = b['customerName'] ?? b['customer_name'] ?? 'Customer';
    final serviceName = b['serviceName'] ?? b['service_name'] ?? 'Service';
    final rawAmount = b['finalAmount'] ?? b['final_amount'] ?? 0;
    final amount = ((num.tryParse(rawAmount.toString()) ?? 0) / 100).round();
    final paymentStatus = (b['paymentStatus'] ?? b['payment_status'] ?? '').toString().toLowerCase();
    final completionRequested = (b['completionRequestedAt'] ?? b['completion_requested_at']) != null;
    final rejectionReason = b['rejectionReason']?.toString() ?? b['rejection_reason']?.toString() ?? '';
    final notes = b['notes']?.toString() ?? '';
    final transactionId = b['transactionId']?.toString() ?? b['transaction_id']?.toString() ?? '';
    final dateStr = b['scheduledDate']?.toString() ?? b['scheduled_date']?.toString() ?? '';
    final timeStr = b['scheduledTime']?.toString() ?? b['scheduled_time']?.toString() ?? '';
    final createdAt = b['createdAt']?.toString() ?? b['created_at']?.toString() ?? '';
    final workStartedAt = b['workStartedAt']?.toString() ?? b['work_started_at']?.toString() ?? '';
    final servicePincode = b['servicePincode'] ?? b['service_pincode'];
    final addressLabel = b['serviceAddressLabel'] ?? b['serviceAddress']?['label'];
    final addressFull = b['serviceAddress'] is Map ? b['serviceAddress']['fullAddress'] : b['serviceAddress'];
    final addressLandmark = b['serviceAddressLandmark'] ?? b['serviceAddress']?['landmark'];

    String formattedDate = dateStr;
    try { if (dateStr.isNotEmpty) formattedDate = DateFormat('dd MMM yyyy').format(DateTime.parse(dateStr)); } catch (_) {}
    String formattedCreated = createdAt;
    try { if (createdAt.isNotEmpty) formattedCreated = DateFormat('dd MMM yyyy, hh:mm a').format(DateTime.parse(createdAt)); } catch (_) {}
    String formattedWorkStart = '';
    try { if (workStartedAt.isNotEmpty) formattedWorkStart = DateFormat('dd MMM yyyy, hh:mm a').format(DateTime.parse(workStartedAt)); } catch (_) {}

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
      children: [
        // Status + Transaction ID
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            StatusBadge(status: status),
            Text(transactionId.isNotEmpty ? transactionId : '#${b['id']?.toString().substring(0, 8) ?? ''}',
              style: TextStyle(fontSize: 12, color: AppColors.textMutedOf(context), fontFamily: 'monospace')),
          ],
        ),
        const SizedBox(height: 16),

        // Order Progress Timeline
        _buildProgressTimeline(status, paymentStatus, completionRequested),
        const SizedBox(height: 16),

        // Customer info
        _infoCard('Customer', Icons.person_outline, [
          _detailRow('Name', customerName),
          if (addressLabel != null)
            _detailRow('Address', addressLabel.toString()),
          if (addressFull != null)
            _detailRow('Full Address', addressFull.toString()),
          if (addressLandmark != null)
            _detailRow('Landmark', addressLandmark.toString()),
          if (servicePincode != null)
            _detailRow('Pincode', servicePincode.toString()),
        ]),
        const SizedBox(height: 12),

        // Service info
        _infoCard('Service', Icons.handyman_outlined, [
          _detailRow('Service', serviceName),
          if (amount > 0) _detailRow('Amount', '₹$amount'),
          _detailRow('Payment', paymentStatus.isNotEmpty ? paymentStatus[0].toUpperCase() + paymentStatus.substring(1) : 'Pending'),
        ]),
        const SizedBox(height: 12),

        // Schedule
        _infoCard('Schedule', Icons.calendar_today_outlined, [
          _detailRow('Date', formattedDate.isNotEmpty ? formattedDate : 'Not scheduled'),
          if (timeStr.isNotEmpty) _detailRow('Time', timeStr),
          if (formattedWorkStart.isNotEmpty) _detailRow('Work Started', formattedWorkStart),
          _detailRow('Booked On', formattedCreated),
        ]),

        if (notes.isNotEmpty) ...[
          const SizedBox(height: 12),
          _infoCard('Notes', Icons.note_outlined, [
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Text(notes, style: TextStyle(fontSize: 14, color: AppColors.textOf(context))),
            ),
          ]),
        ],

        if (status == 'cancelled' && rejectionReason.isNotEmpty) ...[
          const SizedBox(height: 12),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.error.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.error.withValues(alpha: 0.3)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Rejection Reason', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.error)),
                const SizedBox(height: 4),
                Text(rejectionReason, style: TextStyle(fontSize: 14, color: AppColors.textOf(context))),
              ],
            ),
          ),
        ],

        const SizedBox(height: 24),

        // Action Buttons
        ..._buildActions(b, status, paymentStatus, completionRequested, rawAmount),
      ],
    );
  }

  Widget _buildProgressTimeline(String status, String paymentStatus, bool completionRequested) {
    final steps = <_TimelineStep>[
      _TimelineStep('Booked', Icons.bookmark_added, _stepDone(status, 'pending')),
      _TimelineStep('Accepted', Icons.check_circle_outline, _stepDone(status, 'confirmed')),
      _TimelineStep('Work Started', Icons.build_circle_outlined, _stepDone(status, 'in_progress')),
      _TimelineStep('Payment', Icons.payment, paymentStatus == 'success'),
      _TimelineStep('Completed', Icons.task_alt, status == 'completed'),
    ];

    if (status == 'cancelled' || status == 'rejected') {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.error.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.error.withValues(alpha: 0.3)),
        ),
        child: Row(
          children: [
            const Icon(Icons.cancel_outlined, color: AppColors.error, size: 20),
            const SizedBox(width: 10),
            Text('This booking was cancelled', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: AppColors.error)),
          ],
        ),
      );
    }

    int activeIndex = 0;
    if (status == 'confirmed' || status == 'in_progress' || status == 'completed') activeIndex = 1;
    if (status == 'in_progress' || status == 'completed') activeIndex = 2;
    if (paymentStatus == 'success') activeIndex = 3;
    if (status == 'completed') activeIndex = 4;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surfaceOf(context),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.borderOf(context)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Order Progress', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.textOf(context))),
          const SizedBox(height: 16),
          ...List.generate(steps.length, (i) {
            final step = steps[i];
            final isActive = i <= activeIndex;
            final isLast = i == steps.length - 1;
            final color = isActive ? AppColors.vendor : AppColors.textMutedOf(context);

            return Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Column(
                  children: [
                    Container(
                      width: 28,
                      height: 28,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: isActive ? AppColors.vendor.withValues(alpha: 0.15) : Colors.transparent,
                        border: Border.all(color: color, width: isActive ? 2 : 1),
                      ),
                      child: Icon(step.icon, size: 14, color: color),
                    ),
                    if (!isLast)
                      Container(
                        width: 2,
                        height: 28,
                        color: i < activeIndex ? AppColors.vendor : AppColors.borderOf(context),
                      ),
                  ],
                ),
                const SizedBox(width: 12),
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Text(
                    step.label,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: isActive ? FontWeight.w600 : FontWeight.w400,
                      color: isActive ? AppColors.textOf(context) : AppColors.textMutedOf(context),
                    ),
                  ),
                ),
              ],
            );
          }),
        ],
      ),
    );
  }

  bool _stepDone(String status, String target) {
    const order = ['pending', 'confirmed', 'in_progress', 'completed'];
    return order.indexOf(status) >= order.indexOf(target);
  }

  List<Widget> _buildActions(Map<String, dynamic> b, String status, String paymentStatus, bool completionRequested, dynamic rawFinalAmount) {
    final bookingId = b['id'].toString();
    final widgets = <Widget>[];

    if (status == 'pending') {
      widgets.add(Row(
        children: [
          Expanded(
            child: OutlinedButton.icon(
              onPressed: () => _showRejectDialog(bookingId),
              icon: const Icon(Icons.close, size: 18),
              label: const Text('Reject'),
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.error,
                minimumSize: const Size.fromHeight(48),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: FilledButton.icon(
              onPressed: () => _updateStatus(bookingId, 'confirmed'),
              icon: const Icon(Icons.check, size: 18),
              label: const Text('Accept'),
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.vendor,
                minimumSize: const Size.fromHeight(48),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ),
        ],
      ));
    }

    if (status == 'confirmed') {
      widgets.add(FilledButton.icon(
        onPressed: () => _updateStatus(bookingId, 'in_progress'),
        icon: const Icon(Icons.play_arrow_rounded, size: 20),
        label: const Text('Start Work'),
        style: FilledButton.styleFrom(
          backgroundColor: AppColors.vendor,
          minimumSize: const Size.fromHeight(48),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      ));
    }

    if (status == 'in_progress') {
      if (paymentStatus == 'success') {
        widgets.add(FilledButton.icon(
          onPressed: () => _showOtpDialog(bookingId),
          icon: const Icon(Icons.vpn_key, size: 18),
          label: const Text('Enter Completion OTP'),
          style: FilledButton.styleFrom(
            backgroundColor: AppColors.success,
            minimumSize: const Size.fromHeight(48),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
        ));
      } else if (completionRequested) {
        widgets.add(Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
          decoration: BoxDecoration(
            color: Colors.orange.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: Colors.orange.withValues(alpha: 0.3)),
          ),
          child: const Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.orange)),
              SizedBox(width: 10),
              Expanded(child: Text('Waiting for customer to complete payment', style: TextStyle(color: Colors.orange, fontWeight: FontWeight.w600, fontSize: 13))),
            ],
          ),
        ));
      } else {
        widgets.add(FilledButton.icon(
          onPressed: () => _showSetAmountDialog(bookingId, rawFinalAmount),
          icon: const Icon(Icons.payment, size: 18),
          label: const Text('Set Amount & Request Payment'),
          style: FilledButton.styleFrom(
            backgroundColor: AppColors.vendor,
            minimumSize: const Size.fromHeight(48),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
        ));
      }
    }

    return widgets;
  }

  Widget _infoCard(String title, IconData icon, List<Widget> children) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surfaceOf(context),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.borderOf(context)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 18, color: AppColors.vendor),
              const SizedBox(width: 8),
              Text(title, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.textOf(context))),
            ],
          ),
          const SizedBox(height: 10),
          ...children,
        ],
      ),
    );
  }

  Widget _detailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(width: 100, child: Text(label, style: TextStyle(fontSize: 13, color: AppColors.textSecondaryOf(context)))),
          Expanded(child: Text(value, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: AppColors.textOf(context)))),
        ],
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
          decoration: const InputDecoration(labelText: 'Reason', hintText: 'Min 5 characters'),
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
                _loadBooking();
                if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Booking rejected')));
              } catch (e) {
                if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed: $e'), backgroundColor: AppColors.error));
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
            const Text('Enter the final amount. A payment link will be sent to the customer.'),
            const SizedBox(height: 16),
            TextField(
              controller: amountCtrl,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(labelText: 'Amount (₹)', prefixText: '₹ '),
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
                await _api.setFinalAmount(bookingId, amount * 100);
                await _api.requestPayment(bookingId);
                _loadBooking();
                if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Payment request sent'), backgroundColor: AppColors.success));
              } catch (e) {
                if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed: $e'), backgroundColor: AppColors.error));
              }
            },
            child: const Text('Send Payment Request'),
          ),
        ],
      ),
    );
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
            const Text('Enter the OTP shared by the customer to finalize this booking.'),
            const SizedBox(height: 16),
            TextField(
              controller: otpCtrl,
              keyboardType: TextInputType.number,
              maxLength: 6,
              decoration: const InputDecoration(labelText: 'Customer OTP', hintText: '6-digit OTP'),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.success),
            onPressed: () async {
              final otp = otpCtrl.text.trim();
              if (otp.length != 6) return;
              Navigator.pop(ctx);
              try {
                await _api.verifyCompletionOtp(bookingId, otp);
                _loadBooking();
                if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Booking completed!'), backgroundColor: AppColors.success));
              } catch (e) {
                if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed: $e'), backgroundColor: AppColors.error));
              }
            },
            child: const Text('Complete'),
          ),
        ],
      ),
    );
  }

  Future<void> _updateStatus(String id, String status) async {
    try {
      await _api.updateBookingStatus(id, status);
      _loadBooking();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Booking ${status == 'confirmed' ? 'accepted' : status}')),
        );
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed: $e'), backgroundColor: AppColors.error));
    }
  }

  Widget _buildShimmer() {
    return Shimmer.fromColors(
      baseColor: AppColors.isDark(context) ? AppColors.darkSurfaceAlt : AppColors.surfaceAlt,
      highlightColor: AppColors.isDark(context) ? AppColors.darkSurface : AppColors.surface,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: List.generate(4, (_) => Container(
          height: 80,
          margin: const EdgeInsets.only(bottom: 12),
          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14)),
        )),
      ),
    );
  }
}

class _TimelineStep {
  final String label;
  final IconData icon;
  final bool done;
  const _TimelineStep(this.label, this.icon, this.done);
}
