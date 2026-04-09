import 'package:flutter/material.dart';

class StatusBadge extends StatelessWidget {
  final String status;
  const StatusBadge({super.key, required this.status});

  @override
  Widget build(BuildContext context) {
    final lower = status.toLowerCase();
    final (Color bg, Color fg, String label) = switch (lower) {
      'pending' => (const Color(0xFFFFF7ED), const Color(0xFFF97316), 'Pending'),
      'confirmed' => (const Color(0xFFEFF6FF), const Color(0xFF2563EB), 'Confirmed'),
      'in_progress' => (const Color(0xFFEFF6FF), const Color(0xFF004AC6), 'In Progress'),
      'completed' => (const Color(0xFFF0FDF4), const Color(0xFF22C55E), 'Completed'),
      'cancelled' => (const Color(0xFFFEF2F2), const Color(0xFFEF4444), 'Cancelled'),
      'rejected' => (const Color(0xFFFEF2F2), const Color(0xFFEF4444), 'Rejected'),
      'paid' => (const Color(0xFFF0FDF4), const Color(0xFF22C55E), 'Paid'),
      _ => (const Color(0xFFF2F3FF), const Color(0xFF737686), status),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(8)),
      child: Text(label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: fg)),
    );
  }
}
