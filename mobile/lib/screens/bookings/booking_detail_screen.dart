import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:shimmer/shimmer.dart';
import 'package:vendorcenter/config/theme.dart';
import 'package:vendorcenter/services/api_service.dart';
import 'package:vendorcenter/widgets/status_badge.dart';

class BookingDetailScreen extends StatefulWidget {
  final String bookingId;
  const BookingDetailScreen({super.key, required this.bookingId});

  @override
  State<BookingDetailScreen> createState() => _BookingDetailScreenState();
}

class _BookingDetailScreenState extends State<BookingDetailScreen> {
  final _api = ApiService();
  Map<String, dynamic>? _booking;
  bool _loading = true;
  bool _paying = false;

  @override
  void initState() {
    super.initState();
    _loadBooking();
  }

  Future<void> _loadBooking() async {
    setState(() => _loading = true);
    try {
      final bookings = await _api.getBookings();
      final match = bookings.firstWhere(
        (b) => b['id']?.toString() == widget.bookingId,
        orElse: () => null,
      );
      if (mounted) setState(() { _booking = match; _loading = false; });
    } catch (e) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _handlePay() async {
    if (_booking == null) return;
    setState(() => _paying = true);
    try {
      await _api.payBooking(_booking!['id'].toString(), 'app_confirm');
      _loadBooking();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Payment failed: $e'), backgroundColor: AppColors.error),
        );
      }
    } finally {
      if (mounted) setState(() => _paying = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Booking Details'),
        leading: IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => context.pop()),
      ),
      body: _loading
          ? _buildShimmer()
          : _booking == null
              ? _buildNotFound()
              : _buildContent(),
    );
  }

  Widget _buildContent() {
    final b = _booking!;
    final status = (b['status'] ?? 'pending').toString().toLowerCase();
    final dateStr = b['scheduledDate']?.toString() ?? b['preferred_date']?.toString() ?? b['scheduled_date']?.toString() ?? '';
    final timeStr = b['scheduledTime']?.toString() ?? b['preferred_time']?.toString() ?? b['scheduled_time']?.toString() ?? '';
    final totalAmount = b['finalAmount']?.toString() ?? b['total_amount']?.toString() ?? '0';
    final rawFinal = b['finalAmount'] ?? b['final_amount'];
    final finalAmount = rawFinal != null ? '${(num.tryParse(rawFinal.toString()) ?? 0) / 100}' : null;
    final displayAmount = finalAmount ?? totalAmount;
    final vendorName = b['vendorName'] ?? b['vendor_business_name'] ?? b['vendor_name'] ?? 'Vendor';
    final serviceName = b['serviceName'] ?? b['service_name'] ?? 'Service';
    final notes = b['notes']?.toString() ?? '';
    final createdAt = b['createdAt']?.toString() ?? b['created_at']?.toString() ?? '';
    final paymentStatus = (b['paymentStatus']?.toString() ?? b['payment_status']?.toString() ?? '').toLowerCase();
    final workStartedAt = b['workStartedAt']?.toString() ?? b['work_started_at']?.toString() ?? '';
    final completionRequested = (b['completionRequestedAt'] ?? b['completion_requested_at']) != null;
    final rejectionReason = b['rejectionReason']?.toString() ?? b['rejection_reason']?.toString() ?? '';
    final transactionId = b['transactionId']?.toString() ?? b['transaction_id']?.toString() ?? '';

    String formattedDate = dateStr;
    try {
      if (dateStr.isNotEmpty) formattedDate = DateFormat('dd MMM yyyy').format(DateTime.parse(dateStr));
    } catch (_) {}

    String formattedCreated = createdAt;
    try {
      if (createdAt.isNotEmpty) formattedCreated = DateFormat('dd MMM yyyy, hh:mm a').format(DateTime.parse(createdAt));
    } catch (_) {}

    String formattedWorkStart = '';
    try {
      if (workStartedAt.isNotEmpty) formattedWorkStart = DateFormat('dd MMM yyyy, hh:mm a').format(DateTime.parse(workStartedAt));
    } catch (_) {}

    return RefreshIndicator(
      onRefresh: _loadBooking,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Status + ID header
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              StatusBadge(status: status),
              Text(transactionId.isNotEmpty ? transactionId : '#${b['id']}',
                style: TextStyle(fontSize: 13, color: AppColors.textMutedOf(context))),
            ],
          ),
          const SizedBox(height: 16),

          // Status-specific message banner
          _buildStatusBanner(status, paymentStatus, completionRequested),
          const SizedBox(height: 12),

          // Service info
          _infoCard([
            _detailRow('Service', serviceName),
            _detailRow('Vendor', vendorName),
            _detailRow('Amount', '₹$displayAmount'),
            if (finalAmount != null && totalAmount != finalAmount)
              _detailRow('Original', '₹$totalAmount'),
          ]),
          const SizedBox(height: 12),

          // Schedule
          _infoCard([
            _detailRow('Date', formattedDate),
            _detailRow('Time', timeStr),
            if (formattedWorkStart.isNotEmpty)
              _detailRow('Work Started', formattedWorkStart),
          ]),
          const SizedBox(height: 12),

          // Payment & meta
          _infoCard([
            _detailRow('Payment', paymentStatus.isNotEmpty ? paymentStatus[0].toUpperCase() + paymentStatus.substring(1) : 'Pending'),
            _detailRow('Booked On', formattedCreated),
          ]),

          if (notes.isNotEmpty) ...[
            const SizedBox(height: 12),
            _infoCard([_detailRow('Notes', notes)]),
          ],

          // Rejection reason
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
                  const Text('Cancellation Reason', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.error)),
                  const SizedBox(height: 4),
                  Text(rejectionReason, style: TextStyle(fontSize: 14, color: AppColors.textOf(context))),
                ],
              ),
            ),
          ],

          const SizedBox(height: 20),

          // Action buttons based on flow state
          // Payment: shown when vendor has requested payment and customer hasn't paid yet
          if (status == 'in_progress' && completionRequested && paymentStatus != 'success')
            FilledButton.icon(
              onPressed: _paying ? null : _handlePay,
              icon: _paying
                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Icon(Icons.payment),
              label: Text(_paying ? 'Processing...' : 'Confirm Payment — ₹$displayAmount'),
              style: FilledButton.styleFrom(
                minimumSize: const Size.fromHeight(48),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),

          // Review: shown when booking is completed
          if (status == 'completed') ...[
            const SizedBox(height: 8),
            OutlinedButton.icon(
              onPressed: () {
                final vendorId = b['vendorId']?.toString() ?? b['vendor_id']?.toString();
                if (vendorId != null) context.push('/review/$vendorId/${b['id']}');
              },
              icon: const Icon(Icons.rate_review_outlined),
              label: const Text('Write a Review'),
              style: OutlinedButton.styleFrom(
                minimumSize: const Size.fromHeight(48),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildStatusBanner(String status, String paymentStatus, bool completionRequested) {
    IconData icon;
    Color color;
    String message;

    switch (status) {
      case 'pending':
        icon = Icons.hourglass_top;
        color = Colors.orange;
        message = 'Waiting for vendor to accept your booking.';
      case 'confirmed':
        icon = Icons.check_circle_outline;
        color = AppColors.success;
        message = 'Vendor has accepted. Work will begin as scheduled.';
      case 'in_progress' when !completionRequested:
        icon = Icons.build_circle;
        color = AppColors.primary;
        message = 'Work is in progress.';
      case 'in_progress' when completionRequested && paymentStatus != 'success':
        icon = Icons.email_outlined;
        color = Colors.orange;
        message = 'Work complete! Check your email for the payment link, or tap the button below to pay now.';
      case 'in_progress' when paymentStatus == 'success':
        icon = Icons.vpn_key;
        color = AppColors.primary;
        message = 'Payment confirmed! A completion OTP was sent to your email. Share it with the vendor to finalize.';
      case 'completed':
        icon = Icons.task_alt;
        color = AppColors.success;
        message = 'Booking completed successfully.';
      case 'cancelled':
        icon = Icons.cancel_outlined;
        color = AppColors.error;
        message = 'This booking was cancelled.';
      default:
        icon = Icons.info_outline;
        color = AppColors.textSecondary;
        message = 'Status: $status';
    }

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 14),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          Icon(icon, size: 20, color: color),
          const SizedBox(width: 10),
          Expanded(child: Text(message, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: color))),
        ],
      ),
    );
  }

  Widget _infoCard(List<Widget> children) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surfaceOf(context),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.borderOf(context)),
      ),
      child: Column(children: children),
    );
  }

  Widget _detailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(width: 100, child: Text(label, style: TextStyle(fontSize: 13, color: AppColors.textSecondaryOf(context)))),
          Expanded(child: Text(value, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: AppColors.textOf(context)))),
        ],
      ),
    );
  }

  Widget _buildNotFound() {
    return Center(child: Text('Booking not found', style: TextStyle(color: AppColors.textSecondaryOf(context))));
  }

  Widget _buildShimmer() {
    final isDark = AppColors.isDark(context);
    return Shimmer.fromColors(
      baseColor: isDark ? AppColors.darkSurfaceAlt : Colors.grey.shade200,
      highlightColor: isDark ? AppColors.darkBorder : Colors.grey.shade50,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: List.generate(3, (_) => Container(
            height: 90,
            margin: const EdgeInsets.only(bottom: 12),
            decoration: BoxDecoration(color: AppColors.surfaceOf(context), borderRadius: BorderRadius.circular(14)),
          )),
        ),
      ),
    );
  }
}
