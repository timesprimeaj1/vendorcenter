import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:shimmer/shimmer.dart';

import 'package:vendorcenter/config/theme.dart';
import 'package:vendorcenter/services/api_service.dart';
import 'package:vendorcenter/services/auth_service.dart';
import 'package:vendorcenter/services/localization_service.dart';
import 'package:vendorcenter/widgets/booking_card.dart';

class BookingsScreen extends StatefulWidget {
  const BookingsScreen({super.key});

  @override
  State<BookingsScreen> createState() => _BookingsScreenState();
}

class _BookingsScreenState extends State<BookingsScreen> with SingleTickerProviderStateMixin {
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
    final auth = context.read<AuthService>();
    if (!auth.isLoggedIn) return;
    setState(() => _loading = true);
    try {
      final bookings = await _api.getBookings();
      if (mounted) setState(() { _bookings = bookings; _loading = false; });
    } catch (e) {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<dynamic> _filterByStatus(String tab) {
    switch (tab) {
      case 'active':
        return _bookings.where((b) {
          final s = (b['status'] ?? '').toString().toLowerCase();
          return s == 'pending' || s == 'confirmed' || s == 'in_progress';
        }).toList();
      case 'completed':
        return _bookings.where((b) => (b['status'] ?? '').toString().toLowerCase() == 'completed').toList();
      case 'cancelled':
        return _bookings.where((b) {
          final s = (b['status'] ?? '').toString().toLowerCase();
          return s == 'cancelled' || s == 'rejected';
        }).toList();
      default:
        return _bookings;
    }
  }

  @override
  Widget build(BuildContext context) {
    final isLoggedIn = context.watch<AuthService>().isLoggedIn;

    if (!isLoggedIn) {
      return Scaffold(
        appBar: AppBar(title: Text(context.tr('bookings.title'))),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.08),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.lock_outline_rounded, size: 40, color: AppColors.primary),
                ),
                const SizedBox(height: 16),
                Text(context.tr('bookings.sign_in_to_view'), style: TextStyle(color: AppColors.textSecondaryOf(context), fontSize: 16)),
                const SizedBox(height: 20),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: () => context.go('/login'),
                    child: Text(context.tr('auth.login')),
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: Text(context.tr('bookings.title')),
        bottom: TabBar(
          controller: _tabCtrl,
          tabs: [
            Tab(text: context.tr('bookings.active')),
            Tab(text: context.tr('bookings.completed')),
            Tab(text: context.tr('bookings.cancelled')),
          ],
        ),
      ),
      body: RefreshIndicator(
        color: AppColors.primary,
        onRefresh: _loadBookings,
        child: _loading
            ? _buildShimmer()
            : TabBarView(
                controller: _tabCtrl,
                children: [
                  _buildBookingList('active'),
                  _buildBookingList('completed'),
                  _buildBookingList('cancelled'),
                ],
              ),
      ),
    );
  }

  Widget _buildBookingList(String tab) {
    final filtered = _filterByStatus(tab);

    if (filtered.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.event_busy, size: 56, color: AppColors.textMutedOf(context)),
            const SizedBox(height: 12),
            Text(context.tr('bookings.empty'), style: TextStyle(color: AppColors.textSecondaryOf(context))),
          ],
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
      itemCount: filtered.length,
      itemBuilder: (_, i) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: BookingCard(
          booking: filtered[i],
          onTap: () {
            final id = filtered[i]['id']?.toString();
            if (id != null) context.push('/booking/$id');
          },
        ),
      ),
    );
  }

  Widget _buildShimmer() {
    final isDark = AppColors.isDark(context);
    return Shimmer.fromColors(
      baseColor: isDark ? const Color(0xFF2A2A2A) : Colors.grey.shade200,
      highlightColor: isDark ? const Color(0xFF3A3A3A) : Colors.grey.shade50,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: 4,
        itemBuilder: (_, __) => Container(
          height: 110,
          margin: const EdgeInsets.only(bottom: 10),
          decoration: BoxDecoration(color: AppColors.surfaceOf(context), borderRadius: BorderRadius.circular(14)),
        ),
      ),
    );
  }
}
