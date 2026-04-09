import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:vendorcenter/config/theme.dart';
import 'package:vendorcenter/services/favorites_service.dart';

class VendorCard extends StatelessWidget {
  final Map<String, dynamic> vendor;
  final bool compact;

  const VendorCard({super.key, required this.vendor, this.compact = false});

  @override
  Widget build(BuildContext context) {
    final name = vendor['businessName'] ?? vendor['business_name'] ?? 'Vendor';
    final categories = vendor['serviceCategories'] as List<dynamic>?;
    final category = (categories != null && categories.isNotEmpty) ? categories.first.toString() : (vendor['category'] ?? '');
    final city = vendor['zone'] ?? vendor['city'] ?? '';
    final rating = (vendor['rating'] ?? vendor['avg_rating'] ?? 0).toDouble();
    final reviewCount = vendor['reviews'] ?? vendor['review_count'] ?? 0;
    final vendorId = vendor['vendorId']?.toString() ?? vendor['id']?.toString() ?? '';
    final isVerified = vendor['verificationStatus'] == 'approved' || vendor['is_verified'] == true;
    final distanceKm = vendor['distanceKm'];
    final pricePerHour = vendor['pricePerHour'] ?? vendor['price_per_hour'];
    final profilePhoto = vendor['profilePictureUrl'] ?? vendor['profile_picture_url'] ?? '';

    final favService = context.watch<FavoritesService>();
    final isFav = favService.isFavorite(vendorId);
    final isDark = AppColors.isDark(context);

    return GestureDetector(
      onTap: () {
        if (vendorId.isNotEmpty) context.push('/vendor/$vendorId');
      },
      child: Container(
        clipBehavior: Clip.hardEdge,
        decoration: BoxDecoration(
          color: isDark ? AppColors.darkSurface : AppColors.surface,
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: AppColors.primary.withValues(alpha: isDark ? 0.08 : 0.06),
              blurRadius: 24,
              offset: const Offset(0, 8),
            ),
            if (!isDark) BoxShadow(
              color: Colors.black.withValues(alpha: 0.03),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Photo header — 60% image weight
            SizedBox(
              height: compact ? 120 : 160,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  if (profilePhoto.toString().isNotEmpty)
                    Image.network(
                      profilePhoto.toString(),
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) => _buildPhotoPlaceholder(category, isDark),
                    )
                  else
                    _buildPhotoPlaceholder(category, isDark),
                  // Subtle gradient overlay at bottom
                  Positioned(
                    bottom: 0, left: 0, right: 0,
                    child: Container(
                      height: 80,
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [Colors.transparent, Colors.black.withValues(alpha: 0.45)],
                        ),
                      ),
                    ),
                  ),
                  // Top-left badges
                  Positioned(
                    top: 10, left: 10,
                    child: Row(
                      children: [
                        if (isVerified)
                          _badge('Verified', Icons.verified, AppColors.primary),
                        if (isVerified && rating >= 4.5) const SizedBox(width: 6),
                        if (rating >= 4.5)
                          _badge('Top Rated', Icons.workspace_premium, AppColors.accent),
                      ],
                    ),
                  ),
                  // Favorite button top-right
                  Positioned(
                    top: 10, right: 10,
                    child: GestureDetector(
                      onTap: () => favService.toggle(vendorId),
                      child: Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: Colors.black.withValues(alpha: 0.3),
                          shape: BoxShape.circle,
                        ),
                        child: AnimatedSwitcher(
                          duration: const Duration(milliseconds: 250),
                          child: Icon(
                            isFav ? Icons.favorite_rounded : Icons.favorite_border_rounded,
                            key: ValueKey(isFav),
                            size: 18,
                            color: isFav ? AppColors.error : Colors.white,
                          ),
                        ),
                      ),
                    ),
                  ),
                  // Rating pill bottom-left — white glass
                  if (rating > 0)
                    Positioned(
                      bottom: 10, left: 10,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.95),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.star_rounded, size: 14, color: _ratingColor(rating)),
                            const SizedBox(width: 3),
                            Text(rating.toStringAsFixed(1), style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: _ratingColor(rating))),
                            if (reviewCount > 0) ...[
                              const SizedBox(width: 2),
                              Text('(${_formatReviews(reviewCount)})', style: const TextStyle(fontSize: 11, color: Color(0xFF737686))),
                            ],
                          ],
                        ),
                      ),
                    ),
                ],
              ),
            ),
            // Content — editorial spacing
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 12, 14, 14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    name,
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.textOf(context), height: 1.2),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 4),
                  // Category tag
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: AppColors.primary.withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      category,
                      style: const TextStyle(fontSize: 11, color: AppColors.primary, fontWeight: FontWeight.w600),
                    ),
                  ),
                  const SizedBox(height: 10),
                  // Location + price row
                  Row(
                    children: [
                      Icon(Icons.location_on_outlined, size: 14, color: AppColors.textSecondaryOf(context)),
                      const SizedBox(width: 3),
                      Expanded(
                        child: Text(
                          distanceKm != null ? '$city • ${_formatDistance(distanceKm)}' : city,
                          style: TextStyle(fontSize: 12, color: AppColors.textSecondaryOf(context)),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      if (pricePerHour != null) ...[
                        Text('₹$pricePerHour', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.primary)),
                        Text('/hr', style: TextStyle(fontSize: 11, color: AppColors.textMutedOf(context))),
                      ],
                    ],
                  ),
                  const SizedBox(height: 12),
                  // Gradient CTA — Stitch spec
                  SizedBox(
                    width: double.infinity,
                    child: Container(
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [AppColors.gradientStart, AppColors.gradientEnd],
                        ),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Material(
                        color: Colors.transparent,
                        child: InkWell(
                          borderRadius: BorderRadius.circular(10),
                          onTap: () {
                            if (vendorId.isNotEmpty) context.push('/vendor/$vendorId');
                          },
                          child: const Padding(
                            padding: EdgeInsets.symmetric(vertical: 11),
                            child: Text('View Profile', textAlign: TextAlign.center, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Colors.white)),
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPhotoPlaceholder(String category, bool isDark) {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: isDark
              ? [const Color(0xFF161822), const Color(0xFF1E2030)]
              : [AppColors.surfaceAlt, AppColors.surfaceContainer],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Center(
        child: Icon(_categoryIcon(category), size: 44, color: AppColors.primary.withValues(alpha: 0.3)),
      ),
    );
  }

  Widget _badge(String label, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.92),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: Colors.white),
          const SizedBox(width: 4),
          Text(label, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Colors.white)),
        ],
      ),
    );
  }

  String _formatDistance(dynamic km) {
    final d = double.tryParse(km.toString()) ?? 0;
    if (d < 1) return '${(d * 1000).round()}m away';
    return '${d.toStringAsFixed(1)} km';
  }

  String _formatReviews(dynamic count) {
    final n = int.tryParse(count.toString()) ?? 0;
    if (n >= 1000) return '${(n / 1000).toStringAsFixed(1)}k';
    return n.toString();
  }

  Color _ratingColor(double r) {
    if (r >= 4.0) return const Color(0xFF16A34A);
    if (r >= 3.0) return const Color(0xFFF59E0B);
    return const Color(0xFFEF4444);
  }

  static IconData _categoryIcon(String category) {
    final lower = category.toLowerCase();
    if (lower.contains('appliance') || lower.contains('repair') || lower.contains('mechanic')) return Icons.home_repair_service_rounded;
    if (lower.contains('clean')) return Icons.cleaning_services_rounded;
    if (lower.contains('electric') || lower.contains('wiring')) return Icons.bolt_rounded;
    if (lower.contains('plumb') || lower.contains('pipe')) return Icons.plumbing_rounded;
    if (lower.contains('paint') || lower.contains('décor')) return Icons.format_paint_rounded;
    if (lower.contains('salon') || lower.contains('beauty') || lower.contains('hair')) return Icons.content_cut_rounded;
    if (lower.contains('moving') || lower.contains('reloc') || lower.contains('tow')) return Icons.local_shipping_rounded;
    if (lower.contains('auto') || lower.contains('vehicle')) return Icons.directions_car_rounded;
    if (lower.contains('garden') || lower.contains('lawn')) return Icons.yard_rounded;
    if (lower.contains('photo') || lower.contains('video')) return Icons.camera_alt_rounded;
    if (lower.contains('catering') || lower.contains('food')) return Icons.restaurant_rounded;
    if (lower.contains('ac') || lower.contains('hvac') || lower.contains('air')) return Icons.ac_unit_rounded;
    return Icons.storefront_rounded;
  }
}
