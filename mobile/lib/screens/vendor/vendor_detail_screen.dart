import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_rating_bar/flutter_rating_bar.dart';
import 'package:shimmer/shimmer.dart';
import 'package:share_plus/share_plus.dart';
import 'package:vendorcenter/config/theme.dart';
import 'package:vendorcenter/services/api_service.dart';
import 'package:vendorcenter/services/localization_service.dart';

class VendorDetailScreen extends StatefulWidget {
  final String vendorId;
  const VendorDetailScreen({super.key, required this.vendorId});

  @override
  State<VendorDetailScreen> createState() => _VendorDetailScreenState();
}

class _VendorDetailScreenState extends State<VendorDetailScreen> with SingleTickerProviderStateMixin {
  final _api = ApiService();
  Map<String, dynamic>? _vendor;
  List<dynamic> _services = [];
  List<dynamic> _reviews = [];
  bool _loading = true;
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _loadData();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    setState(() => _loading = true);
    try {
      final results = await Future.wait([
        _api.getVendorDetail(widget.vendorId),
        _api.getPublicReviews(widget.vendorId),
      ]);
      if (mounted) {
        final vendorData = results[0] as Map<String, dynamic>;
        setState(() {
          _vendor = vendorData;
          // Services are included inline in the detail response
          _services = (vendorData['services'] as List<dynamic>?) ?? [];
          _reviews = results[1] as List;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _loading = false);
    }
  }

  double get _avgRating {
    if (_reviews.isEmpty) return 0;
    final sum = _reviews.fold<double>(0, (s, r) => s + (r['rating'] ?? 0).toDouble());
    return sum / _reviews.length;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: _loading
          ? _buildShimmer()
          : _vendor == null
              ? Center(child: Text(context.tr('vendor.not_found')))
              : _buildContent(),
    );
  }

  Widget _buildContent() {
    final v = _vendor!;
    final name = v['businessName'] ?? v['business_name'] ?? 'Vendor';
    final categories = v['serviceCategories'] as List<dynamic>?;
    final category = (categories != null && categories.isNotEmpty) ? categories.first.toString() : (v['category'] ?? '');
    final city = v['zone'] ?? v['city'] ?? '';
    final description = v['description'] ?? '';
    final phone = v['phone'] ?? '';
    final ownerName = v['ownerName'] ?? '';
    final isVerified = v['verificationStatus'] == 'approved' || v['is_verified'] == true;
    final initials = _getInitials(name);

    return CustomScrollView(
      slivers: [
        // Gradient header with avatar (Stitch pattern)
        SliverAppBar(
          expandedHeight: 220,
          pinned: true,
          leading: IconButton(
            icon: const CircleAvatar(
              radius: 16,
              backgroundColor: Colors.white70,
              child: Icon(Icons.arrow_back, size: 18, color: Colors.black87),
            ),
            onPressed: () => context.pop(),
          ),
          actions: [
            IconButton(
              icon: const CircleAvatar(
                radius: 16,
                backgroundColor: Colors.white70,
                child: Icon(Icons.share_outlined, size: 18, color: Colors.black87),
              ),
              onPressed: () => Share.share('Check out $name on VendorCenter!\nhttps://vendorcenter.in/vendor/${widget.vendorId}'),
            ),
          ],
          flexibleSpace: FlexibleSpaceBar(
            background: Container(
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [AppColors.gradientStart, AppColors.gradientEnd],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
              ),
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const SizedBox(height: 40),
                    // Avatar with verified badge overlay
                    Stack(
                      clipBehavior: Clip.none,
                      children: [
                        CircleAvatar(
                          radius: 40,
                          backgroundColor: Colors.white24,
                          child: Icon(
                            _categoryIcon(category),
                            size: 36,
                            color: Colors.white,
                          ),
                        ),
                        if (isVerified)
                          Positioned(
                            bottom: 0,
                            right: -2,
                            child: Container(
                              padding: const EdgeInsets.all(3),
                              decoration: const BoxDecoration(
                                color: Colors.white,
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(Icons.verified, size: 18, color: Color(0xFF2874F0)),
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Text(name, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: Colors.white)),
                    const SizedBox(height: 4),
                    Text(category, style: const TextStyle(fontSize: 14, color: Colors.white70)),
                    const SizedBox(height: 6),
                    // "Open Now" badge (Stitch pattern)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: const Color(0xFF16A34A).withValues(alpha: 0.2),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: Colors.white30),
                      ),
                      child: const Text(
                        'Open Now',
                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Colors.white),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),

        // Info row + tabs (Stitch pattern)
        SliverToBoxAdapter(
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
                child: Row(
                  children: [
                    if (city.isNotEmpty) ...[
                      Icon(Icons.location_on_outlined, size: 16, color: AppColors.textSecondaryOf(context)),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(city, style: TextStyle(color: AppColors.textSecondaryOf(context), fontSize: 13),
                            maxLines: 1, overflow: TextOverflow.ellipsis),
                      ),
                    ],
                    if (_reviews.isNotEmpty) ...[
                      const SizedBox(width: 8),
                      const Icon(Icons.star_rounded, size: 16, color: Color(0xFFF59E0B)),
                      const SizedBox(width: 4),
                      Text('${_avgRating.toStringAsFixed(1)} (${_reviews.length} Reviews)',
                          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textOf(context))),
                    ],
                  ],
                ),
              ),
              // Tab bar (Stitch pattern)
              TabBar(
                controller: _tabController,
                labelColor: AppColors.primary,
                unselectedLabelColor: AppColors.textMutedOf(context),
                indicatorColor: AppColors.primary,
                indicatorWeight: 3,
                labelStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                tabs: [
                  Tab(text: context.tr('vendor.services')),
                  Tab(text: context.tr('vendor.reviews')),
                  const Tab(text: 'About'),
                ],
              ),
            ],
          ),
        ),

        // Tab content
        SliverFillRemaining(
          child: TabBarView(
            controller: _tabController,
            children: [
              // Services tab
              _buildServicesTab(),
              // Reviews tab
              _buildReviewsTab(),
              // About tab
              _buildAboutTab(description, phone, city, ownerName),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildServicesTab() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Book button at top
        _buildBookButton(),
        const SizedBox(height: 16),
        if (_services.isEmpty)
          Center(child: Padding(
            padding: const EdgeInsets.all(32),
            child: Text('No services listed yet', style: TextStyle(color: AppColors.textMutedOf(context))),
          ))
        else
          ..._services.map((s) => _serviceItem(s)),
      ],
    );
  }

  Widget _buildReviewsTab() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        if (_reviews.isEmpty)
          Center(child: Padding(
            padding: const EdgeInsets.all(32),
            child: Text(context.tr('vendor.review_count', {'count': '0'}), style: TextStyle(color: AppColors.textMutedOf(context))),
          ))
        else
          ..._reviews.take(10).map((r) => _reviewItem(r)),
      ],
    );
  }

  Widget _buildAboutTab(String description, String phone, String city, String ownerName) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        if (description.isNotEmpty) ...[
          Text('Description', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.textOf(context))),
          const SizedBox(height: 8),
          Text(description, style: TextStyle(fontSize: 14, color: AppColors.textSecondaryOf(context), height: 1.5)),
          const SizedBox(height: 20),
        ],
        if (ownerName.isNotEmpty) ...[
          _aboutRow(Icons.person_outline_rounded, 'Owner', ownerName),
          const SizedBox(height: 12),
        ],
        if (city.isNotEmpty) ...[
          _aboutRow(Icons.location_on_outlined, 'Location', city),
          const SizedBox(height: 12),
        ],
        if (phone.isNotEmpty)
          _aboutRow(Icons.phone_outlined, 'Phone', phone),
      ],
    );
  }

  Widget _aboutRow(IconData icon, String label, String value) {
    return Row(
      children: [
        Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: AppColors.primary.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(icon, size: 20, color: AppColors.primary),
        ),
        const SizedBox(width: 12),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: TextStyle(fontSize: 12, color: AppColors.textMutedOf(context))),
            Text(value, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: AppColors.textOf(context))),
          ],
        ),
      ],
    );
  }

  Widget _buildBookButton() {
    return Container(
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [AppColors.gradientStart, AppColors.gradientEnd],
          begin: Alignment.centerLeft,
          end: Alignment.centerRight,
        ),
        borderRadius: BorderRadius.circular(14),
        boxShadow: [
          BoxShadow(color: AppColors.primary.withValues(alpha: 0.3), blurRadius: 10, offset: const Offset(0, 4)),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: () => context.push('/book/${widget.vendorId}'),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 14),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.event_rounded, color: Colors.white, size: 20),
                const SizedBox(width: 8),
                Text(context.tr('bookings.book_now'),
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Colors.white)),
              ],
            ),
          ),
        ),
      ),
    );
  }

  String _getInitials(String name) {
    final words = name.trim().split(RegExp(r'\s+'));
    if (words.length >= 2) return '${words[0][0]}${words[1][0]}'.toUpperCase();
    if (name.length >= 2) return name.substring(0, 2).toUpperCase();
    return name.isNotEmpty ? name[0].toUpperCase() : 'V';
  }

  IconData _categoryIcon(String category) {
    final lower = category.toLowerCase();
    if (lower.contains('appliance') || lower.contains('repair') || lower.contains('mechanic')) return Icons.home_repair_service_rounded;
    if (lower.contains('clean')) return Icons.cleaning_services_rounded;
    if (lower.contains('electric') || lower.contains('wiring')) return Icons.bolt_rounded;
    if (lower.contains('plumb') || lower.contains('pipe')) return Icons.plumbing_rounded;
    if (lower.contains('paint') || lower.contains('décor')) return Icons.format_paint_rounded;
    if (lower.contains('salon') || lower.contains('beauty') || lower.contains('hair')) return Icons.content_cut_rounded;
    if (lower.contains('pest') || lower.contains('fumig')) return Icons.bug_report_rounded;
    if (lower.contains('moving') || lower.contains('reloc') || lower.contains('tow')) return Icons.local_shipping_rounded;
    if (lower.contains('car') || lower.contains('auto') || lower.contains('vehicle')) return Icons.directions_car_rounded;
    if (lower.contains('garden') || lower.contains('lawn')) return Icons.yard_rounded;
    if (lower.contains('tutor') || lower.contains('teach') || lower.contains('education')) return Icons.school_rounded;
    if (lower.contains('photo') || lower.contains('video')) return Icons.camera_alt_rounded;
    if (lower.contains('catering') || lower.contains('food') || lower.contains('cook')) return Icons.restaurant_rounded;
    if (lower.contains('tailor') || lower.contains('cloth') || lower.contains('stitch')) return Icons.checkroom_rounded;
    if (lower.contains('security') || lower.contains('guard')) return Icons.security_rounded;
    if (lower.contains('ac') || lower.contains('hvac') || lower.contains('air')) return Icons.ac_unit_rounded;
    return Icons.storefront_rounded;
  }

  Widget _serviceItem(dynamic s) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.borderOf(context)),
        color: AppColors.surfaceOf(context),
        boxShadow: [
          BoxShadow(color: Colors.black.withValues(alpha: 0.02), blurRadius: 6, offset: const Offset(0, 2)),
        ],
      ),
      child: Row(
        children: [
          // Service icon (Stitch pattern)
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(_serviceIcon(s['name'] ?? ''), size: 22, color: AppColors.primary),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(s['name'] ?? '', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14, color: AppColors.textOf(context))),
                if (s['description'] != null)
                  Text(s['description'], style: TextStyle(fontSize: 12, color: AppColors.textSecondaryOf(context)), maxLines: 1, overflow: TextOverflow.ellipsis),
                if (s['duration_minutes'] != null)
                  Text('${s['duration_minutes']} min', style: TextStyle(fontSize: 11, color: AppColors.textMutedOf(context))),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text('₹${s['price'] ?? '0'}',
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.primary)),
              const SizedBox(height: 4),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                decoration: BoxDecoration(
                  color: AppColors.primary,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Text('Book', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.white)),
              ),
            ],
          ),
        ],
      ),
    );
  }

  IconData _serviceIcon(String name) {
    final lower = name.toLowerCase();
    if (lower.contains('ac') || lower.contains('air')) return Icons.ac_unit;
    if (lower.contains('plumb') || lower.contains('pipe')) return Icons.plumbing;
    if (lower.contains('electric') || lower.contains('wir')) return Icons.bolt;
    if (lower.contains('clean')) return Icons.cleaning_services;
    if (lower.contains('paint')) return Icons.format_paint;
    return Icons.build_outlined;
  }

  Widget _reviewItem(dynamic r) {
    final createdAt = r['createdAt'] ?? r['created_at'];
    String timeAgo = '';
    if (createdAt != null) {
      final dt = DateTime.tryParse(createdAt.toString());
      if (dt != null) {
        final diff = DateTime.now().difference(dt).inDays;
        if (diff == 0) timeAgo = 'Today';
        else if (diff == 1) timeAgo = 'Yesterday';
        else if (diff < 30) timeAgo = '$diff days ago';
        else timeAgo = '${diff ~/ 30} months ago';
      }
    }

    final customerName = r['customerName'] ?? r['customer_name'];
    final reviewText = r['reviewText'] ?? r['comment'] ?? r['review_text'];

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        color: AppColors.surfaceOf(context),
        border: Border.all(color: AppColors.borderOf(context)),
        boxShadow: [
          BoxShadow(color: Colors.black.withValues(alpha: 0.02), blurRadius: 6, offset: const Offset(0, 2)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleAvatar(
                radius: 18,
                backgroundColor: AppColors.accent.withValues(alpha: 0.1),
                child: Text(
                  (customerName ?? 'A')[0].toUpperCase(),
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.accent),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(customerName ?? 'Anonymous',
                        style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14, color: AppColors.textOf(context))),
                    if (timeAgo.isNotEmpty)
                      Text(timeAgo, style: TextStyle(fontSize: 11, color: AppColors.textMutedOf(context))),
                  ],
                ),
              ),
              RatingBarIndicator(
                rating: (r['rating'] ?? 0).toDouble(),
                itemSize: 16,
                itemBuilder: (_, __) => const Icon(Icons.star_rounded, color: Color(0xFFF59E0B)),
              ),
            ],
          ),
          if (reviewText != null && reviewText.toString().isNotEmpty) ...[
            const SizedBox(height: 10),
            Text(reviewText.toString(), style: TextStyle(fontSize: 13, color: AppColors.textSecondaryOf(context), height: 1.5)),
          ],
        ],
      ),
    );
  }

  Widget _buildShimmer() {
    final isDark = AppColors.isDark(context);
    return Shimmer.fromColors(
      baseColor: isDark ? AppColors.darkSurfaceAlt : Colors.grey.shade200,
      highlightColor: isDark ? AppColors.darkBorder : Colors.grey.shade50,
      child: CustomScrollView(
        slivers: [
          SliverAppBar(expandedHeight: 200, flexibleSpace: Container(color: AppColors.surfaceOf(context))),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(children: List.generate(5, (_) => Container(
                height: 60, margin: const EdgeInsets.only(bottom: 10),
                decoration: BoxDecoration(color: AppColors.surfaceOf(context), borderRadius: BorderRadius.circular(12)),
              ))),
            ),
          ),
        ],
      ),
    );
  }
}
