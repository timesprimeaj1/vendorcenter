import 'package:flutter/material.dart';
import 'package:vendorcenter/config/theme.dart';

class CategoryCard extends StatelessWidget {
  final String name;
  final int count;
  final VoidCallback? onTap;

  const CategoryCard({super.key, required this.name, required this.count, this.onTap});

  static const _categoryStyles = <String, _CatStyle>{
    'electric': _CatStyle(Icons.electrical_services, Color(0xFFF97316), Color(0xFFFFF7ED)),
    'plumb': _CatStyle(Icons.plumbing, Color(0xFF2563EB), Color(0xFFEFF6FF)),
    'clean': _CatStyle(Icons.cleaning_services, Color(0xFF22C55E), Color(0xFFF0FDF4)),
    'paint': _CatStyle(Icons.format_paint, Color(0xFFEF4444), Color(0xFFFEF2F2)),
    'carpenter': _CatStyle(Icons.carpenter, Color(0xFF92400E), Color(0xFFFEFCE8)),
    'salon': _CatStyle(Icons.content_cut, Color(0xFF9333EA), Color(0xFFFAF5FF)),
    'beauty': _CatStyle(Icons.content_cut, Color(0xFF9333EA), Color(0xFFFAF5FF)),
    'pest': _CatStyle(Icons.bug_report, Color(0xFFD97706), Color(0xFFFFFBEB)),
    'ac': _CatStyle(Icons.ac_unit, Color(0xFF0891B2), Color(0xFFECFEFF)),
    'hvac': _CatStyle(Icons.ac_unit, Color(0xFF0891B2), Color(0xFFECFEFF)),
    'shift': _CatStyle(Icons.local_shipping, Color(0xFF7C3AED), Color(0xFFF5F3FF)),
    'pack': _CatStyle(Icons.local_shipping, Color(0xFF7C3AED), Color(0xFFF5F3FF)),
    'garden': _CatStyle(Icons.grass, Color(0xFF15803D), Color(0xFFF0FDF4)),
    'photo': _CatStyle(Icons.camera_alt, Color(0xFF1D4ED8), Color(0xFFEFF6FF)),
    'catering': _CatStyle(Icons.restaurant, Color(0xFFDC2626), Color(0xFFFEF2F2)),
    'food': _CatStyle(Icons.restaurant, Color(0xFFDC2626), Color(0xFFFEF2F2)),
    'repair': _CatStyle(Icons.home_repair_service, Color(0xFF2563EB), Color(0xFFEFF6FF)),
  };

  _CatStyle get _style {
    final lower = name.toLowerCase();
    for (final entry in _categoryStyles.entries) {
      if (lower.contains(entry.key)) return entry.value;
    }
    return const _CatStyle(Icons.home_repair_service, Color(0xFF737686), Color(0xFFF2F3FF));
  }

  @override
  Widget build(BuildContext context) {
    final style = _style;
    final isDark = AppColors.isDark(context);

    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 110,
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 10),
        decoration: BoxDecoration(
          color: isDark ? AppColors.darkSurfaceAlt : style.bg,
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: style.accent.withValues(alpha: isDark ? 0.06 : 0.08),
              blurRadius: 16,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: style.accent.withValues(alpha: isDark ? 0.18 : 0.1),
                shape: BoxShape.circle,
              ),
              child: Icon(style.icon, size: 26, color: style.accent),
            ),
            const SizedBox(height: 10),
            Text(
              name,
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.textOf(context)),
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 2),
            Text(
              '$count vendor${count != 1 ? 's' : ''}',
              style: TextStyle(fontSize: 10, color: AppColors.textSecondaryOf(context), fontWeight: FontWeight.w500),
            ),
          ],
        ),
      ),
    );
  }
}

class _CatStyle {
  final IconData icon;
  final Color accent;
  final Color bg;
  const _CatStyle(this.icon, this.accent, this.bg);
}
