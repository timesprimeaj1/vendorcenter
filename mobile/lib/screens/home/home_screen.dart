import 'dart:async';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:shimmer/shimmer.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:vendorcenter/config/theme.dart';
import 'package:vendorcenter/services/api_service.dart';
import 'package:vendorcenter/config/api_config.dart';
import 'package:vendorcenter/services/auth_service.dart';
import 'package:vendorcenter/services/localization_service.dart';
import 'package:vendorcenter/services/location_service.dart';
import 'package:vendorcenter/services/permission_service.dart';
import 'package:vendorcenter/widgets/category_card.dart';
import 'package:vendorcenter/widgets/vendor_card.dart';
import 'package:vendorcenter/widgets/location_picker_sheet.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> with TickerProviderStateMixin {
  final _api = ApiService();
  List<dynamic> _categories = [];
  List<dynamic> _vendors = [];
  Map<String, dynamic> _stats = {};
  bool _loading = true;

  // Pagination
  int _vendorPage = 1;
  bool _loadingMore = false;
  bool _hasMoreVendors = true;
  final _scrollController = ScrollController();

  // Banner carousel
  late final PageController _bannerCtrl;
  int _bannerPage = 0;
  Timer? _bannerTimer;

  // Track location to reload on change
  double? _lastLat;
  double? _lastLng;

  // Notification badge
  int _unreadCount = 0;

  @override
  void initState() {
    super.initState();
    _bannerCtrl = PageController(viewportFraction: 1.0);
    _loadData();
    _loadUnreadCount();
    // Request permissions after first frame
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) PermissionService.requestStartupPermissions(context);
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final loc = context.read<LocationService>();
    if (loc.lat != _lastLat || loc.lng != _lastLng) {
      _lastLat = loc.lat;
      _lastLng = loc.lng;
      if (!_loading) _loadData();
    }
  }

  @override
  void dispose() {
    _bannerTimer?.cancel();
    _bannerCtrl.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _startBannerAutoScroll() {
    _bannerTimer?.cancel();
    _bannerTimer = Timer.periodic(const Duration(seconds: 4), (_) {
      if (!mounted || !_bannerCtrl.hasClients) return;
      final next = (_bannerPage + 1) % _bannerCount;
      _bannerCtrl.animateToPage(next, duration: const Duration(milliseconds: 500), curve: Curves.easeInOut);
    });
  }

  static const _bannerCount = 3;
  static const _bannerGradients = [
    [Color(0xFF004AC6), Color(0xFF2563EB)],
    [Color(0xFF2563EB), Color(0xFF60A5FA)],
    [Color(0xFF22C55E), Color(0xFF16A34A)],
  ];
  static const _bannerIcons = [
    Icons.verified_user_outlined,
    Icons.map_outlined,
    Icons.star_outline_rounded,
  ];
  static const _bannerTitleKeys = ['home.banner_find_title', 'home.banner_explore_title', 'home.banner_rate_title'];
  static const _bannerSubKeys = ['home.banner_find_sub', 'home.banner_explore_sub', 'home.banner_rate_sub'];

  Future<void> _loadUnreadCount() async {
    if (!context.read<AuthService>().isLoggedIn) return;
    try {
      final count = await _api.getUnreadNotificationCount();
      if (mounted) setState(() => _unreadCount = count);
    } catch (_) {}
  }

  Future<void> _loadData() async {
    setState(() => _loading = true);
    _vendorPage = 1;
    _hasMoreVendors = true;
    try {
      final loc = context.read<LocationService>();
      final hasLoc = loc.lat != null && loc.lng != null;
      final futures = <Future>[
        _api.getCategories(lat: loc.lat, lng: loc.lng),
        if (hasLoc)
          _api.getApprovedVendorsPaginated(lat: loc.lat, lng: loc.lng, page: 1, limit: 10),
        _api.getPublicStats(),
      ];
      final results = await Future.wait(futures);
      if (mounted) {
        final vendors = hasLoc ? (results[1] as List) : <dynamic>[];
        setState(() {
          _categories = results[0] as List;
          _vendors = vendors;
          _stats = (hasLoc ? results[2] : results[1]) as Map<String, dynamic>;
          _loading = false;
          _hasMoreVendors = vendors.length >= 10;
        });
        _startBannerAutoScroll();
      }
    } catch (e) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _loadMoreVendors() async {
    if (_loadingMore || !_hasMoreVendors) return;
    _loadingMore = true;
    try {
      final loc = context.read<LocationService>();
      final more = await _api.getApprovedVendorsPaginated(
        lat: loc.lat, lng: loc.lng, page: _vendorPage + 1, limit: 10,
      );
      if (mounted && more.isNotEmpty) {
        setState(() {
          _vendors.addAll(more);
          _vendorPage++;
          _hasMoreVendors = more.length >= 10;
        });
      } else {
        _hasMoreVendors = false;
      }
    } catch (_) {}
    _loadingMore = false;
  }

  @override
  Widget build(BuildContext context) {
    final userName = context.watch<AuthService>().userName;
    final isLoggedIn = context.watch<AuthService>().isLoggedIn;
    // Trigger rebuild on locale change
    context.watch<LocalizationService>();

    return Scaffold(
      body: SafeArea(
        child: RefreshIndicator(
          color: AppColors.primary,
          onRefresh: _loadData,
          child: _loading ? _buildShimmer() : NotificationListener<ScrollNotification>(
            onNotification: (scroll) {
              if (scroll.metrics.pixels > scroll.metrics.maxScrollExtent - 200) {
                _loadMoreVendors();
              }
              return false;
            },
            child: _buildContent(userName, isLoggedIn),
          ),
        ),
      ),
    );
  }

  Widget _buildContent(String userName, bool isLoggedIn) {
    return CustomScrollView(
      physics: const BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics()),
      slivers: [
        // Custom top bar
        SliverToBoxAdapter(child: _buildTopBar(userName, isLoggedIn)),

        // Search bar
        SliverToBoxAdapter(child: _buildSearchBar()),

        // Banner carousel
        SliverToBoxAdapter(child: _buildBannerCarousel()),

        // Quick actions
        SliverToBoxAdapter(child: _buildQuickActions()),

        // Stats social proof
        if (_stats.isNotEmpty)
          SliverToBoxAdapter(child: _buildSocialProof()),

        // Categories
        if (_categories.isNotEmpty) ...[
          SliverToBoxAdapter(
            child: _sectionTitle(context.tr('home.categories'), onSeeAll: () => context.go('/search')),
          ),
          SliverToBoxAdapter(
            child: SizedBox(
              height: 160,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                itemCount: _categories.length,
                separatorBuilder: (_, __) => const SizedBox(width: 10),
                itemBuilder: (_, i) {
                  final cat = _categories[i];
                  return CategoryCard(
                    name: cat['cat'] ?? '',
                    count: cat['vendor_count'] ?? 0,
                    onTap: () => context.go('/search?category=${Uri.encodeComponent(cat['cat'])}'),
                  );
                },
              ),
            ),
          ),
        ],

        // Top vendors
        if (_vendors.isNotEmpty) ...[
          SliverToBoxAdapter(
            child: _sectionTitle(context.tr('home.top_vendors'), onSeeAll: () => context.go('/search')),
          ),
          SliverPadding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            sliver: SliverList.builder(
              itemCount: _vendors.length,
              itemBuilder: (_, i) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: VendorCard(vendor: _vendors[i]),
              ),
            ),
          ),
        ] else if (!context.watch<LocationService>().hasLocation) ...[
          SliverToBoxAdapter(
            child: _buildLocationPrompt(),
          ),
        ] else if (!_loading) ...[
          // Location set but no vendors found → not serviceable
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
              child: Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: AppColors.surfaceAltOf(context),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.warning.withValues(alpha: 0.3)),
                ),
                child: Column(
                  children: [
                    Icon(Icons.location_off_rounded, size: 48, color: AppColors.warning),
                    const SizedBox(height: 12),
                    Text(
                      'Not available at your location',
                      style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: AppColors.textOf(context)),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'We\'re not serving ${context.watch<LocationService>().locationLabel} yet. Try a different location or check back soon!',
                      style: TextStyle(fontSize: 13, color: AppColors.textSecondaryOf(context)),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton.icon(
                        onPressed: () => LocationPickerSheet.show(context),
                        icon: const Icon(Icons.edit_location_alt_rounded, size: 18),
                        label: const Text('Change Location'),
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],

        // Bottom spacing for FAB + nav bar
        const SliverToBoxAdapter(child: SizedBox(height: 100)),
      ],
    );
  }

  // ── Top bar with greeting + action icons ─────────────────────

  Widget _buildTopBar(String userName, bool isLoggedIn) {
    final hasRealName = isLoggedIn && userName.isNotEmpty && userName != 'User'
        && !userName.toLowerCase().contains('vendorcenter')
        && !userName.toLowerCase().contains('welcome');
    final displayName = hasRealName ? userName : '';
    final initials = hasRealName ? _userInitials(userName) : '';
    final loc = context.watch<LocationService>();
    final auth = context.watch<AuthService>();
    final profilePic = auth.profilePictureUrl;
    final String? fullProfilePic = profilePic != null
        ? (profilePic.startsWith('http')
            ? profilePic
            : '${ApiConfig.baseUrl}/uploads/files/${profilePic.split('/').last}')
        : null;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 12, 4),
      child: Column(
        children: [
          Row(
            children: [
              // User avatar circle — gradient with profile pic
              GestureDetector(
                onTap: () => context.go('/profile'),
                child: Container(
                  width: 42,
                  height: 42,
                  decoration: const BoxDecoration(
                    gradient: LinearGradient(
                      colors: [AppColors.gradientStart, AppColors.gradientEnd],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    shape: BoxShape.circle,
                  ),
                  child: fullProfilePic != null
                      ? ClipOval(
                          child: CachedNetworkImage(
                            imageUrl: fullProfilePic,
                            width: 42,
                            height: 42,
                            fit: BoxFit.cover,
                            errorWidget: (_, __, ___) => Center(
                              child: hasRealName
                                  ? Text(initials, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Colors.white))
                                  : const Icon(Icons.person_rounded, size: 20, color: Colors.white),
                            ),
                          ),
                        )
                      : Center(
                          child: hasRealName
                              ? Text(initials, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Colors.white))
                              : const Icon(Icons.person_rounded, size: 20, color: Colors.white),
                        ),
                ),
              ),
              const SizedBox(width: 12),
              // Greeting — editorial typography
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _greeting(context),
                      style: TextStyle(fontSize: 13, color: AppColors.textSecondaryOf(context), fontWeight: FontWeight.w500),
                    ),
                    if (displayName.isNotEmpty) ...[              
                      const SizedBox(height: 1),
                      Text(
                        displayName,
                        style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.textOf(context)),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ],
                ),
              ),
              // Notification
              _ActionIcon(
                icon: Icons.notifications_outlined,
                onTap: () async {
                  await context.push('/notifications');
                  _loadUnreadCount();
                },
                badge: _unreadCount > 0,
              ),
            ],
          ),
          // Location bar — tonal, no border
          const SizedBox(height: 10),
          GestureDetector(
            onTap: () {
              LocationPickerSheet.show(context);
            },
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: AppColors.surfaceAltOf(context),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                children: [
                  Icon(
                    loc.hasLocation ? Icons.location_on_rounded : Icons.location_on_outlined,
                    size: 18,
                    color: AppColors.primary,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      loc.locationLabel,
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: loc.hasLocation ? AppColors.textOf(context) : AppColors.textMutedOf(context),
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  Icon(Icons.keyboard_arrow_down_rounded, size: 20, color: AppColors.textSecondaryOf(context)),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  String _userInitials(String name) {
    final words = name.trim().split(RegExp(r'\s+'));
    if (words.length >= 2) return '${words[0][0]}${words[1][0]}'.toUpperCase();
    if (name.length >= 2) return name.substring(0, 2).toUpperCase();
    return name.isNotEmpty ? name[0].toUpperCase() : 'U';
  }

  String _greeting(BuildContext context) {
    final hour = DateTime.now().hour;
    if (hour < 12) return context.tr('home.greeting_morning');
    if (hour < 17) return context.tr('home.greeting_afternoon');
    return context.tr('home.greeting_evening');
  }

  // ── Location prompt ───────────────────────────────────────────

  Widget _buildLocationPrompt() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: AppColors.surfaceAltOf(context),
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: AppColors.primary.withValues(alpha: 0.06),
              blurRadius: 24,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: Column(
          children: [
            Icon(Icons.location_on_outlined, size: 40, color: AppColors.primary),
            const SizedBox(height: 12),
            Text(
              context.tr('home.set_location_title'),
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.textOf(context)),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 6),
            Text(
              context.tr('home.set_location_sub'),
              style: TextStyle(fontSize: 13, color: AppColors.textSecondaryOf(context)),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: () => LocationPickerSheet.show(context),
                icon: const Icon(Icons.my_location_rounded, size: 18),
                label: Text(context.tr('home.set_location_btn')),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── Search bar ────────────────────────────────────────────────

  Widget _buildSearchBar() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
      child: GestureDetector(
        onTap: () => context.go('/search'),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          decoration: BoxDecoration(
            color: AppColors.surfaceAltOf(context),
            borderRadius: BorderRadius.circular(14),
            boxShadow: [
              BoxShadow(
                color: AppColors.primary.withValues(alpha: 0.04),
                blurRadius: 12,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Row(
            children: [
              Icon(Icons.search_rounded, color: AppColors.textMutedOf(context), size: 22),
              const SizedBox(width: 10),
              Text(
                context.tr('home.search_hint'),
                style: TextStyle(color: AppColors.textMutedOf(context), fontSize: 14),
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(Icons.tune_rounded, size: 16, color: AppColors.primary),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ── Banner carousel ───────────────────────────────────────────

  Widget _buildBannerCarousel() {
    return Column(
      children: [
        SizedBox(
          height: 160,
          child: PageView.builder(
            controller: _bannerCtrl,
            onPageChanged: (i) => setState(() => _bannerPage = i),
            itemCount: _bannerCount,
            itemBuilder: (_, i) => _buildBannerSlide(i),
          ),
        ),
        const SizedBox(height: 10),
        // Dots
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: List.generate(_bannerCount, (i) {
            final active = i == _bannerPage;
            return AnimatedContainer(
              duration: const Duration(milliseconds: 250),
              margin: const EdgeInsets.symmetric(horizontal: 3),
              width: active ? 22 : 7,
              height: 7,
              decoration: BoxDecoration(
                color: active ? AppColors.primary : AppColors.textMutedOf(context).withValues(alpha: 0.3),
                borderRadius: BorderRadius.circular(4),
              ),
            );
          }),
        ),
        const SizedBox(height: 16),
      ],
    );
  }

  Widget _buildBannerSlide(int index) {
    final gradient = _bannerGradients[index];
    final icon = _bannerIcons[index];
    final title = context.tr(_bannerTitleKeys[index]);
    final subtitle = context.tr(_bannerSubKeys[index]);
    return GestureDetector(
      onTap: () {
        if (index == 0) context.go('/search');
        if (index == 1) context.push('/explore');
        if (index == 2) context.go('/bookings');
      },
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 16),
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: gradient,
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(20),
          boxShadow: [
            BoxShadow(
              color: gradient.first.withValues(alpha: 0.3),
              blurRadius: 16,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    title,
                    style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: Colors.white, height: 1.25),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    subtitle,
                    style: TextStyle(fontSize: 13, color: Colors.white.withValues(alpha: 0.85)),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 12),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.18),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, size: 32, color: Colors.white),
            ),
          ],
        ),
      ),
    );
  }

  // ── Quick action grid ─────────────────────────────────────────

  Widget _buildQuickActions() {
    final actions = [
      _QuickAction(context.tr('home.quick_explore'), Icons.map_rounded, const [Color(0xFF004AC6), Color(0xFF2563EB)], () => context.push('/explore')),
      _QuickAction(context.tr('home.quick_bookings'), Icons.event_note_rounded, const [Color(0xFFF97316), Color(0xFFFF8C42)], () => context.go('/bookings')),
      _QuickAction(context.tr('home.quick_support'), Icons.headset_mic_rounded, const [Color(0xFFEF4444), Color(0xFFF87171)], () => context.push('/support')),
    ];

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
      child: Row(
        children: actions.asMap().entries.map((e) {
          final a = e.value;
          return Expanded(
            child: GestureDetector(
              onTap: a.onTap,
              child: Container(
                margin: EdgeInsets.only(left: e.key == 0 ? 0 : 8),
                padding: const EdgeInsets.symmetric(vertical: 14),
                decoration: BoxDecoration(
                  color: AppColors.surfaceAltOf(context),
                  borderRadius: BorderRadius.circular(14),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.03),
                      blurRadius: 8,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: Column(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        gradient: LinearGradient(colors: a.gradient),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Icon(a.icon, size: 20, color: Colors.white),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      a.label,
                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.textOf(context)),
                      textAlign: TextAlign.center,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  // ── Social proof stats bar ────────────────────────────────────

  Widget _buildSocialProof() {
    final items = [
      _StatItem(context.tr('home.stat_vendors'), _formatCount(_stats['activeVendors']), Icons.storefront_rounded, const Color(0xFF2563EB)),
      _StatItem(context.tr('home.stat_customers'), _formatCount(_stats['happyCustomers']), Icons.people_rounded, const Color(0xFF22C55E)),
      _StatItem(context.tr('home.stat_jobs'), _formatCount(_stats['servicesCompleted']), Icons.check_circle_rounded, const Color(0xFFF97316)),
    ];

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 16),
      padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 12),
      decoration: BoxDecoration(
        color: AppColors.surfaceAltOf(context),
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withValues(alpha: 0.05),
            blurRadius: 16,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Row(
        children: items.asMap().entries.map((e) {
          final item = e.value;
          return Expanded(
            child: Column(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: item.color.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(item.icon, size: 20, color: item.color),
                ),
                const SizedBox(height: 8),
                Text(item.value, style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: AppColors.textOf(context))),
                const SizedBox(height: 2),
                Text(item.label, style: TextStyle(fontSize: 10, color: AppColors.textSecondaryOf(context)), textAlign: TextAlign.center),
              ],
            ),
          );
        }).toList(),
      ),
    );
  }

  String _formatCount(dynamic val) {
    final n = int.tryParse(val?.toString() ?? '') ?? 0;
    if (n >= 1000) return '${(n / 1000).toStringAsFixed(1)}K';
    return n.toString();
  }

  // ── Section title ─────────────────────────────────────────────

  Widget _sectionTitle(String title, {VoidCallback? onSeeAll}) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(title, style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.textOf(context))),
          if (onSeeAll != null)
            GestureDetector(
              onTap: onSeeAll,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(context.tr('home.see_all'), style: const TextStyle(fontSize: 13, color: AppColors.primary, fontWeight: FontWeight.w600)),
                  const SizedBox(width: 2),
                  Icon(Icons.arrow_forward_ios_rounded, size: 12, color: AppColors.primary),
                ],
              ),
            ),
        ],
      ),
    );
  }

  // ── Shimmer ───────────────────────────────────────────────────

  Widget _buildShimmer() {
    final isDark = AppColors.isDark(context);
    return Shimmer.fromColors(
      baseColor: isDark ? AppColors.darkSurfaceAlt : Colors.grey.shade200,
      highlightColor: isDark ? AppColors.darkBorder : Colors.grey.shade50,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Top bar placeholder
          Container(height: 48, margin: const EdgeInsets.only(bottom: 16), decoration: BoxDecoration(color: AppColors.surfaceOf(context), borderRadius: BorderRadius.circular(12))),
          // Search placeholder
          Container(height: 50, margin: const EdgeInsets.only(bottom: 16), decoration: BoxDecoration(color: AppColors.surfaceOf(context), borderRadius: BorderRadius.circular(14))),
          // Banner placeholder
          Container(height: 160, margin: const EdgeInsets.only(bottom: 16), decoration: BoxDecoration(color: AppColors.surfaceOf(context), borderRadius: BorderRadius.circular(20))),
          // Quick actions placeholder
          Row(children: List.generate(4, (_) => Expanded(child: Container(height: 80, margin: const EdgeInsets.only(right: 8), decoration: BoxDecoration(color: AppColors.surfaceOf(context), borderRadius: BorderRadius.circular(14)))))),
          const SizedBox(height: 16),
          // Vendor placeholders
          ...List.generate(4, (_) => Container(
            height: 90,
            margin: const EdgeInsets.only(bottom: 10),
            decoration: BoxDecoration(color: AppColors.surfaceOf(context), borderRadius: BorderRadius.circular(14)),
          )),
        ],
      ),
    );
  }
}

// ── Helper classes ──────────────────────────────────────────────

class _QuickAction {
  final String label;
  final IconData icon;
  final List<Color> gradient;
  final VoidCallback onTap;
  const _QuickAction(this.label, this.icon, this.gradient, this.onTap);
}

class _StatItem {
  final String label;
  final String value;
  final IconData icon;
  final Color color;
  const _StatItem(this.label, this.value, this.icon, this.color);
}

class _ActionIcon extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;
  final bool badge;
  const _ActionIcon({required this.icon, required this.onTap, this.badge = false});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 2),
      child: IconButton(
        onPressed: onTap,
        icon: badge
            ? Badge(
                smallSize: 8,
                backgroundColor: AppColors.primary,
                child: Icon(icon, size: 24),
              )
            : Icon(icon, size: 24),
        style: IconButton.styleFrom(
          foregroundColor: AppColors.textOf(context),
        ),
      ),
    );
  }
}
