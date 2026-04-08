import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import 'package:vendorcenter/config/theme.dart';
import 'package:vendorcenter/services/api_service.dart';
import 'package:vendorcenter/services/auth_service.dart';

class VendorProfileScreen extends StatefulWidget {
  const VendorProfileScreen({super.key});

  @override
  State<VendorProfileScreen> createState() => _VendorProfileScreenState();
}

class _VendorProfileScreenState extends State<VendorProfileScreen> {
  final _api = ApiService();
  Map<String, dynamic> _profile = {};
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  Future<void> _loadProfile() async {
    setState(() => _loading = true);
    try {
      final data = await _api.getVendorProfile();
      if (mounted) setState(() => _profile = data);
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Profile'),
        actions: [
          TextButton.icon(
            onPressed: () => context.push('/profile/edit'),
            icon: const Icon(Icons.edit_outlined, size: 18),
            label: const Text('Edit'),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _loadProfile,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
          children: [
            // Avatar + name
            Center(
              child: Column(
                children: [
                  CircleAvatar(
                    radius: 44,
                    backgroundColor: AppColors.vendor.withValues(alpha: 0.1),
                    child: Text(
                      (auth.userName.isNotEmpty ? auth.userName[0] : 'V').toUpperCase(),
                      style: const TextStyle(
                        fontSize: 36,
                        fontWeight: FontWeight.w700,
                        color: AppColors.vendor,
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    auth.userName,
                    style: TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textOf(context),
                    ),
                  ),
                  if (auth.userEmail != null) ...[
                    const SizedBox(height: 4),
                    Text(
                      auth.userEmail!,
                      style: TextStyle(color: AppColors.textSecondaryOf(context)),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Business info
            if (!_loading && _profile.isNotEmpty) ...[
              _sectionTitle('Business Information'),
              _infoTile(Icons.store, 'Business Name', _profile['business_name'] ?? 'Not set'),
              _infoTile(Icons.category, 'Category', _profile['category'] ?? 'Not set'),
              _infoTile(Icons.location_on, 'Area', _profile['area'] ?? _profile['city'] ?? 'Not set'),
              _infoTile(Icons.pin_drop, 'Pincode', _profile['primaryPincode'] ?? _profile['primary_pincode'] ?? 'Not set'),
              _infoTile(Icons.phone, 'Phone', _profile['phone'] ?? auth.userPhone ?? 'Not set'),
              const SizedBox(height: 20),
            ],

            // Stats from profile
            if (!_loading) ...[
              _sectionTitle('Performance'),
              _infoTile(Icons.star, 'Rating', '${(_profile['average_rating'] ?? 0.0).toStringAsFixed(1)} / 5'),
              _infoTile(Icons.check_circle, 'Completed Bookings', '${_profile['completed_bookings'] ?? 0}'),
              _infoTile(Icons.schedule, 'Member Since', _profile['created_at'] ?? 'N/A'),
              const SizedBox(height: 20),
            ],

            // Reviews
            _sectionTitle('Quick Links'),
            _actionTile(Icons.reviews_outlined, 'My Reviews', () => context.push('/reviews')),
            _actionTile(Icons.attach_money, 'Earnings', () => context.push('/earnings')),
            _actionTile(Icons.help_outline, 'Help & Support', () {
              ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Coming soon')));
            }),
            const SizedBox(height: 32),

            // Logout
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: () => _confirmLogout(auth),
                icon: const Icon(Icons.logout, color: AppColors.error),
                label: const Text('Logout', style: TextStyle(color: AppColors.error)),
                style: OutlinedButton.styleFrom(
                  side: const BorderSide(color: AppColors.error),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
              ),
            ),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }

  Widget _sectionTitle(String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Text(
        text,
        style: TextStyle(
          fontSize: 16,
          fontWeight: FontWeight.w600,
          color: AppColors.textOf(context),
        ),
      ),
    );
  }

  Widget _infoTile(IconData icon, String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          Icon(icon, size: 20, color: AppColors.vendor),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: TextStyle(fontSize: 12, color: AppColors.textSecondaryOf(context))),
                Text(value, style: TextStyle(fontWeight: FontWeight.w500, color: AppColors.textOf(context))),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _actionTile(IconData icon, String title, VoidCallback onTap) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: Icon(icon, color: AppColors.vendor),
        title: Text(title, style: TextStyle(color: AppColors.textOf(context))),
        trailing: Icon(Icons.chevron_right, color: AppColors.textMutedOf(context)),
        onTap: onTap,
      ),
    );
  }

  void _confirmLogout(AuthService auth) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Logout'),
        content: const Text('Are you sure you want to logout?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              auth.logout();
            },
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.error),
            child: const Text('Logout'),
          ),
        ],
      ),
    );
  }
}
