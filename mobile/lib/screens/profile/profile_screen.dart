import 'dart:io';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import 'package:vendorcenter/config/theme.dart';
import 'package:vendorcenter/services/api_service.dart';
import 'package:vendorcenter/services/auth_service.dart';
import 'package:vendorcenter/services/theme_service.dart';
import 'package:vendorcenter/services/favorites_service.dart';
import 'package:vendorcenter/services/localization_service.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final _api = ApiService();
  final _picker = ImagePicker();
  Map<String, dynamic>? _profile;
  bool _loading = true;
  File? _avatarFile;
  String? _avatarUrl;

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  Future<void> _loadProfile() async {
    final auth = context.read<AuthService>();
    if (!auth.isLoggedIn) {
      setState(() => _loading = false);
      return;
    }
    try {
      final profile = await _api.getProfile();
      if (mounted) setState(() {
        _profile = profile;
        _avatarUrl = profile['profilePictureUrl'] as String?;
        _loading = false;
      });
    } catch (e) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _pickProfilePhoto() async {
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 40, height: 4,
                decoration: BoxDecoration(color: Colors.grey[300], borderRadius: BorderRadius.circular(2)),
              ),
              const SizedBox(height: 16),
              const Text('Update Profile Photo', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
              const SizedBox(height: 16),
              ListTile(
                leading: Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(color: AppColors.primary.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(12)),
                  child: const Icon(Icons.camera_alt, color: AppColors.primary),
                ),
                title: const Text('Take Photo'),
                onTap: () => Navigator.pop(ctx, ImageSource.camera),
              ),
              ListTile(
                leading: Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(color: AppColors.accent.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(12)),
                  child: const Icon(Icons.photo_library, color: AppColors.accent),
                ),
                title: const Text('Choose from Gallery'),
                onTap: () => Navigator.pop(ctx, ImageSource.gallery),
              ),
            ],
          ),
        ),
      ),
    );
    if (source == null) return;
    final picked = await _picker.pickImage(source: source, maxWidth: 512, maxHeight: 512, imageQuality: 80);
    if (picked != null && mounted) {
      setState(() => _avatarFile = File(picked.path));
      // Upload to server
      try {
        final url = await _api.uploadFile(picked.path);
        if (url.isNotEmpty) {
          await _api.updateProfilePhoto(url);
          if (mounted) {
            setState(() => _avatarUrl = url);
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Photo updated'), backgroundColor: AppColors.success),
            );
          }
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Photo upload failed: $e'), backgroundColor: AppColors.error),
          );
        }
      }
    }
  }

  Future<void> _handleLogout() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(context.tr('auth.logout')),
        content: Text(context.tr('auth.logout_confirm')),
        actions: [
          TextButton(onPressed: () => ctx.pop(false), child: Text(context.tr('common.cancel'))),
          FilledButton(onPressed: () => ctx.pop(true), child: Text(context.tr('auth.logout'))),
        ],
      ),
    );
    if (confirmed == true && mounted) {
      await context.read<AuthService>().logout();
      if (mounted) context.go('/login');
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();

    if (!auth.isLoggedIn) {
      return Scaffold(
        appBar: AppBar(title: Text(context.tr('profile.title'))),
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
                  child: const Icon(Icons.person_outline_rounded, size: 40, color: AppColors.primary),
                ),
                const SizedBox(height: 16),
                Text(context.tr('profile.sign_in_to_view'), style: TextStyle(color: AppColors.textSecondaryOf(context), fontSize: 16)),
                const SizedBox(height: 20),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(onPressed: () => context.go('/login'), child: Text(context.tr('auth.login'))),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(title: Text(context.tr('profile.title'))),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadProfile,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
                children: [
                  // Avatar + name
                  Center(
                    child: Column(
                      children: [
                        GestureDetector(
                          onTap: _pickProfilePhoto,
                          child: Stack(
                            children: [
                              CircleAvatar(
                                radius: 44,
                                backgroundColor: AppColors.primary.withValues(alpha: 0.1),
                                backgroundImage: _avatarFile != null
                                    ? FileImage(_avatarFile!)
                                    : (_avatarUrl != null && _avatarUrl!.isNotEmpty
                                        ? NetworkImage(_avatarUrl!) as ImageProvider
                                        : null),
                                child: (_avatarFile == null && (_avatarUrl == null || _avatarUrl!.isEmpty))
                                    ? Text(
                                        (auth.userName.isNotEmpty ? auth.userName[0] : '?').toUpperCase(),
                                        style: const TextStyle(fontSize: 30, fontWeight: FontWeight.w700, color: AppColors.primary),
                                      )
                                    : null,
                              ),
                              Positioned(
                                bottom: 0, right: 0,
                                child: Container(
                                  padding: const EdgeInsets.all(6),
                                  decoration: BoxDecoration(
                                    color: AppColors.primary,
                                    shape: BoxShape.circle,
                                    border: Border.all(color: AppColors.surfaceOf(context), width: 2),
                                  ),
                                  child: const Icon(Icons.camera_alt, size: 14, color: Colors.white),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 12),
                        Text(auth.userName, style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: AppColors.textOf(context))),
                        if (auth.userEmail != null && auth.userEmail!.isNotEmpty)
                          Text(auth.userEmail!, style: TextStyle(color: AppColors.textSecondaryOf(context))),
                        if (auth.userPhone != null && auth.userPhone!.isNotEmpty)
                          Text(auth.userPhone!, style: TextStyle(color: AppColors.textSecondaryOf(context))),
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),

                  // Info cards
                  if (_profile != null) ...[
                    _infoTile('Full Name', _profile!['name'] ?? auth.userName, Icons.person_outline),
                    _infoTile('Email', _profile!['email'] ?? auth.userEmail, Icons.email_outlined),
                    _infoTile('Phone', _profile!['phone'] ?? auth.userPhone, Icons.phone_outlined),
                    if (_profile!['address'] != null)
                      _infoTile('Address', _profile!['address'], Icons.location_on_outlined),
                    if (_profile!['city'] != null)
                      _infoTile('City', _profile!['city'], Icons.location_city),
                  ],
                  const SizedBox(height: 20),

                  // Quick links
                  _quickLinkTile(
                    Icons.favorite_outline,
                    context.tr('profile.saved_vendors'),
                    '${context.watch<FavoritesService>().count} saved',
                    () => context.push('/favorites'),
                  ),
                  _quickLinkTile(
                    Icons.location_on_outlined,
                    'My Addresses',
                    null,
                    () => context.push('/addresses'),
                  ),
                  _quickLinkTile(
                    Icons.notifications_outlined,
                    context.tr('nav.notifications'),
                    null,
                    () => context.push('/notifications'),
                  ),
                  _quickLinkTile(
                    Icons.smart_toy_outlined,
                    'VendorCenter Assistant',
                    null,
                    () => context.push('/chat'),
                  ),
                  _quickLinkTile(
                    Icons.help_outline,
                    context.tr('nav.support'),
                    null,
                    () => context.push('/support'),
                  ),
                  const SizedBox(height: 12),

                  // Dark mode toggle
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceAltOf(context),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.dark_mode_outlined, size: 20, color: AppColors.primary),
                        const SizedBox(width: 12),
                        Expanded(child: Text(context.tr('profile.theme'), style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500))),
                        Switch.adaptive(
                          value: context.watch<ThemeService>().isDark,
                          onChanged: (_) => context.read<ThemeService>().toggle(),
                          activeTrackColor: AppColors.primary.withValues(alpha: 0.5),
                          activeThumbColor: AppColors.primary,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 8),

                  // Language picker
                  _buildLanguagePicker(),
                  const SizedBox(height: 20),

                  // Edit profile
                  OutlinedButton.icon(
                    onPressed: () async {
                      final updated = await context.push<bool>('/profile/edit');
                      if (updated == true) _loadProfile();
                    },
                    icon: const Icon(Icons.edit_outlined),
                    label: Text(context.tr('profile.edit')),
                    style: OutlinedButton.styleFrom(
                      minimumSize: const Size.fromHeight(48),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                  const SizedBox(height: 12),

                  // Logout
                  OutlinedButton.icon(
                    onPressed: _handleLogout,
                    icon: const Icon(Icons.logout, color: AppColors.error),
                    label: Text(context.tr('auth.logout'), style: const TextStyle(color: AppColors.error)),
                    style: OutlinedButton.styleFrom(
                      minimumSize: const Size.fromHeight(48),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      side: const BorderSide(color: AppColors.error),
                    ),
                  ),
                  const SizedBox(height: 24),

                  // App info
                  Center(
                    child: Text(
                      'VendorCenter v1.0.0',
                      style: TextStyle(fontSize: 12, color: AppColors.textMutedOf(context)),
                    ),
                  ),
                ],
              ),
            ),
    );
  }

  Widget _buildLanguagePicker() {
    final l10n = context.watch<LocalizationService>();
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.surfaceAltOf(context),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          const Icon(Icons.translate_outlined, size: 20, color: AppColors.primary),
          const SizedBox(width: 12),
          Expanded(child: Text(context.tr('profile.language'), style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500))),
          DropdownButton<String>(
            value: l10n.locale,
            underline: const SizedBox(),
            borderRadius: BorderRadius.circular(12),
            items: LocalizationService.supportedLocales.map((code) {
              return DropdownMenuItem(
                value: code,
                child: Text(
                  LocalizationService.localeLabels[code] ?? code,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: code == l10n.locale ? FontWeight.w600 : FontWeight.w400,
                    color: AppColors.textOf(context),
                  ),
                ),
              );
            }).toList(),
            onChanged: (code) {
              if (code != null) l10n.setLocale(code);
            },
          ),
        ],
      ),
    );
  }

  Widget _infoTile(String label, String value, IconData icon) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.surfaceAltOf(context),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Icon(icon, size: 20, color: AppColors.primary),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: TextStyle(fontSize: 11, color: AppColors.textSecondaryOf(context))),
                Text(value, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: AppColors.textOf(context))),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _quickLinkTile(IconData icon, String title, String? subtitle, VoidCallback onTap) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: AppColors.surfaceAltOf(context),
        borderRadius: BorderRadius.circular(12),
      ),
      child: ListTile(
        leading: Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: AppColors.primary.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(icon, color: AppColors.primary, size: 20),
        ),
        title: Text(title, style: TextStyle(fontWeight: FontWeight.w500, color: AppColors.textOf(context))),
        subtitle: subtitle != null ? Text(subtitle, style: TextStyle(fontSize: 12, color: AppColors.textSecondaryOf(context))) : null,
        trailing: Icon(Icons.chevron_right, size: 20, color: AppColors.textMutedOf(context)),
        onTap: onTap,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }
}
