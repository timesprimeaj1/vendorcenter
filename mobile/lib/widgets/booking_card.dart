import 'package:flutter/material.dart';
import 'package:vendorcenter/config/theme.dart';
import 'package:vendorcenter/widgets/status_badge.dart';

class BookingCard extends StatelessWidget {
  final Map<String, dynamic> booking;
  final VoidCallback? onTap;

  const BookingCard({super.key, required this.booking, this.onTap});

  @override
  Widget build(BuildContext context) {
    final status = (booking['status'] ?? 'pending').toString();
    final vendorName = booking['vendorName'] ?? booking['vendor_business_name'] ?? booking['vendor_name'] ?? 'Vendor';
    final serviceName = booking['serviceName'] ?? booking['service_name'] ?? 'Service';
    final amount = (booking['finalAmount'] ?? booking['total_amount'] ?? 0).toString();
    final date = (booking['scheduledDate'] ?? booking['preferred_date'] ?? '').toString();
    final time = (booking['scheduledTime'] ?? booking['preferred_time'] ?? '').toString();
    final isDark = AppColors.isDark(context);
    final isActive = ['pending', 'confirmed', 'in_progress'].contains(status.toLowerCase());

    String displayDate = date;
    try {
      if (date.isNotEmpty) {
        final d = DateTime.parse(date);
        displayDate = '${d.day}/${d.month}/${d.year}';
      }
    } catch (_) {}

    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isDark ? AppColors.darkSurface : AppColors.surface,
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: isActive
                  ? AppColors.primary.withValues(alpha: isDark ? 0.08 : 0.06)
                  : Colors.black.withValues(alpha: 0.03),
              blurRadius: 20,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Service name + status
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Service icon
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(Icons.home_repair_service_rounded, size: 20, color: AppColors.primary),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(serviceName, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.textOf(context)), maxLines: 1, overflow: TextOverflow.ellipsis),
                      const SizedBox(height: 2),
                      Text(vendorName, style: TextStyle(fontSize: 13, color: AppColors.textSecondaryOf(context))),
                    ],
                  ),
                ),
                StatusBadge(status: status),
              ],
            ),
            const SizedBox(height: 14),
            // Date/Time + Amount row — tonal background
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: isDark ? AppColors.darkSurfaceAlt : AppColors.surfaceAlt,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                children: [
                  Icon(Icons.calendar_today_rounded, size: 14, color: AppColors.textSecondaryOf(context)),
                  const SizedBox(width: 6),
                  Text(displayDate, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: AppColors.textOf(context))),
                  if (time.isNotEmpty) ...[
                    const SizedBox(width: 12),
                    Icon(Icons.access_time_rounded, size: 14, color: AppColors.textSecondaryOf(context)),
                    const SizedBox(width: 4),
                    Text(time, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: AppColors.textOf(context))),
                  ],
                  const Spacer(),
                  Text('₹$amount', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.primary)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
